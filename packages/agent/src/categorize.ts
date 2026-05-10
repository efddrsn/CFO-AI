import Anthropic from "@anthropic-ai/sdk";
import { formatBRL, formatUSD } from "@cfo-ai/shared";
import type {
  CategorizationInput,
  CategorizationResult,
  CategorySummary,
  CorrectionExample,
} from "./types";

/**
 * Categorizador via Sonnet 4.6 com prompt caching.
 *
 * Estratégia (§6.2 da SPEC):
 * - Sem embeddings/clustering: o LLM lê descrição + counterparty + amount +
 *   tipo da conta diretamente.
 * - Few-shot: últimas N correções do usuário entram em cache prefix → input
 *   barato pra cada chamada subsequente.
 * - Lista de categorias também vai em cache prefix.
 * - Output: JSON estruturado com confidence; confiança < 0.6 → fallback.
 *
 * Trade-off explícito: regras determinísticas (regex/contains/counterparty)
 * são aplicadas ANTES dessa função (ver applyRules em apps/etl). Só chamamos
 * o LLM quando nenhuma regra bate.
 */

const MODEL = "claude-sonnet-4-6";
const CONFIDENCE_THRESHOLD = 0.6;

export interface CategorizeOptions {
  apiKey?: string;
  /** Por padrão lê de env ANTHROPIC_API_KEY. */
  client?: Anthropic;
  /** "Não categorizado" — pra usar como fallback. */
  fallbackCategoryId: string;
}

export class Categorizer {
  private client: Anthropic;

  constructor(opts: CategorizeOptions) {
    this.client =
      opts.client ??
      new Anthropic({
        apiKey: opts.apiKey ?? process.env.ANTHROPIC_API_KEY,
      });
  }

  async categorize(
    input: CategorizationInput,
    context: {
      categories: CategorySummary[];
      corrections: CorrectionExample[];
      fallbackCategoryId: string;
    },
  ): Promise<CategorizationResult> {
    const { categories, corrections, fallbackCategoryId } = context;

    const systemPrompt = buildSystemPrompt(categories);
    const fewShot = buildFewShot(corrections, categories);
    const userPrompt = buildUserPrompt(input);

    try {
      // `cache_control` é aceito pela API (prompt caching) mas ainda não está
      // tipado no SDK 0.32.x — cast pra contornar até a próxima release.
      const systemBlocks = [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
        ...(fewShot
          ? [{ type: "text", text: fewShot, cache_control: { type: "ephemeral" } }]
          : []),
      ];
      const message = await this.client.messages.create({
        model: MODEL,
        max_tokens: 400,
        system: systemBlocks as unknown as Anthropic.TextBlockParam[],
        messages: [{ role: "user", content: userPrompt }],
      });

      const text = message.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("");

      const parsed = parseJson(text);
      if (!parsed) {
        return {
          categoryId: fallbackCategoryId,
          subcategoryId: null,
          confidence: 0,
          rationale: "LLM output not parseable",
        };
      }

      const conf = clamp(Number(parsed.confidence ?? 0), 0, 1);
      const rationale = typeof parsed.rationale === "string" ? parsed.rationale : "";

      if (conf < CONFIDENCE_THRESHOLD) {
        return {
          categoryId: fallbackCategoryId,
          subcategoryId: null,
          confidence: conf,
          rationale: rationale || "Below confidence threshold",
        };
      }

      const categoryId = validId(parsed.category_id, categories);
      if (!categoryId) {
        return {
          categoryId: fallbackCategoryId,
          subcategoryId: null,
          confidence: conf,
          rationale: "LLM returned invalid category_id",
        };
      }
      const subcategoryId = validId(parsed.subcategory_id, categories);

      return {
        categoryId,
        subcategoryId,
        confidence: conf,
        rationale,
      };
    } catch (err) {
      return {
        categoryId: fallbackCategoryId,
        subcategoryId: null,
        confidence: 0,
        rationale: `llm_error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

function buildSystemPrompt(categories: CategorySummary[]): string {
  const lines: string[] = [];
  lines.push(
    "Você é um categorizador de transações financeiras pessoais (BR + US).",
  );
  lines.push(
    'Retorne SOMENTE JSON no formato: {"category_id":"<uuid>","subcategory_id":"<uuid|null>","confidence":0.0-1.0,"rationale":"breve explicação"}',
  );
  lines.push(
    "Use sempre `subcategory_id` quando houver subcategoria adequada. Use `category_id` da categoria pai correspondente.",
  );
  lines.push(
    "Se a transação claramente é transferência entre contas próprias ou pagamento de cartão, use 'Transferências internas'.",
  );
  lines.push(
    "Se for aporte/resgate de investimento, use 'Investimentos' (não 'Outros').",
  );
  lines.push("Categorias disponíveis (id | nome | kind | pai):");
  for (const c of categories) {
    lines.push(
      `  ${c.id} | ${c.name} | ${c.kind} | ${c.parentName ?? "—"}`,
    );
  }
  return lines.join("\n");
}

function buildFewShot(
  corrections: CorrectionExample[],
  categories: CategorySummary[],
): string | null {
  if (corrections.length === 0) return null;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const lines: string[] = ["Exemplos de correções recentes do usuário (use como guia):"];
  for (const ex of corrections.slice(0, 50)) {
    const cat = byId.get(ex.chosenCategoryId);
    const sub = ex.chosenSubcategoryId ? byId.get(ex.chosenSubcategoryId) : null;
    const amount =
      ex.currency === "BRL" ? formatBRL(ex.amountCents) : formatUSD(ex.amountCents);
    lines.push(
      `- "${ex.originalDescription}" | counterparty="${ex.counterparty ?? ""}" | ${amount} → ${cat?.name ?? "?"}${sub ? ` / ${sub.name}` : ""}`,
    );
  }
  return lines.join("\n");
}

function buildUserPrompt(input: CategorizationInput): string {
  const amount =
    input.currency === "BRL"
      ? formatBRL(input.amountCents)
      : formatUSD(input.amountCents);
  return [
    "Categorize esta transação:",
    `description: ${input.description ?? input.originalDescription}`,
    `original_description: ${input.originalDescription}`,
    `counterparty: ${input.counterparty ?? "—"}`,
    `amount: ${amount}`,
    `currency: ${input.currency}`,
    `account_type: ${input.accountType ?? "—"}`,
    "",
    "Retorne apenas o JSON.",
  ].join("\n");
}

function parseJson(text: string): Record<string, unknown> | null {
  // Tolerante: remove cercas ```json...``` e tenta JSON.parse
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    // tenta extrair primeiro objeto JSON
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function validId(
  value: unknown,
  categories: CategorySummary[],
): string | null {
  if (typeof value !== "string") return null;
  if (value === "null" || value === "") return null;
  return categories.some((c) => c.id === value) ? value : null;
}

function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0;
}
