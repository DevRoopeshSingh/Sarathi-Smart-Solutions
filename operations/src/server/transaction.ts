import "server-only";
import type { PoolClient } from "pg";
import type { TenantPool } from "./tenant-pool";
export async function transaction<T>(
  pool: TenantPool,
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '10s'");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
