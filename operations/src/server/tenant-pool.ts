import "server-only";
import type { Pool, PoolClient } from "pg";
import { resolveOrganizationContext } from "./tenancy";
import type { Permission } from "./permissions";

const tenantDatabase = Symbol("tenantDatabase");
export type TenantPool = Pick<Pool, "query" | "connect"> & {
  readonly [tenantDatabase]: true;
  readonly actorId: string;
};

// A facade, never a mutation of the shared pool. Every checkout binds LOCAL state
// after reauthorization; COMMIT/ROLLBACK discard it before the connection returns.
export function tenantPool(
  pool: Pool,
  actorId: string,
  organizationId: string,
  permission: Permission
): TenantPool {
  async function connect(): Promise<PoolClient> {
    const client = await pool.connect();
    let begun = false;
    let released = false;
    const query: PoolClient["query"] = (async (sql: string, values?: unknown[]) => {
      if (released) throw new Error("Tenant connection already released.");
      if (sql === "BEGIN") {
        if (begun) throw new Error("Nested tenant transaction is not supported.");
        const result = await client.query("BEGIN");
        begun = true;
        try {
          // Owners/superusers bypass RLS. Refuse a misconfigured production pool
          // rather than silently returning globally visible records.
          const authority = await client.query<{
            unsafe: boolean;
          }>(`SELECT r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb
            OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='sarathi' AND c.relkind='r' AND pg_has_role(current_user,c.relowner,'MEMBER')) AS unsafe
            FROM pg_roles r WHERE r.rolname=current_user`);
          if (authority.rows[0]?.unsafe !== false)
            throw new Error("Business database requires a restricted runtime role.");
          const context = await resolveOrganizationContext(
            client,
            actorId,
            organizationId,
            permission
          );
          const division =
            context.divisions.find((d) => d.slug === "smart-solutions") ??
            (context.divisions.length === 1 ? context.divisions[0] : undefined);
          await client.query(
            `SELECT set_config('sarathi.actor_id',$1,true),
            set_config('sarathi.organization_id',$2,true),set_config('sarathi.division_id',$3,true),
            set_config('sarathi.permission',$4,true)`,
            [actorId, organizationId, division?.id ?? "", permission]
          );
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          begun = false;
          throw error;
        }
      }
      if (!begun) throw new Error("Tenant queries require a transaction.");
      const result = await client.query(sql, values);
      if (sql === "COMMIT" || sql === "ROLLBACK") begun = false;
      return result;
    }) as PoolClient["query"];
    return new Proxy(client, {
      get(target, key) {
        if (key === "query") return query;
        if (key === "release")
          return (discard = false) => {
            if (released) return;
            released = true;
            target.release(discard || begun);
          };
        return Reflect.get(target, key);
      }
    });
  }
  const query: Pool["query"] = (async (sql: string, values?: unknown[]) => {
    const client = await connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(sql, values);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* Release destroys an open transaction. */
      }
      throw error;
    } finally {
      client.release();
    }
  }) as Pool["query"];
  return { query, connect: connect as Pool["connect"], actorId, [tenantDatabase]: true };
}
