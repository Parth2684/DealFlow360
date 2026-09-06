import {
  ApprovalRequestDtoSchema,
  createCursorPageSchema,
  planApiRoutes,
} from "@repo/common";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  ApprovalQueue,
  type ApprovalQueueKey,
} from "../../../features/approvals/approval-queue";
import { serverApiRequest } from "../../../lib/api/server";
import { getInternalSessionState } from "../../../lib/auth/session";

export const metadata: Metadata = { title: "Approvals" };

const ApprovalPageSchema = createCursorPageSchema(ApprovalRequestDtoSchema);
const QUEUES: readonly ApprovalQueueKey[] = [
  "manager",
  "finance",
  "completed",
  "overdue",
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionState = await getInternalSessionState();
  if (sessionState.status !== "authenticated") return null;
  if (!sessionState.session.user.capabilities.includes("approval.read")) redirect("/forbidden");
  const parameters = await searchParams;
  const requestedQueue = first(parameters.queue);
  const queue = QUEUES.includes(requestedQueue as ApprovalQueueKey)
    ? (requestedQueue as ApprovalQueueKey)
    : sessionState.session.user.capabilities.includes("approval.financeAct") && !sessionState.session.user.capabilities.includes("approval.managerAct") ? "finance" : "manager";
  const query = new URLSearchParams({ limit: "25" });
  query.set("queue", queue);
  const cursor = first(parameters.cursor);
  if (cursor) query.set("cursor", cursor);
  const page = await serverApiRequest(
      `${planApiRoutes.approvals.inbox}?${query.toString()}`,
      ApprovalPageSchema,
    );

  return (
    <ApprovalQueue
      page={page}
      queue={queue}
      timeZone={sessionState.session.organization.timezone}
    />
  );
}
