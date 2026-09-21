import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const required = ["initdb", "pg_ctl", "psql"];
const candidates = [process.env.PG_BINDIR, "/opt/homebrew/opt/postgresql@18/bin"];
const pgConfig = spawnSync("pg_config", ["--bindir"], { encoding: "utf8" });
if (pgConfig.status === 0) candidates.push(pgConfig.stdout.trim());
const binDir = candidates.find(
  (candidate) => candidate && required.every((name) => existsSync(join(candidate, name)))
);
if (!binDir)
  throw new Error(
    "PostgreSQL server binaries are required. Set PG_BINDIR to the directory containing initdb, pg_ctl and psql. No database tests ran."
  );

const temporary = mkdtempSync("/tmp/sarathi-pg-");
chmodSync(temporary, 0o700);
const data = join(temporary, "data");
// A short socket path avoids PostgreSQL/macOS Unix socket path length limits.
const socket = temporary;
const log = join(temporary, "postgres.log");
let initialized = false;
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))),
  PGHOST: socket,
  PGPORT: "5432",
  PGUSER: "sarathi_test",
  PGDATABASE: "postgres"
};

function run(binary, args, { input, allowFailure = false } = {}) {
  const result = spawnSync(join(binDir, binary), args, {
    encoding: "utf8",
    env,
    input,
    timeout: 60_000
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0)
    throw new Error(`${binary} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  return result;
}

function sql(input, allowFailure = false) {
  return run(
    "psql",
    [
      "-X",
      "--no-psqlrc",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-h",
      socket,
      "-U",
      "sarathi_test",
      "-d",
      "postgres"
    ],
    { input, allowFailure }
  );
}

function cleanup() {
  if (initialized) {
    const stopped = run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], {
      allowFailure: true
    });
    if (stopped.status !== 0 && existsSync(join(data, "postmaster.pid"))) {
      throw new Error(
        `Unable to stop temporary PostgreSQL cluster. Retained for cleanup: ${temporary}\n${stopped.stderr}`
      );
    }
  }
  rmSync(temporary, { recursive: true, force: true });
}

async function verifyFreezeConcurrency() {
  const fixture = sql(`
    WITH actor AS (INSERT INTO sarathi.users(identity_subject, display_name, role) VALUES ('race-actor', 'Race actor', 'ADMIN') RETURNING id),
    customer AS (INSERT INTO sarathi.customers(name, phone) VALUES ('Race customer', '1') RETURNING id),
    project AS (INSERT INTO sarathi.projects(customer_id, name, site_address) SELECT id, 'Race project', 'Site' FROM customer RETURNING id, customer_id)
    INSERT INTO sarathi.quotations(project_id, customer_id, version, created_by, customer_name, customer_phone, site_address, subtotal, total, recommended_advance, terms, valid_until)
    SELECT project.id, project.customer_id, 1, actor.id, 'Race customer', '1', 'Site', 0, 0, 0, '', CURRENT_DATE FROM project CROSS JOIN actor RETURNING id;
  `).stdout.match(/^\d+$/m);
  if (!fixture) throw new Error("Unable to create concurrency fixture.");
  const quoteId = fixture[0];
  function client(applicationName) {
    const child = spawn(
      join(binDir, "psql"),
      ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-h", socket, "-U", "sarathi_test", "-d", "postgres"],
      { env: { ...env, PGAPPNAME: applicationName }, stdio: ["pipe", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
    const done = new Promise((resolveResult) => {
      child.on("error", (error) => {
        clearTimeout(timer);
        resolveResult({ code: -1, stdout, stderr: String(error) });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolveResult({ code, stdout, stderr });
      });
    });
    return { child, done, output: () => stdout };
  }
  async function until(check, description) {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      if (check()) return;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
    }
    throw new Error(`Timed out waiting for ${description}.`);
  }
  const freezer = client("sarathi_test_freezer");
  let itemWriter;
  try {
    freezer.child.stdin.write(
      `BEGIN; UPDATE sarathi.quotations SET status = 'SENT', frozen_at = CURRENT_TIMESTAMP WHERE id = ${quoteId}; SELECT 'freeze-lock-held';\n`
    );
    await until(() => freezer.output().includes("freeze-lock-held"), "quotation freeze lock");
    itemWriter = client("sarathi_test_item_race");
    itemWriter.child.stdin.end(
      `INSERT INTO sarathi.quotation_items(quotation_id, position, description, unit, quantity, unit_sell) VALUES (${quoteId}, 1, 'Racing item', 'piece', 1, 1);\n`
    );
    await until(
      () =>
        sql(
          "SELECT count(*) FROM pg_stat_activity WHERE application_name = 'sarathi_test_item_race' AND wait_event_type = 'Lock';"
        ).stdout.trim() === "1",
      "item writer to block on the frozen parent"
    );
    freezer.child.stdin.end("COMMIT;\n");
    const freezeResult = await freezer.done;
    const itemResult = await itemWriter.done;
    if (freezeResult.code !== 0)
      throw new Error(`Freeze transaction failed: ${freezeResult.stderr}`);
    if (
      itemResult.code === 0 ||
      !itemResult.stderr.includes("Frozen quotation items cannot be changed")
    )
      throw new Error(`Concurrent item mutation was not rejected: ${itemResult.stderr}`);
    if (
      sql(
        `SELECT count(*) FROM sarathi.quotation_items WHERE quotation_id = ${quoteId};`
      ).stdout.trim() !== "0"
    )
      throw new Error("Concurrent item mutation persisted after freezing.");
  } finally {
    freezer.child.kill();
    itemWriter?.child.kill();
    await freezer.done;
    if (itemWriter) await itemWriter.done;
  }
}

try {
  run("initdb", [
    "-D",
    data,
    "-U",
    "sarathi_test",
    "--auth-local=trust",
    "--auth-host=reject",
    "--no-locale",
    "--encoding=UTF8"
  ]);
  initialized = true;
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    log,
    "-o",
    `-c listen_addresses='' -c unix_socket_directories='${socket}' -c unix_socket_permissions=0700`,
    "-w",
    "start"
  ]);
  const migration = readFileSync(
    resolve(root, "database/migrations/001_commercial_foundation.sql"),
    "utf8"
  );
  const failingMigration = migration.replace(/COMMIT;\s*$/, "SELECT 1 / 0;\nCOMMIT;");
  const rollbackResult = sql(failingMigration, true);
  if (rollbackResult.status === 0 || !rollbackResult.stderr.includes("division by zero"))
    throw new Error("Atomic migration failure probe did not fail as expected.");
  if (sql("SELECT count(*) FROM pg_namespace WHERE nspname = 'sarathi';").stdout.trim() !== "0")
    throw new Error("Failed migration left schema objects behind.");
  sql(migration);
  const repeat = sql(migration, true);
  if (repeat.status === 0 || !repeat.stderr.includes("already exists"))
    throw new Error("Duplicate migration was unexpectedly accepted.");
  const tests = sql(
    readFileSync(resolve(root, "database/tests/commercial_foundation.sql"), "utf8")
  );
  if (!tests.stdout.includes("Commercial foundation constraints passed."))
    throw new Error("Database tests did not finish.");
  await verifyFreezeConcurrency();
  console.log(
    "Database checks passed: atomic migration rollback, version record, duplicate migration rejection, monetary constraints, quote immutability, concurrent freeze/item locking, lifecycle updates, cross-project payment references, append-only receipts/refunds/history and TRUNCATE guards."
  );
} finally {
  cleanup();
}
