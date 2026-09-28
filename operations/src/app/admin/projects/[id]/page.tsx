import { RecordDetail } from "@/components/workflow/record-detail";
export const metadata = { title: "Project details" };
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <RecordDetail kind="project" id={(await params).id} />;
}
