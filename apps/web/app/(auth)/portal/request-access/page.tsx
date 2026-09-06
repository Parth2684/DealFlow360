import { AuthFrame } from "../../../../components/auth/auth-frame";
import { CustomerAccessForm } from "../../../../components/auth/customer-access-forms";
import { getSystemHealthState } from "../../../../lib/auth/session";
import { serverApiRequest } from "../../../../lib/api/server";
import { apiRoutes, RegistrationContextSchema } from "@repo/common";
import { ErrorFeedback } from "@repo/ui";
export const metadata = { title: "Request Customer Account" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ organization?: string }>;
}) {
  const query = await searchParams;
  const health = await getSystemHealthState();
  let context;
  try {
    context = await serverApiRequest(
      apiRoutes.customerAccess.context +
        (query.organization
          ? "?organization=" + encodeURIComponent(query.organization)
          : ""),
      RegistrationContextSchema,
    );
  } catch {
    context = null;
  }
  return (
    <AuthFrame
      title="Request a Customer Account"
      description={
        context
          ? "Request access to " +
            context.name +
            ". An administrator will review your details."
          : "Use the registration link provided by your sales team."
      }
      health={health}
    >
      {context ? (
        <CustomerAccessForm organization={context.slug} />
      ) : (
        <ErrorFeedback title="Registration link required">
          Ask your sales representative for their customer registration link.
        </ErrorFeedback>
      )}
    </AuthFrame>
  );
}
