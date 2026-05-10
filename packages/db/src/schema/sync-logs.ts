import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { accounts } from "./accounts.js";
import { users } from "./users.js";

/** status ∈ {running, pending_review, approved, rejected, failed} */
/** source ∈ {csv, ofx, pluggy, teller, plaid, schwab, gmail, ccxt, zerion} */
export const syncLogs = pgTable("sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  accountId: uuid("account_id").references(() => accounts.id, {
    onDelete: "cascade",
  }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  summary: jsonb("summary"), // { created, updated, divergences, total }
  diff: jsonb("diff"), // preview pra UI de aprovação
  errorMessage: text("error_message"),
  approvedBy: uuid("approved_by").references(() => users.id, {
    onDelete: "set null",
  }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

export type SyncLog = typeof syncLogs.$inferSelect;
export type NewSyncLog = typeof syncLogs.$inferInsert;
