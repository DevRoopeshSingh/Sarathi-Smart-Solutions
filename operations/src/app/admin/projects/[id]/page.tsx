import { RecordDetail } from "@/components/workflow/record-detail";
import { PaymentSummary } from "@/components/workflow/payment-summary";
export const metadata = { title: "Project details" };
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RecordDetail kind="project" id={id}>
      <PaymentSummary kind="project" id={id} />
    </RecordDetail>
  );
}
