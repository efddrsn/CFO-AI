import {
  bigint,
  boolean,
  date,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** type ∈ {emergency_fund, purchase, retirement, debt_payoff, freedom_number, custom} */
export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  targetAmountCents: bigint("target_amount_cents", { mode: "number" }).notNull(),
  currency: text("currency").notNull(),
  targetDate: date("target_date"),
  currentAmountCents: bigint("current_amount_cents", { mode: "number" })
    .notNull()
    .default(0),
  onTrack: boolean("on_track").notNull().default(true),
  strategy: jsonb("strategy"), // monthly_contribution, rate, allocation, etc
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
