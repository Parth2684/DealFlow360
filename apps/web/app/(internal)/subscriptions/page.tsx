import { RecordDirectory } from "../../../features/shared/record-directory";
import { requireAccess } from "../../../features/shared/require-access";
export const metadata = { title: "Subscriptions" };
export default async function Page() {
  const session = await requireAccess("subscription.read");
  return (
    <RecordDirectory
      kind="subscriptions"
      locale={session.organization.locale}
    />
  );
}
