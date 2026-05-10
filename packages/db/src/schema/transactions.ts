import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { accounts } from "./accounts.js";
import { categories } from "./categories.js";
import { syncLogs } from "./sync-logs.js";

/** status ∈ {pending_sync, active, rejected} */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    // datas
    date: date("date").notNull(), // data efetiva da transação
    postedDate: date("posted_date"), // data em que apareceu no extrato

    // valores: armazenados em cents (integer) pra evitar float
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),

    // descrições
    originalDescription: text("original_description").notNull(),
    description: text("description"), // versão limpa/editada

    // categorização
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    subcategoryId: uuid("subcategory_id").references(() => categories.id, {
      onDelete: "set null",
    }),

    counterparty: text("counterparty"),
    notes: text("notes"),

    // parcelas (Argus-inspired)
    installmentNumber: integer("installment_number"),
    installmentTotal: integer("installment_total"),
    installmentGroupId: uuid("installment_group_id"),

    // proveniência
    sourceTxnId: text("source_txn_id"), // id externo (Pluggy/Teller/etc)
    rawJson: jsonb("raw_json"),

    // workflow
    syncLogId: uuid("sync_log_id").references(() => syncLogs.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("pending_sync"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // dedup forte quando temos id da fonte
    uniqSourceTxn: uniqueIndex("uniq_account_source_txn")
      .on(t.accountId, t.sourceTxnId)
      .where(sql`${t.sourceTxnId} is not null`),
  }),
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

/** Tags livres acima das categorias. source ∈ {user, agent, rule} */
export const transactionTags = pgTable("transaction_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
  source: text("source").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TransactionTag = typeof transactionTags.$inferSelect;
export type NewTransactionTag = typeof transactionTags.$inferInsert;
