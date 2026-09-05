import { prisma } from "@repo/db";
import { OutboxEventTypes } from "@repo/contracts";

export class OutboxWorker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  start(intervalMs: number = 5000) {
    if (this.isRunning) {
      console.log("Outbox worker is already running");
      return;
    }

    this.isRunning = true;
    console.log(`Starting outbox worker with ${intervalMs}ms interval`);

    this.intervalId = setInterval(async () => {
      await this.processBatch();
    }, intervalMs);

    // Process immediately on start
    this.processBatch().catch((err) => console.error("Initial batch processing failed:", err));
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("Outbox worker stopped");
  }

  private async processBatch() {
    try {
      const batchSize = 20;
      const events = await prisma.outboxEvent.findMany({
        where: { processedAt: null },
        orderBy: { createdAt: "asc" },
        take: batchSize,
      });

      if (events.length === 0) {
        return;
      }

      console.log(`Processing ${events.length} outbox events`);

      for (const event of events) {
        await this.processEvent(event);
      }
    } catch (error) {
      console.error("Error processing outbox batch:", error);
    }
  }

  private async processEvent(event: any) {
    try {
      await prisma.$transaction(async (tx: any) => {
        // Mark as processing to prevent duplicate processing
        const processing = await tx.outboxEvent.findFirst({
          where: { id: event.id, processedAt: null },
        });

        if (!processing) {
          return; // Already processed by another worker
        }

        // Route to appropriate handler
        switch (event.eventType) {
          case OutboxEventTypes.QUOTE_CREATED:
            await this.handleQuoteCreated(tx, event);
            break;
          case OutboxEventTypes.QUOTE_SUBMITTED:
            await this.handleQuoteSubmitted(tx, event);
            break;
          case OutboxEventTypes.APPROVAL_REQUESTED:
            await this.handleApprovalRequested(tx, event);
            break;
          case OutboxEventTypes.ORDER_CONFIRMED:
            await this.handleOrderConfirmed(tx, event);
            break;
          case OutboxEventTypes.INVOICE_CREATED:
            await this.handleInvoiceCreated(tx, event);
            break;
          case OutboxEventTypes.INVOICE_DUE:
            await this.handleInvoiceDue(tx, event);
            break;
          case OutboxEventTypes.PAYMENT_RECORDED:
            await this.handlePaymentRecorded(tx, event);
            break;
          case OutboxEventTypes.STOCK_RESERVED:
            await this.handleStockReserved(tx, event);
            break;
          case OutboxEventTypes.SUBSCRIPTION_STARTED:
            await this.handleSubscriptionStarted(tx, event);
            break;
          case OutboxEventTypes.CUSTOMER_COUNTERED:
            await this.handleCustomerCountered(tx, event);
            break;
          case OutboxEventTypes.CUSTOMER_ACCEPTED:
            await this.handleCustomerAccepted(tx, event);
            break;
          default:
            console.log(`No handler for event type: ${event.eventType}`);
        }

        // Mark as processed
        await tx.outboxEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date() },
        });
      });

      console.log(`Processed outbox event ${event.id}: ${event.eventType}`);
    } catch (error) {
      console.error(`Error processing outbox event ${event.id}:`, error);

      // Mark as failed with retry count
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          errorCount: { increment: 1 },
          lastError: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  private async handleQuoteCreated(tx: any, event: any) {
    // Send notification to quote owner
    const quote = await tx.quote.findUnique({
      where: { id: event.payload.quoteId },
      include: { owner: true },
    });

    if (quote?.owner) {
      // In production, this would send an email or push notification
      console.log(`[Notification] Quote created notification for ${quote.owner.email}`);
    }
  }

  private async handleQuoteSubmitted(tx: any, event: any) {
    // Send notification to approvers if needed
    const quote = await tx.quote.findUnique({
      where: { id: event.payload.quoteId },
    });

    if (quote) {
      console.log(`[Notification] Quote ${quote.quoteNumber} submitted for approval`);
    }
  }

  private async handleApprovalRequested(tx: any, event: any) {
    // Send notification to required approvers
    const approvalRequest = await tx.approvalRequest.findUnique({
      where: { id: event.payload.approvalRequestId },
    });

    if (approvalRequest) {
      console.log(`[Notification] Approval request ${approvalRequest.id} created`);
    }
  }

  private async handleOrderConfirmed(tx: any, event: any) {
    // Trigger fulfillment workflow
    const order = await tx.order.findUnique({
      where: { id: event.payload.orderId },
    });

    if (order) {
      console.log(`[Fulfillment] Order ${order.orderNumber} confirmed, triggering fulfillment`);
      // In production, this would trigger the allocation process
    }
  }

  private async handleInvoiceCreated(tx: any, event: any) {
    // Schedule invoice due reminder
    const invoice = await tx.invoice.findUnique({
      where: { id: event.payload.invoiceId },
      include: { customerAccount: true },
    });

    if (invoice?.dueDate) {
      console.log(`[Scheduling] Invoice ${invoice.invoiceNumber} due reminder for ${invoice.dueDate}`);
      // In production, this would schedule a background job
    }
  }

  private async handleInvoiceDue(tx: any, event: any) {
    // Send overdue notification
    const invoice = await tx.invoice.findUnique({
      where: { id: event.payload.invoiceId },
      include: { customerAccount: true },
    });

    if (invoice) {
      console.log(`[Notification] Invoice ${invoice.invoiceNumber} is due/overdue`);
    }
  }

  private async handlePaymentRecorded(tx: any, event: any) {
    // Update customer credit exposure
    const payment = await tx.payment.findUnique({
      where: { id: event.payload.paymentId },
      include: { invoice: { include: { customerAccount: true } } },
    });

    if (payment?.invoice?.customerAccount) {
      const customer = payment.invoice.customerAccount;
      const newExposure = tx.$queryRawUnsafe(
        `SELECT "currentExposure" - CAST($1 AS DECIMAL) as new_exposure FROM "CustomerAccount" WHERE id = $2`,
        payment.amount,
        customer.id,
      );

      console.log(`[Billing] Payment recorded, updating exposure for customer ${customer.id}`);
    }
  }

  private async handleStockReserved(tx: any, event: any) {
    // Update inventory metrics
    console.log(`[Inventory] Stock reserved for order ${event.payload.orderId}`);
  }

  private async handleSubscriptionStarted(tx: any, event: any) {
    // Schedule billing cycles
    const subscription = await tx.subscription.findUnique({
      where: { id: event.payload.subscriptionId },
    });

    if (subscription) {
      console.log(`[Billing] Subscription ${subscription.subscriptionNumber} started, scheduling billing`);
      // In production, this would create billing schedules
    }
  }

  private async handleCustomerCountered(tx: any, event: any) {
    // Notify sales team
    console.log(`[Notification] Customer countered on quote ${event.payload.quoteId}`);
  }

  private async handleCustomerAccepted(tx: any, event: any) {
    // Update quote stage
    const quote = await tx.quote.findUnique({
      where: { id: event.payload.quoteId },
    });

    if (quote) {
      await tx.quote.update({
        where: { id: event.payload.quoteId },
        data: { stage: "CUSTOMER_ACCEPTED" },
      });
      console.log(`[Negotiation] Quote ${quote.quoteNumber} accepted by customer`);
    }
  }
}

export const outboxWorker = new OutboxWorker();
