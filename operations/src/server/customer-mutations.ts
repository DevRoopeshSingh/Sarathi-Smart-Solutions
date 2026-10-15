import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { TenantPool } from "./tenant-pool";
import type { CustomerRecord } from "../lib/operations";
import { normalizeCustomerPhone, type CustomerDuplicate } from "../lib/customer-contact";
import { validateCustomer, databaseId, type CreateCustomerInput } from "./input";
import { InputError } from "./mutation-errors";
import { transaction } from "./transaction";
export interface CustomerSubmission {
  requestId: string;
  confirmDuplicates: boolean;
}
export class DuplicateCustomerError extends InputError {
  constructor(public readonly duplicates: CustomerDuplicate[]) {
    super("Review possible existing customers.");
  }
}
export function validateCustomerSubmission(
  input: CustomerSubmission | undefined
): CustomerSubmission {
  if (
    !input ||
    typeof input.requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.requestId
    ) ||
    typeof input.confirmDuplicates !== "boolean"
  )
    throw new InputError("Invalid customer submission reference. Reload the form.");
  return { requestId: input.requestId.toLowerCase(), confirmDuplicates: input.confirmDuplicates };
}
export const customerColumns = `id::text, name, phone, email, address, version,
  0 AS "projectCount", created_at::text AS "createdAt", updated_at::text AS "updatedAt"`;
async function duplicates(client: PoolClient, name: string, phone: string) {
  const result = await client.query<CustomerDuplicate>(
    `
    WITH candidate AS (SELECT regexp_replace(lower($2),'[^[:alnum:]]','','g') AS key)
    SELECT c.id::text,c.name,c.phone,CASE WHEN c.normalized_phone=$1 THEN 'PHONE' ELSE 'NAME' END AS match
    FROM (SELECT id,name,phone,normalized_phone,regexp_replace(lower(name),'[^[:alnum:]]','','g') AS name_key FROM sarathi.customers) c
    CROSS JOIN candidate q
    WHERE c.normalized_phone=$1 OR (length(q.key)>=4 AND
      (c.name_key=q.key OR left(c.name_key,length(q.key))=q.key
        OR (length(c.name_key)>=4 AND left(q.key,length(c.name_key))=c.name_key)))
    ORDER BY (c.normalized_phone=$1) DESC,c.id DESC LIMIT 10`,
    [normalizeCustomerPhone(phone), name]
  );
  return result.rows;
}
export async function createCustomer(
  pool: TenantPool,
  input: CreateCustomerInput,
  submission?: CustomerSubmission
): Promise<CustomerRecord> {
  const data = validateCustomer(input);
  // Unkeyed calls are internal fixtures/imports only. Every authenticated DAL create requires a key.
  const options = submission ? validateCustomerSubmission(submission) : undefined;
  const hash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return transaction(pool, async (client) => {
    if (options) {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended(current_setting('sarathi.organization_id') || ':customer-request:' || $1 || ':' || $2,0))`,
        [pool.actorId, options.requestId]
      );
      const existing = await client.query<CustomerRecord & { hash: string }>(
        `SELECT ${customerColumns}, creation_request_hash AS hash FROM sarathi.customers WHERE creation_request_actor_id=$1 AND creation_request_id=$2`,
        [pool.actorId, options.requestId]
      );
      if (existing.rows[0]) {
        if (existing.rows[0].hash !== hash)
          throw new InputError(
            "This submission reference was already used. Reload before creating another customer."
          );
        const { hash: _, ...record } = existing.rows[0];
        return record;
      }
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended(current_setting('sarathi.organization_id') || ':customer-phone:' || $1,0))`,
        [normalizeCustomerPhone(data.phone)]
      );
      const matches = await duplicates(client, data.name, data.phone);
      if (matches.length && !options.confirmDuplicates) throw new DuplicateCustomerError(matches);
    }
    const result = await client.query<CustomerRecord>(
      `INSERT INTO sarathi.customers(name,phone,email,address,creation_request_id,creation_request_actor_id,creation_request_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${customerColumns}`,
      [
        data.name,
        data.phone,
        data.email,
        data.address,
        options?.requestId ?? null,
        options ? pool.actorId : null,
        options ? hash : null
      ]
    );
    return result.rows[0];
  });
}
export async function updateCustomer(
  pool: TenantPool,
  rawId: string,
  input: CreateCustomerInput,
  rawVersion: string
): Promise<void> {
  const id = databaseId(rawId, "Customer");
  const data = validateCustomer(input);
  if (
    typeof rawVersion !== "string" ||
    !/^[1-9][0-9]{0,9}$/.test(rawVersion) ||
    Number(rawVersion) > 2147483647
  )
    throw new InputError("Invalid customer edit version.");
  await transaction(pool, async (client) => {
    const locked = await client.query<{ version: number }>(
      `SELECT version FROM sarathi.customers WHERE id=$1 FOR UPDATE`,
      [id]
    );
    if (!locked.rows[0]) throw new InputError("Customer no longer exists or is unavailable.");
    if (locked.rows[0].version !== Number(rawVersion))
      throw new InputError("Customer changed since this page loaded. Reload before editing again.");
    const updated = await client.query(
      `UPDATE sarathi.customers SET name=$1,phone=$2,email=$3,address=$4 WHERE id=$5`,
      [data.name, data.phone, data.email, data.address, id]
    );
    if (updated.rowCount !== 1)
      throw new InputError("Customer no longer exists or is unavailable.");
  });
}
