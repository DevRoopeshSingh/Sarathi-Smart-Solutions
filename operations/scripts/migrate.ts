import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import pg from "pg";

export type Migration = { version: number; name: string; filename: string; sql: string };
export type AppliedMigration = { version: number; name: string };
const directory = fileURLToPath(new URL("../../database/migrations/", import.meta.url));

export async function readMigrations(path = directory): Promise<Migration[]> {
  const files = (await readdir(path)).filter((name) => name.endsWith(".sql")).sort();
  const migrations: Migration[] = [];
  for (const filename of files) {
    const match = /^(\d{3})_([a-z][a-z0-9_]*)\.sql$/.exec(filename);
    if (!match) throw new Error(`Invalid migration filename: ${filename}`);
    const version = Number(match[1]);
    if (version !== migrations.length + 1)
      throw new Error(`Migration sequence must start at 001 with no gaps: ${filename}`);
    const sql = await readFile(resolve(path, filename), "utf8");
    if (!/^\s*BEGIN;/i.test(sql) || !/COMMIT;\s*$/i.test(sql))
      throw new Error(`Migration must contain its own BEGIN/COMMIT transaction: ${filename}`);
    migrations.push({ version, name: match[2], filename, sql });
  }
  if (!migrations.length) throw new Error("No numbered SQL migrations found.");
  return migrations;
}

export function pendingMigrations(
  migrations: Migration[],
  applied: AppliedMigration[]
): Migration[] {
  for (const [index, recorded] of applied.entries()) {
    const expected = migrations[index];
    if (recorded.version !== index + 1 || !expected || recorded.name !== expected.name)
      throw new Error(
        `Unexpected migration history at version ${recorded.version}; refusing schema changes.`
      );
  }
  return migrations.slice(applied.length);
}

export async function migrate(connectionString: string): Promise<string[]> {
  const migrations = await readMigrations();
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    // Session lock and every migration use the same connection; SQL files own their transactions.
    await client.query("SELECT pg_advisory_lock(1935766113, 1)");
    const exists = await client.query(
      "SELECT to_regclass('sarathi.schema_migrations') AS table_name"
    );
    const applied: AppliedMigration[] = exists.rows[0].table_name
      ? (await client.query("SELECT version, name FROM sarathi.schema_migrations ORDER BY version"))
          .rows
      : [];
    const pending = pendingMigrations(migrations, applied);
    for (const migration of pending) {
      await client.query(migration.sql);
      const history = await client.query(
        "SELECT version, name FROM sarathi.schema_migrations ORDER BY version"
      );
      if (history.rows.length !== migration.version)
        throw new Error(`Migration did not record its version: ${migration.filename}`);
      pendingMigrations(migrations, history.rows);
    }
    return pending.map((migration) => migration.filename);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.query("SELECT pg_advisory_unlock(1935766113, 1)").catch(() => undefined);
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const connectionString = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Database connection is required.");
    const applied = await migrate(connectionString);
    console.log(
      applied.length ? `Applied: ${applied.join(", ")}` : "Database migrations are current."
    );
  } catch {
    console.error("Migration failed; check database access and migration history.");
    process.exitCode = 1;
  }
}
