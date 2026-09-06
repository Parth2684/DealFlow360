import { IdSchema } from "@repo/common";
import { notFound } from "next/navigation";
import { InvoiceWorkspace } from "../../../../features/billing/invoice-workspace";
import { requireAccess } from "../../../../features/shared/require-access";
export const metadata = { title: "Invoice" };
export default async function Page({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const session = await requireAccess("billing.read");
  const { invoiceId } = await params;
  if (!IdSchema.safeParse(invoiceId).success) notFound();
  return (
    <InvoiceWorkspace
      invoiceId={invoiceId}
      capabilities={session.user.capabilities}
      timeZone={session.organization.timezone}
    />
  );
}
