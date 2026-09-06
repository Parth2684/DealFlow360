import type { TransactionClient } from "../../shared/activity.js";
import { persistHealthSnapshot } from "../../modules/insights/health.js";
import type { ClaimedOutboxEvent } from "../job-events.js";

const TERMINAL_QUOTE_STAGES = ["EXPIRED", "CANCELLED"] as const;

export async function refreshDealHealth(
  transaction: TransactionClient,
  event: ClaimedOutboxEvent,
): Promise<void> {
  const quote = await transaction.quote.findFirst({
    where: { id: event.aggregateId, organizationId: event.organizationId },
    select: { stage: true },
  });
  if (
    quote === null ||
    TERMINAL_QUOTE_STAGES.includes(
      quote.stage as (typeof TERMINAL_QUOTE_STAGES)[number],
    )
  ) {
    return;
  }
  await persistHealthSnapshot(
    transaction,
    { kind: "system", organizationId: event.organizationId },
    event.aggregateId,
    "Scheduled deal-health refresh",
    { recordSnapshotActivity: false },
  );
}
