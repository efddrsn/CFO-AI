import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const projections = pgTable("projections", {
  id: uuid("id").primaryKey().defaultRandom(),
  scenarioName: text("scenario_name").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  horizonMonths: integer("horizon_months").notNull(),
  data: jsonb("data").notNull(),
  narrative: text("narrative"),
});

export type Projection = typeof projections.$inferSelect;
export type NewProjection = typeof projections.$inferInsert;
