import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import { migrationConnectionString, pendingMigrations, readMigrations } from "../scripts/migrate";

test("production migrations never fall back to the runtime pool connection", () => {
  const runtime = "postgresql://runtime@localhost/app";
  const owner = "postgresql://owner@localhost/app";
  assert.throws(() => migrationConnectionString({ NODE_ENV: "production", DATABASE_URL: runtime }));
  assert.equal(
    migrationConnectionString({
      NODE_ENV: "production",
      DATABASE_URL: runtime,
      DATABASE_MIGRATION_URL: owner
    }),
    owner
  );
  assert.equal(
    migrationConnectionString({ NODE_ENV: "development", DATABASE_URL: runtime }),
    runtime
  );
  assert.throws(() => migrationConnectionString({ NODE_ENV: "test" }));
});

test("numbered migrations accept the existing Phase 1 ledger and are repeatable", async () => {
  const migrations = await readMigrations();
  assert.equal(migrations[0].name, "commercial_foundation");
  assert.equal(
    pendingMigrations(migrations, [{ version: 1, name: "commercial_foundation" }]).length,
    migrations.length - 1
  );
  assert.deepEqual(pendingMigrations(migrations, migrations), []);
});

test("migration ledger rejects gaps, unknown versions and changed names", async () => {
  const migrations = await readMigrations();
  for (const history of [
    [{ version: 2, name: migrations[1]?.name || "unknown" }],
    [{ version: 1, name: "renamed" }],
    [...migrations, { version: migrations.length + 1, name: "unknown" }]
  ])
    assert.throws(() => pendingMigrations(migrations, history), /Unexpected migration history/);
});

test("migration files reject missing numbers and missing atomic transaction", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sarathi-migrations-"));
  try {
    await writeFile(join(directory, "002_missing.sql"), "BEGIN;\nCOMMIT;\n");
    await assert.rejects(readMigrations(directory), /no gaps/);
    await rm(join(directory, "002_missing.sql"));
    await writeFile(join(directory, "001_invalid.sql"), "SELECT 1;");
    await assert.rejects(readMigrations(directory), /BEGIN\/COMMIT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("migration checksums detect edits even when version and name stay unchanged", async () => {
  const migrations = await readMigrations();
  assert.equal(
    migrations[0].checksum,
    createHash("sha256").update(migrations[0].sql).digest("hex")
  );
  const changed = [{ ...migrations[0], checksum: "0".repeat(64) }, ...migrations.slice(1)];
  assert.throws(() => pendingMigrations(migrations, changed), /Applied migration content changed/);
  assert.deepEqual(pendingMigrations(migrations, migrations), []);
});
