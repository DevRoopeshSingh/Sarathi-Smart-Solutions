import "server-only";
import { getAuth } from "./auth";
import { getPool } from "./db";
import { isRole } from "./permissions";
import type { AdminActor } from "../lib/operations";

export async function getIdentityActor(headers: Headers): Promise<AdminActor | null> {
  const session = await getAuth().api.getSession({ headers, query: { disableCookieCache: true } });
  if (!session) return null;
  const result = await getPool().query<AdminActor>(
    `
    SELECT actor.id::text AS id, actor.display_name AS "displayName", identity.email,
           actor.role
    FROM sarathi.users actor
    JOIN sarathi.auth_users identity ON identity.id = actor.identity_subject
    WHERE actor.identity_subject = $1 AND actor.active
  `,
    [session.user.id]
  );
  const actor = result.rows[0];
  return actor && isRole(actor.role) ? actor : null;
}
