import { Categorizer, type CategorySummary, type CorrectionExample } from "@cfo-ai/agent";
import {
  categories as categoriesTable,
  correctionExamples,
  db,
  rules as rulesTable,
} from "@cfo-ai/db";
import { desc, eq } from "drizzle-orm";
import { applyRules } from "./rules";

const CORRECTIONS_LIMIT = 50;

/**
 * Pipeline de categorização (§6.2 da SPEC):
 *   1) Regras determinísticas
 *   2) LLM (Sonnet 4.6) com few-shot das correções recentes
 *   3) Fallback "Não categorizado" se LLM não passa confidence threshold
 */

let _categorizer: Categorizer | null = null;
let _categoryCache: { fetchedAt: number; data: CategorySummary[] } | null = null;
let _fallbackId: string | null = null;

async function loadCategories(): Promise<CategorySummary[]> {
  const now = Date.now();
  if (_categoryCache && now - _categoryCache.fetchedAt < 60_000) {
    return _categoryCache.data;
  }
  const rows = await db.select().from(categoriesTable);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const data: CategorySummary[] = rows
    .filter((r) => !r.isArchived)
    .map((r) => ({
      id: r.id,
      name: r.name,
      parentId: r.parentId,
      parentName: r.parentId ? byId.get(r.parentId)?.name ?? null : null,
      kind: r.kind as CategorySummary["kind"],
    }));
  _categoryCache = { fetchedAt: now, data };
  return data;
}

async function getFallbackCategoryId(): Promise<string> {
  if (_fallbackId) return _fallbackId;
  const [row] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.name, "Não categorizado"));
  if (!row) throw new Error("Seed missing: 'Não categorizado' category");
  _fallbackId = row.id;
  return _fallbackId;
}

async function loadCorrections(): Promise<CorrectionExample[]> {
  const rows = await db
    .select()
    .from(correctionExamples)
    .orderBy(desc(correctionExamples.appliedAt))
    .limit(CORRECTIONS_LIMIT);
  return rows
    .filter((r) => r.chosenCategoryId)
    .map((r) => ({
      originalDescription: r.originalDescription,
      counterparty: r.counterparty,
      amountCents: r.amountCents,
      currency: r.currency,
      chosenCategoryId: r.chosenCategoryId as string,
      chosenSubcategoryId: r.chosenSubcategoryId ?? null,
    }));
}

export interface CategorizeRequest {
  originalDescription: string;
  description?: string | null;
  counterparty?: string | null;
  amountCents: number;
  currency: string;
  accountType?: string | null;
}

export interface CategorizeResponse {
  categoryId: string;
  subcategoryId: string | null;
  source: "rule" | "llm" | "fallback";
  confidence: number;
  rationale: string;
}

export async function categorize(
  input: CategorizeRequest,
): Promise<CategorizeResponse> {
  const fallbackId = await getFallbackCategoryId();

  // 1) Regras determinísticas
  const activeRules = (await db.select().from(rulesTable)).filter(
    (r) => r.isActive,
  );
  const match = applyRules(activeRules, {
    description: input.description ?? input.originalDescription,
    originalDescription: input.originalDescription,
    counterparty: input.counterparty,
  });
  if (match?.categoryId) {
    return {
      categoryId: match.categoryId,
      subcategoryId: match.subcategoryId,
      source: "rule",
      confidence: 1,
      rationale: `Rule #${match.rule.id} (${match.rule.matchType}: ${match.rule.pattern})`,
    };
  }

  // 2) LLM
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      categoryId: fallbackId,
      subcategoryId: null,
      source: "fallback",
      confidence: 0,
      rationale: "ANTHROPIC_API_KEY missing — skipping LLM",
    };
  }
  if (!_categorizer) {
    _categorizer = new Categorizer({ fallbackCategoryId: fallbackId });
  }

  const [categories, corrections] = await Promise.all([
    loadCategories(),
    loadCorrections(),
  ]);

  const result = await _categorizer.categorize(input, {
    categories,
    corrections,
    fallbackCategoryId: fallbackId,
  });

  return {
    categoryId: result.categoryId ?? fallbackId,
    subcategoryId: result.subcategoryId,
    source: result.categoryId === fallbackId ? "fallback" : "llm",
    confidence: result.confidence,
    rationale: result.rationale,
  };
}
