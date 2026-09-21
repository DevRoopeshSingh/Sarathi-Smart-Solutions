import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";

async function main() {
  const email = (process.env.SARATHI_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = (process.env.SARATHI_ADMIN_NAME ?? "").trim();
  const databaseUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (
    !databaseUrl ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !name ||
    name.length > 200
  ) {
    throw new Error(
      "Set DATABASE_MIGRATION_URL (or DATABASE_URL), SARATHI_ADMIN_EMAIL and SARATHI_ADMIN_NAME."
    );
  }
  if (process.stdin.isTTY)
    throw new Error("Supply the password through standard input; never use a command argument.");
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) {
    input += String(chunk);
    if (input.length > 1024) throw new Error("Password input is too long.");
  }
  const password = input.replace(/\r?\n$/, "");
  if (password.length < 12 || password.length > 128 || /[\r\n]/.test(password)) {
    throw new Error("Password must be a single line of 12–128 characters.");
  }
  // Public, pinned library export; use the same scrypt format as normal Better Auth login.
  // https://github.com/better-auth/better-auth/blob/v1.7.5/packages/better-auth/src/crypto/password.ts
  const passwordHash = await hashPassword(password);
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const identity = randomUUID();
    await client.query(
      "INSERT INTO sarathi.auth_users (id, name, email, email_verified) VALUES ($1, $2, $3, false)",
      [identity, name, email]
    );
    await client.query(
      "INSERT INTO sarathi.auth_accounts (id, user_id, account_id, provider_id, password) VALUES ($1, $2, $2, 'credential', $3)",
      [randomUUID(), identity, passwordHash]
    );
    await client.query(
      "INSERT INTO sarathi.users (identity_subject, display_name, role, active) VALUES ($1, $2, 'ADMIN', true)",
      [identity, name]
    );
    await client.query("COMMIT");
    console.log("Administrator created. Existing accounts are never changed by this command.");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new Error("Account already exists; no credentials or permissions were changed.");
    }
    throw new Error("Administrator provisioning failed; the transaction was rolled back.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Administrator provisioning failed.");
  process.exitCode = 1;
});
