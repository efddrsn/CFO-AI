import { z } from "zod";

export const Currency = z.enum(["BRL", "USD", "EUR", "GBP"]);
export type Currency = z.infer<typeof Currency>;

export const AccountType = z.enum([
  "checking",
  "savings",
  "credit_card",
  "investment",
  "brokerage",
  "crypto_exchange",
  "crypto_wallet",
  "other",
]);
export type AccountType = z.infer<typeof AccountType>;

export const AccountSource = z.enum([
  "manual",
  "csv",
  "ofx",
  "pluggy",
  "teller",
  "plaid",
  "schwab",
  "gmail",
  "ccxt",
  "zerion",
]);
export type AccountSource = z.infer<typeof AccountSource>;

export const CategoryKind = z.enum(["income", "expense", "transfer", "investment"]);
export type CategoryKind = z.infer<typeof CategoryKind>;

export const TxnStatus = z.enum(["pending_sync", "active", "rejected"]);
export type TxnStatus = z.infer<typeof TxnStatus>;

export const SyncStatus = z.enum([
  "running",
  "pending_review",
  "approved",
  "rejected",
  "failed",
]);
export type SyncStatus = z.infer<typeof SyncStatus>;

export const ProposalKind = z.enum([
  "new_category",
  "new_subcategory",
  "split",
  "merge",
  "rename",
  "archive",
]);
export type ProposalKind = z.infer<typeof ProposalKind>;

export const ProposalStatus = z.enum([
  "pending",
  "accepted",
  "rejected",
  "dismissed",
  "auto_applied",
]);
export type ProposalStatus = z.infer<typeof ProposalStatus>;

export const GoalType = z.enum([
  "emergency_fund",
  "purchase",
  "retirement",
  "debt_payoff",
  "freedom_number",
  "custom",
]);
export type GoalType = z.infer<typeof GoalType>;
