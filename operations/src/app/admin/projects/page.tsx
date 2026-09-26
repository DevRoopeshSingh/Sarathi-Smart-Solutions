import { ListNavigation } from "../list-controls";
import { readListQuery, type SearchParameters } from "@/server/lists";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminActor, getCustomerOptions, getProjects, getProjectCounts } from "@/server/dal";
import { ProjectsManager } from "./projects-manager";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams
}: {
  searchParams: Promise<SearchParameters>;
}) {
  const query = readListQuery(await searchParams);
  const requestHeaders = await headers();
  if (!(await getAdminActor(requestHeaders))) redirect("/admin/login");

  const [projects, customers, statusCounts] = await Promise.all([
    getProjects(requestHeaders, query),
    getCustomerOptions(requestHeaders),
    getProjectCounts(requestHeaders)
  ]);

  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main">
        <section className="workspace-heading">
          <span className="eyebrow">
            <span className="small-rule" />
            OPERATIONS LIFECYCLE
          </span>
          <h1>Project Operations</h1>
          <p className="lead-copy">
            Manage active projects through site survey, costing, procurement, installation, and
            handover.
          </p>
        </section>

        <ProjectsManager
          initialProjects={projects.items}
          customers={customers}
          statusCounts={statusCounts}
        />
        <ListNavigation
          query={query}
          total={projects.total}
          next={projects.next}
          base="/admin/projects"
        />
      </main>
    </div>
  );
}
