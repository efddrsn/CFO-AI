import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./categories.js";

/** matchType ∈ {regex, contains, counterparty, mcc} */
export const rules = pgTable("rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  priority: integer("priority").notNull().default(0),
  matchType: text("match_type").notNull(),
  pattern: text("pattern").notNull(),
  setCategoryId: uuid("set_category_id").references(() => categories.id, {
    onDelete: "cascade",
  }),
  setSubcategoryId: uuid("set_subcategory_id").references(() => categories.id, {
    onDelete: "cascade",
  }),
  setTags: jsonb("set_tags").$type<string[]>(),
  isActive: boolean("is_active").notNull().default(true),
  source: text("source").notNull().default("user"), // user | auto_from_correction
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
