import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import pg from "pg";
import { migrate, readMigrations } from "../scripts/migrate";

if (process.env.OPERATIONS_TEST_ISOLATED !== "1")
  throw new Error("Use the isolated runtime harness.");
const owner = new pg.Client({ connectionString: process.env.DATABASE_MIGRATION_URL });
await owner.connect();
const database = `migration_test_${randomUUID().replaceAll("-", "")}`;
await owner.query(`CREATE DATABASE "${database}"`);
const connection = new URL(process.env.DATABASE_MIGRATION_URL!);
connection.pathname = `/${database}`;
const client = new pg.Client({ connectionString: connection.toString() });
await client.connect();
const directory = await mkdtemp(join(tmpdir(), "sarathi-checksums-"));
const first = `BEGIN;
CREATE SCHEMA sarathi;
CREATE TABLE sarathi.schema_migrations(version integer PRIMARY KEY, name text NOT NULL);
CREATE TABLE sarathi.fixture(id integer PRIMARY KEY);
INSERT INTO sarathi.schema_migrations VALUES (1, 'foundation');
COMMIT;`;
const second = `BEGIN;
INSERT INTO sarathi.fixture VALUES (2);
INSERT INTO sarathi.schema_migrations(version,name) VALUES (2, 'followup');
COMMIT;`;
const run = (baselineChecksums = false) =>
  migrate(connection.toString(), { directory, baselineChecksums });
beforeEach(async () => {
  await client.query("DROP SCHEMA IF EXISTS sarathi CASCADE");
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory);
  await writeFile(join(directory, "001_foundation.sql"), first);
  await writeFile(join(directory, "002_followup.sql"), second);
});
after(async () => {
  await client.end();
  await owner.query(`DROP DATABASE "${database}"`);
  await owner.end();
  await rm(directory, { recursive: true, force: true });
});

test("fresh and concurrent runners commit matching checksums exactly once", async () => {
  const results = await Promise.all([run(), run()]);
  assert.equal(results.flat().length, 2);
  assert.deepEqual(await run(), []);
  const rows = (
    await client.query("SELECT checksum_sha256 FROM sarathi.schema_migrations ORDER BY version")
  ).rows;
  assert.deepEqual(
    rows.map((row) => row.checksum_sha256),
    (await readMigrations(directory)).map((migration) => migration.checksum)
  );
  assert.equal(
    (await client.query("SELECT count(*)::int AS total FROM sarathi.fixture")).rows[0].total,
    1
  );
});

test("historical edits stop pending DDL, including with the baseline option", async () => {
  await run();
  await writeFile(
    join(directory, "001_foundation.sql"),
    first.replace("COMMIT;", "-- edited history\nCOMMIT;")
  );
  await writeFile(
    join(directory, "003_later.sql"),
    "BEGIN; CREATE TABLE sarathi.must_not_exist(id int); INSERT INTO sarathi.schema_migrations(version,name) VALUES (3,'later'); COMMIT;"
  );
  await assert.rejects(run(), /Applied migration content changed/);
  await assert.rejects(run(true), /Applied migration content changed/);
  assert.equal(
    (await client.query("SELECT to_regclass('sarathi.must_not_exist') AS name")).rows[0].name,
    null
  );
});

test("legacy history needs an explicit baseline before applying pending migrations", async () => {
  await client.query(first);
  await assert.rejects(run(), /no checksums/);
  assert.equal(
    (await client.query("SELECT count(*)::int AS total FROM sarathi.fixture")).rows[0].total,
    0
  );
  assert.deepEqual(await run(true), ["002_followup.sql"]);
  assert.deepEqual(await run(), []);
  // A newly added file applied directly through psql also requires explicit acknowledgement.
  await client.query("UPDATE sarathi.schema_migrations SET checksum_sha256=NULL WHERE version=2");
  await assert.rejects(run(), /no checksums/);
  await run(true);
  assert.deepEqual(await run(), []);
});

test("missing version metadata rolls back migration DDL and data", async () => {
  await run();
  await writeFile(
    join(directory, "003_broken.sql"),
    "BEGIN; CREATE TABLE sarathi.must_not_exist(id int); INSERT INTO sarathi.fixture VALUES (3); COMMIT;"
  );
  await assert.rejects(run(), /did not record its version/);
  assert.equal(
    (await client.query("SELECT to_regclass('sarathi.must_not_exist') AS name")).rows[0].name,
    null
  );
  assert.equal((await client.query("SELECT 1 FROM sarathi.fixture WHERE id=3")).rowCount, 0);
  assert.equal(
    (await client.query("SELECT count(*)::int AS total FROM sarathi.schema_migrations")).rows[0]
      .total,
    2
  );
});
