import { bigint, date, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { accounts } from "./accounts.js";

export const balances = pgTable(
  "balances",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    balanceCents: bigint("balance_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.accountId, t.date] }) }),
);

export type Balance = typeof balances.$inferSelect;
export type NewBalance = typeof balances.$inferInsert;
