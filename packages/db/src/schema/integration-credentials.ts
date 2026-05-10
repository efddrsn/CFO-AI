import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Tokens de integração — encryptedToken via pgcrypto/Supabase Vault em produção. */
export const integrationCredentials = pgTable("integration_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(), // pluggy | teller | gmail | schwab | binance | ...
  accountLink: text("account_link"), // ex: pluggy item_id, teller enrollment_id
  encryptedToken: text("encrypted_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastRefreshAt: timestamp("last_refresh_at", { withTimezone: true }),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IntegrationCredential = typeof integrationCredentials.$inferSelect;
export type NewIntegrationCredential = typeof integrationCredentials.$inferInsert;
