import { RecordDirectory } from "../../../features/shared/record-directory";
import { requireAccess } from "../../../features/shared/require-access";
export const metadata = { title: "Orders" };
export default async function Page() {
  const session = await requireAccess("billing.read", "fulfillment.read");
  return <RecordDirectory kind="orders" locale={session.organization.locale} />;
}
