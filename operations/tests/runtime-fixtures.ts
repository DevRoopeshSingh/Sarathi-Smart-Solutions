import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";

if (process.env.OPERATIONS_TEST_ISOLATED !== "1" || !process.env.OPERATIONS_TEST_PASSWORD)
  throw new Error("Runtime fixtures may only be created by the isolated test harness.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const password = await hashPassword(process.env.OPERATIONS_TEST_PASSWORD);
  await client.query(
    "CREATE ROLE sarathi_runtime_test LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE"
  );
  await client.query("BEGIN");
  for (const fixture of [
    { email: "admin@example.test", role: "ADMIN", active: true },
    { email: "technician@example.test", role: "TECHNICIAN", active: true },
    { email: "inactive@example.test", role: "ADMIN", active: false },
    { email: "unmapped@example.test", role: null, active: true }
  ]) {
    const id = randomUUID();
    await client.query(
      "INSERT INTO sarathi.auth_users(id,name,email,email_verified) VALUES ($1,$2,$3,true)",
      [id, "Test administrator", fixture.email]
    );
    await client.query(
      "INSERT INTO sarathi.auth_accounts(id,user_id,account_id,provider_id,password) VALUES ($1,$2,$2,'credential',$3)",
      [randomUUID(), id, password]
    );
    if (fixture.role)
      await client.query(
        "INSERT INTO sarathi.users(identity_subject,display_name,role,active) VALUES ($1,$2,$3,$4)",
        [id, "Test administrator", fixture.role, fixture.active]
      );
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
