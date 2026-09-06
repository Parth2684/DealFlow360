import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CustomerPasswordLogin } from "../../../../components/auth/customer-access-forms";
import { ButtonLink } from "@repo/ui";
import { AuthFrame } from "../../../../components/auth/auth-frame";
import { PortalLoginForm } from "../../../../components/auth/portal-login-form";
import { PortalTokenExchange } from "../../../../components/auth/portal-token-exchange";
import {
  getSystemHealthState,
  getPortalSession,
} from "../../../../lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer Portal Access" };

interface PortalLoginPageProps {
  searchParams: Promise<{
    reason?: string | string[];
    token?: string | string[];
    organization?: string;
  }>;
}

export default async function PortalLoginPage({
  searchParams,
}: PortalLoginPageProps) {
  const [health, query, hasPortalSession] = await Promise.all([
    getSystemHealthState(),
    searchParams,
    getPortalSession(),
  ]);
  const token = typeof query.token === "string" ? query.token : undefined;
  const reason = typeof query.reason === "string" ? query.reason : undefined;

  if (!token && hasPortalSession) redirect("/portal");

  return (
    <AuthFrame
      description={
        token
          ? "Confirming the short-lived link and creating a restricted customer session."
          : "Sign in with the credentials from your approval email, or request a secure sign-in link."
      }
      health={health}
      title={token ? "Verify Customer Access" : "Open the Customer Portal"}
    >
      {token ? (
        <PortalTokenExchange token={token} />
      ) : (
        <div className="grid gap-lg">
          <CustomerPasswordLogin />
          <details>
            <summary className="cursor-pointer font-semibold">
              Sign in with an email link instead
            </summary>
            <div className="pt-md">
              <PortalLoginForm reason={reason} />
            </div>
          </details>
          <ButtonLink
            href={
              "/portal/request-access" +
              (query.organization
                ? "?organization=" + encodeURIComponent(query.organization)
                : "")
            }
            variant="secondary"
          >
            Request a Customer Account
          </ButtonLink>
        </div>
      )}
    </AuthFrame>
  );
}
