import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { temporaryHttps } from "./lib/temporary-https.mjs";
import { temporaryPostgres } from "./lib/temporary-postgres.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const operations = fileURLToPath(new URL("../operations/", import.meta.url));
if (!existsSync(new URL("../operations/.next/BUILD_ID", import.meta.url)))
  throw new Error("Build operations first: npm run operations:build");
const cluster = temporaryPostgres();
const baseURL = "https://127.0.0.1:3107";
let tls;
const env = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith("PG") &&
        !key.startsWith("DATABASE_") &&
        !key.startsWith("BETTER_AUTH_") &&
        !key.startsWith("VERCEL") &&
        key !== "DB_POOL_MAX" &&
        key !== "PUBLIC_SITE_URL"
    )
  ),
  DATABASE_URL: cluster.connectionString,
  DATABASE_MIGRATION_URL: cluster.connectionString,
  BETTER_AUTH_URL: baseURL,
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  OPERATIONS_TEST_URL: baseURL,
  OPERATIONS_TEST_ISOLATED: "1",
  OPERATIONS_TEST_PASSWORD: randomBytes(32).toString("base64url"),
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1"
};
let server;
let serverClosed;
let cleaned = false;
function run(command, args, cwd = operations) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} failed (${code}).`))
    );
  });
}
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    const timer = setTimeout(() => server.kill("SIGKILL"), 5000);
    await serverClosed;
    clearTimeout(timer);
  }
  await tls?.cleanup();
  cluster.cleanup();
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => void cleanup().finally(() => process.exit(1)));
try {
  tls = await temporaryHttps(3107, 3108);
  env.NODE_EXTRA_CA_CERTS = tls.certificate;
  // Both processes race on a new database; the advisory lock must serialize them.
  await Promise.all([
    run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/migrate.ts"]),
    run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/migrate.ts"])
  ]);
  await run(process.execPath, [
    "--conditions=react-server",
    "--import",
    "tsx",
    "scripts/migrate.ts"
  ]);
  await run(process.execPath, [
    "--conditions=react-server",
    "--import",
    "tsx",
    "tests/runtime-fixtures.ts"
  ]);
  cluster.applyRuntimeGrants(
    fileURLToPath(new URL("../database/runtime-grants.sql", import.meta.url))
  );
  const runtimeConnection = new URL(cluster.connectionString);
  runtimeConnection.username = "sarathi_runtime_test";
  env.DATABASE_URL = runtimeConnection.toString();
  let serverListening = false;
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3108"],
    { cwd: operations, env, stdio: ["ignore", "pipe", "inherit"] }
  );
  server.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    if (String(chunk).includes("Ready in")) serverListening = true;
  });
  serverClosed = new Promise((resolve) => {
    server.once("close", resolve);
    server.once("error", resolve);
  });
  const deadline = Date.now() + 40_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Operations server exited before readiness.");
    try {
      const response = await fetch("http://127.0.0.1:3108/admin/login");
      if (serverListening && response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error("Operations server did not become ready.");
  await run(process.execPath, [
    "--conditions=react-server",
    "--import",
    "tsx",
    "--test",
    "tests/runtime-security.ts"
  ]);
  await run(process.execPath, [
    "--conditions=react-server",
    "--import",
    "tsx",
    "--test",
    "tests/runtime-business.ts"
  ]);
  await run(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "operations/playwright.config.mjs"
    ],
    root
  );
  console.log(
    "Operations migration, HTTP security and browser checks passed against an isolated PostgreSQL cluster."
  );
} finally {
  await cleanup();
}
