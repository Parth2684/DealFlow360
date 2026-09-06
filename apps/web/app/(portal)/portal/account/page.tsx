import { CustomerPasswordChange } from "../../../../components/auth/customer-access-forms";
import { PageHeader } from "@repo/ui";
export const metadata = { title: "Account Security" };
export default function Page() {
  return (
    <div className="grid gap-lg">
      <PageHeader
        title="Account Security"
        description="Change the password you received by email. If you use sign-in links only, you can continue to use those links."
      />
      <CustomerPasswordChange />
    </div>
  );
}
