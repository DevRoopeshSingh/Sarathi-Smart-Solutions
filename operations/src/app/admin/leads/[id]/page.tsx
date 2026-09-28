import { RecordDetail } from "@/components/workflow/record-detail";
export const metadata = { title: "Lead details" };
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <RecordDetail kind="lead" id={(await params).id} />;
}
