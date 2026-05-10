import { jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

/** kind ∈ {new_category, new_subcategory, split, merge, rename, archive} */
/** status ∈ {pending, accepted, rejected, dismissed, auto_applied} */
export const categoryProposals = pgTable("category_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(), // dados estruturados da proposta
  rationaleMd: text("rationale_md").notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 3 }), // 0.000-1.000
  status: text("status").notNull().default("pending"),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: uuid("decided_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

export type CategoryProposal = typeof categoryProposals.$inferSelect;
export type NewCategoryProposal = typeof categoryProposals.$inferInsert;
