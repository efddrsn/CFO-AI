import { date, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Premissas/parâmetros pra projeção. Ex: cdi_rate, usd_brl_forecast, salary_growth. */
export const assumptions = pgTable("assumptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Assumption = typeof assumptions.$inferSelect;
export type NewAssumption = typeof assumptions.$inferInsert;
