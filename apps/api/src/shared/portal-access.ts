import type { Prisma } from "@repo/db";

/**
 * Customer-visible quotes are explicitly sent, completed, or a negotiated
 * result that the same customer proposed/accepted and is awaiting reapproval.
 * READY_TO_SEND and ordinary drafts are intentionally excluded.
 */
export function portalShareabilityWhere(
  customerAccountId: string,
): Prisma.QuoteWhereInput {
  return {
    OR: [
      {
        stage: {
          in: ["SENT", "UNDER_NEGOTIATION", "CUSTOMER_ACCEPTED", "CONFIRMED"],
        },
      },
      {
        stage: { in: ["PENDING_APPROVAL", "REVISION_REQUIRED"] },
        currentVersion: {
          is: {
            OR: [
              {
                resultingChangeRequests: {
                  some: {
                    status: "ACCEPTED",
                    thread: { customerAccountId },
                  },
                },
              },
              {
                resultingCounteroffers: {
                  some: {
                    status: "ACCEPTED",
                    changeRequest: { thread: { customerAccountId } },
                  },
                },
              },
            ],
          },
        },
      },
    ],
  };
}
