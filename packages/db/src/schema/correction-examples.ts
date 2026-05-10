import { bigint, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { categories } from "./categories.js";

/**
 * Banco de correções de categorização do usuário.
 * Usado como few-shot no prompt do Sonnet 4.6 (LRU N=50).
 * Substitui embeddings/clustering — ver §6.2 da SPEC.
 */
export const correctionExamples = pgTable("correction_examples", {
  id: uuid("id").primaryKey().defaultRandom(),
  originalDescription: text("original_description").notNull(),
  counterparty: text("counterparty"),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  currency: text("currency").notNull(),
  chosenCategoryId: uuid("chosen_category_id").references(() => categories.id, {
    onDelete: "cascade",
  }),
  chosenSubcategoryId: uuid("chosen_subcategory_id").references(() => categories.id, {
    onDelete: "cascade",
  }),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CorrectionExample = typeof correctionExamples.$inferSelect;
export type NewCorrectionExample = typeof correctionExamples.$inferInsert;
