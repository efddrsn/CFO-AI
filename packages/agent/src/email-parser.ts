import Anthropic from "@anthropic-ai/sdk";

/**
 * Email → transações estruturadas via Sonnet 4.6.
 *
 * Suporta dois modos:
 *   - text: passa subject + body (text/plain ou HTML stripado) pro LLM
 *   - pdf: passa o PDF como document block (Claude vision) pro LLM
 *
 * Saída: array de transações canônicas (campo neutro, sem account_id; o caller
 * resolve a conta com base no `institution_hint`).
 */

const MODEL = "claude-sonnet-4-6";

export interface EmailParseHint {
  institution: string; // "Nubank", "Itaú", "Nomad"
  kind: "transaction_notification" | "statement_pdf" | "receipt";
  /** Texto livre extra pra orientar o parser. */
  hint?: string;
}

export interface ParsedTxn {
  date: string; // ISO yyyy-mm-dd
  amount: number; // BRL/USD em decimal (não cents) — negativo = saída
  currency: string;
  description: string;
  counterparty?: string | null;
  installment_number?: number | null;
  installment_total?: number | null;
}

export interface ParseEmailResult {
  transactions: ParsedTxn[];
  confidence: number;
  /** Breve explicação do que o LLM viu / motivos pra confiar ou desconfiar. */
  notes: string;
}

export interface ParseEmailTextInput {
  hint: EmailParseHint;
  emailDate: string; // ISO; usado pra resolver "hoje" relativo
  subject: string;
  from: string;
  body: string;
}

export interface ParseEmailPdfInput {
  hint: EmailParseHint;
  emailDate: string;
  subject: string;
  from: string;
  /** PDF inline em base64 (sem prefixo data:). */
  pdfBase64: string;
}

export class EmailParser {
  private client: Anthropic;

  constructor(opts: { apiKey?: string; client?: Anthropic } = {}) {
    this.client =
      opts.client ??
      new Anthropic({ apiKey: opts.apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  async parseText(input: ParseEmailTextInput): Promise<ParseEmailResult> {
    const system = buildSystemPrompt(input.hint);
    const userText = [
      `Email recebido em ${input.emailDate}`,
      `De: ${input.from}`,
      `Assunto: ${input.subject}`,
      "",
      "Corpo:",
      input.body.slice(0, 20_000), // cap defensivo
    ].join("\n");

    return this.call(system, [{ type: "text", text: userText }]);
  }

  async parsePdf(input: ParseEmailPdfInput): Promise<ParseEmailResult> {
    const system = buildSystemPrompt(input.hint);
    const meta = [
      `Email recebido em ${input.emailDate}`,
      `De: ${input.from}`,
      `Assunto: ${input.subject}`,
      "",
      "Extraia todas as transações deste PDF (fatura/statement) seguindo o JSON solicitado.",
    ].join("\n");

    return this.call(system, [
      {
        // `document` block é aceito pela API mas não tipado no SDK 0.32.x
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: input.pdfBase64,
        },
      },
      { type: "text", text: meta },
    ]);
  }

  private async call(
    systemPrompt: string,
    content: unknown[],
  ): Promise<ParseEmailResult> {
    try {
      const message = await this.client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        // cache_control aceito pela API mesmo sem typing oficial ainda (SDK 0.32)
        system: [
          { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
        ] as unknown as Anthropic.TextBlockParam[],
        messages: [
          {
            role: "user",
            content: content as unknown as Anthropic.MessageParam["content"],
          },
        ],
      });

      const text = message.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("");

      return parseLlmOutput(text);
    } catch (err) {
      return {
        transactions: [],
        confidence: 0,
        notes: `llm_error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

function buildSystemPrompt(hint: EmailParseHint): string {
  const lines = [
    "Você extrai transações financeiras de emails bancários (BR e US).",
    `Instituição: ${hint.institution}.`,
    `Tipo de email: ${hint.kind}.`,
  ];
  if (hint.hint) lines.push(`Dica: ${hint.hint}`);
  lines.push(
    "",
    "Retorne SOMENTE JSON no formato:",
    '{"transactions":[{"date":"yyyy-mm-dd","amount":-12.34,"currency":"BRL","description":"...","counterparty":"...","installment_number":null,"installment_total":null}],"confidence":0.0-1.0,"notes":"..."}',
    "",
    "Regras:",
    "- `amount` em decimal (não cents). Negativo = saída/débito, positivo = entrada/crédito.",
    "- `date` é a data da transação (não a data do email), no formato yyyy-mm-dd.",
    "- `currency` ISO 4217 (BRL, USD, EUR).",
    "- Use `installment_number/total` quando o PDF/email indicar parcelamento (ex.: '3/12').",
    "- Se for fatura de cartão de crédito, extraia CADA transação individual, não o total da fatura.",
    "- Se for notificação simples (1 transação), retorne array com 1 item.",
    "- Se não houver transações claras, retorne array vazio e confidence baixa.",
    "- Em `notes`, descreva brevemente o que extraiu e qualquer ambiguidade.",
  );
  return lines.join("\n");
}

function parseLlmOutput(text: string): ParseEmailResult {
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const candidate = (() => {
    try {
      return JSON.parse(stripped);
    } catch {
      const m = stripped.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
  })();

  if (!candidate || typeof candidate !== "object") {
    return { transactions: [], confidence: 0, notes: "parse_error: LLM output not JSON" };
  }
  const raw = candidate as Record<string, unknown>;
  const txns = Array.isArray(raw.transactions)
    ? (raw.transactions as unknown[]).map(normalizeTxn).filter((t): t is ParsedTxn => !!t)
    : [];
  const confidence = clamp(Number(raw.confidence ?? 0), 0, 1);
  const notes = typeof raw.notes === "string" ? raw.notes : "";
  return { transactions: txns, confidence, notes };
}

function normalizeTxn(raw: unknown): ParsedTxn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const date = typeof r.date === "string" ? r.date : null;
  const amount = Number(r.amount);
  const currency = typeof r.currency === "string" ? r.currency.toUpperCase() : "BRL";
  const description = typeof r.description === "string" ? r.description : "";
  if (!date || !Number.isFinite(amount) || !description) return null;
  return {
    date,
    amount,
    currency,
    description,
    counterparty: typeof r.counterparty === "string" ? r.counterparty : null,
    installment_number:
      typeof r.installment_number === "number" ? r.installment_number : null,
    installment_total:
      typeof r.installment_total === "number" ? r.installment_total : null,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0;
}
