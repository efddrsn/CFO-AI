import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** severity ∈ {info, warning, critical} */
/** kind ∈ {budget_exceeded, opportunity, risk, consent_expiring, anomaly, ...} */
export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  severity: text("severity").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  context: jsonb("context"), // dados estruturados pra retomada
  triggeredAt: timestamp("triggered_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  actionTaken: text("action_taken"),
});

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
