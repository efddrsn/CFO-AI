import type { Rule } from "@cfo-ai/db";

export interface RuleMatchInput {
  description: string;
  originalDescription: string;
  counterparty?: string | null;
}

export interface RuleMatch {
  categoryId: string | null;
  subcategoryId: string | null;
  rule: Rule;
}

/**
 * Aplica regras determinísticas em ordem de prioridade (maior primeiro).
 * Retorna o primeiro match ou null.
 *
 * matchType:
 * - regex: regex case-insensitive contra description
 * - contains: substring case-insensitive em description ou originalDescription
 * - counterparty: igualdade case-insensitive contra counterparty
 * - mcc: ainda não suportado (passa adiante)
 */
export function applyRules(
  rules: Rule[],
  input: RuleMatchInput,
): RuleMatch | null {
  const sorted = [...rules]
    .filter((r) => r.isActive)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    if (matches(rule, input)) {
      return {
        categoryId: rule.setCategoryId,
        subcategoryId: rule.setSubcategoryId,
        rule,
      };
    }
  }
  return null;
}

function matches(rule: Rule, input: RuleMatchInput): boolean {
  const desc = input.description.toLowerCase();
  const orig = input.originalDescription.toLowerCase();
  const cp = (input.counterparty ?? "").toLowerCase();
  const pat = rule.pattern;

  switch (rule.matchType) {
    case "regex":
      try {
        return new RegExp(pat, "i").test(input.description);
      } catch {
        return false;
      }
    case "contains": {
      const p = pat.toLowerCase();
      return desc.includes(p) || orig.includes(p);
    }
    case "counterparty":
      return cp === pat.toLowerCase();
    default:
      return false;
  }
}
