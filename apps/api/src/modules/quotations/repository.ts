import { prisma } from "@repo/db";
import { Errors } from "@repo/contracts";

export class QuoteRepository {
  async findById(organizationId: string, quoteId: string) {
    return prisma.quote.findFirst({
      where: { id: quoteId, organizationId },
      include: {
        customerAccount: { include: { tier: true } },
        owner: true,
        currentVersion: { include: { lines: { orderBy: { lineNumber: "asc" } } } },
      },
    });
  }

  async list(organizationId: string, ownerId?: string) {
    return prisma.quote.findMany({
      where: {
        organizationId,
        ...(ownerId ? { ownerId } : {}),
      },
      include: {
        customerAccount: true,
        owner: true,
        currentVersion: { include: { lines: { orderBy: { lineNumber: "asc" } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  }

  async getNextQuoteNumber(organizationId: string): Promise<string> {
    const count = await prisma.quote.count({ where: { organizationId } });
    const year = new Date().getFullYear();
    return `Q-${year}-${String(count + 1).padStart(4, "0")}`;
  }

  async getDiscountLimits(
    organizationId: string,
    tierId: string,
    productIds: string[],
    categoryIds: string[],
  ) {
    const now = new Date();
    return prisma.discountLimit.findMany({
      where: {
        organizationId,
        active: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        AND: [
          {
            OR: [
              { tierId: null },
              { tierId },
            ],
          },
          {
            OR: [
              { productId: null },
              { productId: { in: productIds } },
            ],
          },
          {
            OR: [
              { categoryId: null },
              { categoryId: { in: categoryIds } },
            ],
          },
        ],
      },
    });
  }

  async getActiveApprovalPolicy(organizationId: string) {
    const now = new Date();
    return prisma.approvalPolicy.findFirst({
      where: {
        organizationId,
        status: "ACTIVE",
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { priority: "desc" },
      include: { stepTemplates: { orderBy: { sequence: "asc" } } },
    });
  }

  async getPriceRules(organizationId: string, tierId: string) {
    const now = new Date();
    const priceList = await prisma.priceList.findFirst({
      wtake: 50,here: {
        organizationId,
        active: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { priority: "desc" },
      include: { priceRules: true },
    });
    return priceList?.priceRules ?? [];
  }

  assertEditable(quote: { stage: string }) {
    const editable = ["DRAFT", "REVISION_REQUIRED"];
    if (!editable.includes(quote.stage)) {
      throw Errors.conflict(`Quote in stage ${quote.stage} cannot be edited`);
    }
  }

  assertRevision(current: number, expected: number) {
    if (current !== expected) {
      throw Errors.conflict(
        `Revision conflict: expected ${expected}, current is ${current}`,
      );
    }
  }
}

export const quoteRepository = new QuoteRepository();
