import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

let _db: PostgresJsDatabase<typeof schema> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

function init(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  _client = postgres(url, { max: 10 });
  _db = drizzle(_client, { schema });
  return _db;
}

/**
 * Cliente Drizzle. Lazy: só conecta na primeira query, não no import.
 * Necessário pra que `next build` colete metadata sem exigir DATABASE_URL.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(init(), prop, receiver);
  },
});

export { schema };
export * from "./schema/index";
