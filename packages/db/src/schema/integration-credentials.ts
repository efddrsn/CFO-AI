import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Tokens de integração.
 *
 * Por enquanto `encrypted_token` e `refresh_token` ficam plaintext no DB
 * (single-user). Pra multi-tenant: passar por Supabase Vault / pgcrypto.
 *
 * Forma por provider:
 * - pluggy:  accountLink = item_id; encryptedToken vazio (Pluggy não retorna
 *            token reutilizável — basta o item_id)
 * - gmail:   accountLink = email do usuário; encryptedToken = access_token;
 *            refreshToken = OAuth refresh token; scopes = JSON array de scopes
 * - teller / schwab / binance / ...: a definir
 */
export const integrationCredentials = pgTable("integration_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  accountLink: text("account_link"),
  encryptedToken: text("encrypted_token").notNull().default(""),
  refreshToken: text("refresh_token"),
  scopes: text("scopes"), // JSON string array
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastRefreshAt: timestamp("last_refresh_at", { withTimezone: true }),
  /** Token genérico do último sync — ex: Gmail historyId pra incremental */
  syncCursor: text("sync_cursor"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IntegrationCredential = typeof integrationCredentials.$inferSelect;
export type NewIntegrationCredential = typeof integrationCredentials.$inferInsert;
