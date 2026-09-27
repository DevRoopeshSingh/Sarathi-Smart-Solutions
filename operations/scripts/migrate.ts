import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";

export type Migration = {
  version: number;
  name: string;
  filename: string;
  sql: string;
  checksum: string;
};
export type AppliedMigration = { version: number; name: string; checksum?: string | null };
export class MigrationIntegrityError extends Error {}
const directory = fileURLToPath(new URL("../../database/migrations/", import.meta.url));

export function migrationConnectionString(source: NodeJS.ProcessEnv = process.env): string {
  // Transaction poolers cannot retain the session advisory lock used by this runner.
  if (source.NODE_ENV === "production" && !source.DATABASE_MIGRATION_URL) {
    throw new Error("Production migrations require DATABASE_MIGRATION_URL.");
  }
  const connectionString = source.DATABASE_MIGRATION_URL || source.DATABASE_URL;
  if (!connectionString) throw new Error("Database connection is required.");
  return connectionString;
}

export async function readMigrations(path = directory): Promise<Migration[]> {
  const files = (await readdir(path)).filter((name) => name.endsWith(".sql")).sort();
  const migrations: Migration[] = [];
  for (const filename of files) {
    const match = /^(\d{3})_([a-z][a-z0-9_]*)\.sql$/.exec(filename);
    if (!match) throw new Error(`Invalid migration filename: ${filename}`);
    const version = Number(match[1]);
    if (version !== migrations.length + 1)
      throw new Error(`Migration sequence must start at 001 with no gaps: ${filename}`);
    const bytes = await readFile(resolve(path, filename));
    const sql = bytes.toString("utf8");
    if (!/^\s*BEGIN;/i.test(sql) || !/COMMIT;\s*$/i.test(sql))
      throw new Error(`Migration must contain its own BEGIN/COMMIT transaction: ${filename}`);
    migrations.push({
      version,
      name: match[2],
      filename,
      sql,
      checksum: createHash("sha256").update(bytes).digest("hex")
    });
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
      throw new MigrationIntegrityError(
        `Unexpected migration history at version ${recorded.version}; refusing schema changes.`
      );
    if (recorded.checksum != null && recorded.checksum !== expected.checksum)
      throw new MigrationIntegrityError(
        `Applied migration content changed: ${expected.filename}. Restore the applied file and create a new migration.`
      );
  }
  return migrations.slice(applied.length);
}

export async function migrate(
  connectionString: string,
  options: { directory?: string; baselineChecksums?: boolean } = {}
): Promise<string[]> {
  const migrations = await readMigrations(options.directory);
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    // One connection serializes runners and commits each migration with its checksum.
    await client.query("SELECT pg_advisory_lock(1935766113, 1)");
    const exists = await client.query(
      "SELECT to_regclass('sarathi.schema_migrations') AS table_name"
    );
    let applied: AppliedMigration[] = [];
    if (exists.rows[0].table_name) {
      const column = await client.query(`SELECT EXISTS (SELECT 1 FROM pg_attribute
        WHERE attrelid='sarathi.schema_migrations'::regclass AND attname='checksum_sha256'
        AND NOT attisdropped) AS present`);
      applied = (
        await client.query(`SELECT version, name, ${column.rows[0].present ? "checksum_sha256" : "NULL::text"} AS checksum
        FROM sarathi.schema_migrations ORDER BY version`)
      ).rows;
    }
    const pending = pendingMigrations(migrations, applied);
    const missing = applied.filter((migration) => migration.checksum == null);
    if (missing.length) {
      if (!options.baselineChecksums)
        throw new MigrationIntegrityError(
          "Existing migration history has no checksums. Verify applied SQL against the deployed release, then run migrate --baseline-checksums once."
        );
      await client.query("BEGIN");
      await ensureChecksumColumn(client);
      for (const recorded of missing) {
        await client.query(
          "UPDATE sarathi.schema_migrations SET checksum_sha256=$1 WHERE version=$2",
          [migrations[recorded.version - 1].checksum, recorded.version]
        );
      }
      await client.query("COMMIT");
    }
    for (const migration of pending) {
      await client.query("BEGIN");
      // Keep the files directly executable with psql, but move their outer commit
      // after ledger validation/checksum recording so failures roll back the DDL too.
      await client.query(migration.sql.replace(/^\s*BEGIN;/i, "").replace(/COMMIT;\s*$/i, ""));
      await ensureChecksumColumn(client);
      const history = await client.query(
        "SELECT version, name, checksum_sha256 AS checksum FROM sarathi.schema_migrations ORDER BY version"
      );
      if (history.rows.length !== migration.version)
        throw new MigrationIntegrityError(
          `Migration did not record its version: ${migration.filename}`
        );
      pendingMigrations(migrations, history.rows);
      if (history.rows.slice(0, -1).some((recorded: AppliedMigration) => recorded.checksum == null))
        throw new MigrationIntegrityError(
          `Migration removed a historical checksum: ${migration.filename}`
        );
      await client.query(
        "UPDATE sarathi.schema_migrations SET checksum_sha256=$1 WHERE version=$2",
        [migration.checksum, migration.version]
      );
      await client.query("COMMIT");
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

async function ensureChecksumColumn(client: pg.Client) {
  // Runner-owned metadata extends the existing ledger, not the business schema.
  await client.query(`ALTER TABLE sarathi.schema_migrations ADD COLUMN IF NOT EXISTS
    checksum_sha256 text CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$')`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const connectionString = migrationConnectionString();
    const args = process.argv.slice(2);
    if (args.some((argument) => argument !== "--baseline-checksums"))
      throw new MigrationIntegrityError(
        "Unknown migration option; supported option: --baseline-checksums."
      );
    const applied = await migrate(connectionString, {
      baselineChecksums: args.includes("--baseline-checksums")
    });
    console.log(
      applied.length ? `Applied: ${applied.join(", ")}` : "Database migrations are current."
    );
  } catch (error) {
    console.error(
      error instanceof MigrationIntegrityError
        ? error.message
        : "Migration failed; check database access and migration history."
    );
    process.exitCode = 1;
  }
}
