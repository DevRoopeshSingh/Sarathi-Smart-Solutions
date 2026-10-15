import { headers } from "next/headers";
import { quotationEditorData } from "@/server/quotations";
import { QuoteEditor } from "../quote-editor";
import { getActor } from "@/server/dal";
import { redirect, notFound } from "next/navigation";
import { InputError, AccessDeniedError } from "@/server/mutation-errors";
export const dynamic = "force-dynamic";
export const metadata = { title: "Create quotation" };
export default async function Page() {
  const h = await headers();
  if (!(await getActor(h))) redirect("/admin/login");
  let data;
  try {
    data = await quotationEditorData(h);
  } catch (error) {
    if (error instanceof InputError || error instanceof AccessDeniedError) notFound();
    throw error;
  }
  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main">
        <h1>Create quotation</h1>
        <QuoteEditor {...data} />
      </main>
    </div>
  );
}
