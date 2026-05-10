import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { categories } from "./categories.js";
import { categoryProposals } from "./category-proposals.js";

/**
 * Histórico de mudanças em categorias — preserva integridade de relatórios passados.
 * Queries históricas resolvem categorias as-of date.
 */
export const categoryHistory = pgTable("category_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  changeType: text("change_type").notNull(), // create, rename, split, merge, archive
  before: jsonb("before"),
  after: jsonb("after"),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  proposalId: uuid("proposal_id").references(() => categoryProposals.id, {
    onDelete: "set null",
  }),
});

export type CategoryHistory = typeof categoryHistory.$inferSelect;
export type NewCategoryHistory = typeof categoryHistory.$inferInsert;
