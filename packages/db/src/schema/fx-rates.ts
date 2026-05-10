import { date, numeric, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

/** Taxa do par "BASE/QUOTE" no dia. Ex: pair="USD/BRL", rate=5.10 */
export const fxRates = pgTable(
  "fx_rates",
  {
    date: date("date").notNull(),
    pair: text("pair").notNull(),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    source: text("source").notNull().default("bcb"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.date, t.pair] }) }),
);

export type FxRate = typeof fxRates.$inferSelect;
export type NewFxRate = typeof fxRates.$inferInsert;
