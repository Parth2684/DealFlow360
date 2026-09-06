import { RecordDirectory } from "../../../features/shared/record-directory";
import { requireAccess } from "../../../features/shared/require-access";
export const metadata = { title: "Invoices" };
export default async function Page() {
  const session = await requireAccess("billing.read");
  return (
    <RecordDirectory kind="invoices" locale={session.organization.locale} />
  );
}
