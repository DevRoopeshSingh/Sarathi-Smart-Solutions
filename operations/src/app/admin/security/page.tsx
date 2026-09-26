import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminActor } from "@/server/dal";
import { getAuth } from "@/server/auth";
import { SecuritySettings } from "./security-settings";
export const dynamic = "force-dynamic";
export const metadata = { title: "Account security" };
export default async function SecurityPage() {
  const requestHeaders = await headers();
  if (!(await getAdminActor(requestHeaders))) redirect("/admin/login");
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return (
    <main id="main" className="workspace-main">
      <h1>Account security</h1>
      <p>Use an authenticator app to add a second step to sign-in. Enrollment is optional.</p>
      <SecuritySettings enabled={session?.user.twoFactorEnabled === true} />
    </main>
  );
}
