import { RecordDirectory } from "../../../features/shared/record-directory";
import { requireAccess } from "../../../features/shared/require-access";
export const metadata = { title: "Customers" };
export default async function Page() {
  const session = await requireAccess("customer.read");
  return (
    <RecordDirectory kind="customers" locale={session.organization.locale} />
  );
}
