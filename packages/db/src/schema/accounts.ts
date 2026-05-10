import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/** type ∈ {checking, savings, credit_card, investment, brokerage, crypto_exchange, crypto_wallet, other} */
/** source ∈ {manual, csv, ofx, pluggy, teller, plaid, schwab, gmail, ccxt, zerion} */
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  institution: text("institution"),
  currency: text("currency").notNull(),
  source: text("source").notNull(),
  sourceAccountId: text("source_account_id"),
  metadata: jsonb("metadata"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
