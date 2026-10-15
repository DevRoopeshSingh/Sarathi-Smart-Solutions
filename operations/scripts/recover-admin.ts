import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";
import { migrationConnectionString } from "./migrate";

async function main() {
  const organizationSlug = process.env.SARATHI_ORGANIZATION_SLUG ?? "sarathi";
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(organizationSlug))
    throw new Error("Invalid organization slug.");
  const email = (process.env.SARATHI_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Set SARATHI_ADMIN_EMAIL.");
  if (process.env.SARATHI_RESET_MFA && process.env.SARATHI_RESET_MFA !== "1")
    throw new Error("SARATHI_RESET_MFA must be 1 or omitted.");
  if (process.stdin.isTTY) throw new Error("Supply the new password through standard input.");
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) {
    input += String(chunk);
    if (input.length > 1024) throw new Error("Password input is too long.");
  }
  const password = input.replace(/\r?\n$/, "");
  if (password.length < 12 || password.length > 128 || /[\r\n]/.test(password))
    throw new Error("Password must be one line of 12–128 characters.");
  const passwordHash = await hashPassword(password);
  const pool = new Pool({
    connectionString: migrationConnectionString(),
    max: 1,
    connectionTimeoutMillis: 5000
  });
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const identity = await client.query<{ id: string }>(
        `SELECT identity.id FROM sarathi.auth_users identity
        JOIN sarathi.users actor ON actor.identity_subject=identity.id
        JOIN sarathi.organization_memberships m ON m.user_id=actor.id AND m.active AND m.role='ADMIN'
        JOIN sarathi.organizations o ON o.id=m.organization_id AND o.active
        WHERE identity.email=$1 AND o.slug=$2 AND actor.active AND actor.role='ADMIN' FOR UPDATE OF identity, actor, m`,
        [email, organizationSlug]
      );
      const id = identity.rows[0]?.id;
      if (!id) throw new Error("No active administrator matches this email.");
      const updated = await client.query(
        `UPDATE sarathi.auth_accounts SET password=$1, updated_at=now()
        WHERE user_id=$2 AND provider_id='credential'`,
        [passwordHash, id]
      );
      if (updated.rowCount !== 1) throw new Error("Administrator credential state is invalid.");
      await client.query("DELETE FROM sarathi.auth_sessions WHERE user_id=$1", [id]);
      // Invalidate pending second-factor challenges and device trust as well as sessions.
      await client.query(
        `DELETE FROM sarathi.auth_verifications WHERE value=$1 OR identifier IN
        (SELECT '2fa-attempts-' || identifier FROM sarathi.auth_verifications WHERE value=$1)`,
        [id]
      );
      if (process.env.SARATHI_RESET_MFA === "1") {
        await client.query("DELETE FROM sarathi.auth_two_factors WHERE user_id=$1", [id]);
        await client.query(
          "UPDATE sarathi.auth_users SET two_factor_enabled=false, updated_at=now() WHERE id=$1",
          [id]
        );
      }
      await client.query("COMMIT");
      console.log(
        "Administrator password replaced; sessions and pending verification challenges revoked."
      );
      if (process.env.SARATHI_RESET_MFA === "1")
        console.log("Authenticator reset; enroll a new authenticator after sign-in.");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Administrator recovery failed. Check owner access, the active admin email, and password input."
  );
  process.exitCode = 1;
});
