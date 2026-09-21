import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { authSchema } from "./auth-schema";
import { readServerEnvironment } from "./env";

const state = globalThis as typeof globalThis & { sarathiPool?: Pool };

export function getPool(): Pool {
  if (!state.sarathiPool) {
    state.sarathiPool = new Pool({
      connectionString: readServerEnvironment().databaseUrl,
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      application_name: "sarathi-operations"
    });
    state.sarathiPool.on("error", () => {
      // Driver errors can contain deployment addresses; avoid leaking connection details.
      console.error("An idle operations database connection failed.");
    });
  }
  return state.sarathiPool;
}

export function getDatabase() {
  return drizzle(getPool(), { schema: authSchema });
}
