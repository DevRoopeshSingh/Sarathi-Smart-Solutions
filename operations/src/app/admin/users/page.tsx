import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminActor, getManagedUsers } from "@/server/dal";
import { UsersManager } from "./users-manager";

export const metadata: Metadata = { title: "Users & roles" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const requestHeaders = await headers();
  const actor = await getAdminActor(requestHeaders);
  if (!actor) redirect("/admin/login");
  if (actor.role !== "ADMIN") redirect("/admin");

  const users = await getManagedUsers(requestHeaders);
  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main">
        <section className="workspace-heading">
          <span className="eyebrow">
            <span className="small-rule" />
            ACCESS CONTROL
          </span>
          <h1>Users & roles</h1>
          <p className="lead-copy">
            Assign access to existing provisioned accounts. New accounts are provisioned by an
            operator; public registration is disabled.
          </p>
        </section>
        <UsersManager users={users} currentUserId={actor.id} />
      </main>
    </div>
  );
}
