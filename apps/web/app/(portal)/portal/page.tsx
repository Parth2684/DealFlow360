import { redirect } from "next/navigation";
import { getPortalSession } from "../../../lib/auth/session";
import { RecordDirectory } from "../../../features/shared/record-directory";
export const metadata = { title: "My Quotations" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string }>;
}) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const query = await searchParams;
  if (typeof query.quote === "string")
    redirect(`/portal/quotations/${encodeURIComponent(query.quote)}`);
  return <RecordDirectory kind="portal" locale={session.formatting.locale} />;
}
