import {
  ApprovalRequestDtoSchema,
  QuoteDtoSchema,
  apiRoutes,
  planApiRoutes,
} from "@repo/common";
import type { Metadata } from "next";

import { ApprovalWorkspace } from "../../../../features/approvals/approval-workspace";
import { serverApiRequest } from "../../../../lib/api/server";
import { getInternalSessionState } from "../../../../lib/auth/session";

export const metadata: Metadata = { title: "Approval Review" };

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const sessionState = await getInternalSessionState();
  if (sessionState.status !== "authenticated") return null;
  const { requestId } = await params;
  const approval = await serverApiRequest(
    planApiRoutes.approvals.detail(requestId),
    ApprovalRequestDtoSchema,
  );
  const quote = await serverApiRequest(
    apiRoutes.quotes.detail(approval.quoteId),
    QuoteDtoSchema,
  );
  const capabilities = sessionState.session.user.capabilities;

  return (
    <ApprovalWorkspace
      canFinanceAct={capabilities.includes("approval.financeAct")}
      canManagerAct={capabilities.includes("approval.managerAct")}
      currentUserId={sessionState.session.user.id}
      initialApproval={approval}
      quote={quote}
      timeZone={sessionState.session.organization.timezone}
    />
  );
}
