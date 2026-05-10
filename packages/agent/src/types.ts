export interface CategorySummary {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  kind: "income" | "expense" | "transfer" | "investment";
}

export interface CorrectionExample {
  originalDescription: string;
  counterparty: string | null;
  amountCents: number;
  currency: string;
  chosenCategoryId: string;
  chosenSubcategoryId: string | null;
}

export interface CategorizationInput {
  originalDescription: string;
  description?: string | null;
  counterparty?: string | null;
  amountCents: number;
  currency: string;
  accountType?: string | null;
}

export interface CategorizationResult {
  categoryId: string | null;
  subcategoryId: string | null;
  confidence: number; // 0..1
  rationale: string;
}
