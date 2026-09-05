import { prisma } from "@repo/db";
import { Errors, OutboxEventTypes } from "@repo/contracts";
import { writeOutboxEvent } from "../../shared/outbox.js";
import { writeAuditEvent } from "../../shared/outbox.js";
import type { AuthContext } from "../../shared/context.js";

export class CustomerService {
  async listTiers(auth: AuthContext) {
    const tiers = await prisma.customerTier.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });
    return tiers.map((t: { id: string; name: string; code: string; priority: number; active: boolean }) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      priority: t.priority,
      active: t.active,
    }));
  }

  async createTier(auth: AuthContext, input: { name: string; code: string; priority?: number }) {
    const existing = await prisma.customerTier.findFirst({
      where: { organizationId: auth.organizationId, code: input.code },
    });
    if (existing) throw Errors.conflict("Tier code already exists");

    const tier = await prisma.customerTier.create({
      data: {
        organizationId: auth.organizationId,
        name: input.name,
        code: input.code,
        priority: input.priority ?? 0,
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "customer_tier",
      entityId: tier.id,
      eventType: "customer_tier.created",
      afterSummary: { name: tier.name, code: tier.code },
    });

    return this.toTierDto(tier);
  }

  async updateTier(auth: AuthContext, tierId: string, input: { name?: string; active?: boolean }) {
    const tier = await prisma.customerTier.findFirst({
      where: { id: tierId, organizationId: auth.organizationId },
    });
    if (!tier) throw Errors.notFound("Customer tier");

    const updated = await prisma.customerTier.update({
      where: { id: tierId },
      data: input,
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "customer_tier",
      entityId: tierId,
      eventType: "customer_tier.updated",
      beforeSummary: { name: tier.name, active: tier.active },
      afterSummary: { name: updated.name, active: updated.active },
    });

    return this.toTierDto(updated);
  }

  async listAccounts(auth: AuthContext) {
    const accounts = await prisma.customerAccount.findMany({
      where: { organizationId: auth.organizationId, active: true },
      include: { tier: true, salesTeam: true },
      orderBy: { name: "asc" },
    });
    return accounts.map((a: any) => this.toAccountDto(a));
  }

  async createAccount(
    auth: AuthContext,
    input: {
      name: string;
      tierId: string;
      salesTeamId?: string;
      assignedRepId?: string;
      preferredCurrency?: string;
      paymentTermsDays?: number;
      creditLimit?: string;
    },
  ) {
    const tier = await prisma.customerTier.findFirst({
      where: { id: input.tierId, organizationId: auth.organizationId },
    });
    if (!tier) throw Errors.notFound("Customer tier");

    const account = await prisma.customerAccount.create({
      data: {
        organizationId: auth.organizationId,
        name: input.name,
        tierId: input.tierId,
        salesTeamId: input.salesTeamId,
        assignedRepId: input.assignedRepId,
        preferredCurrency: input.preferredCurrency ?? "USD",
        paymentTermsDays: input.paymentTermsDays ?? 30,
        creditLimit: input.creditLimit ?? "0",
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "customer_account",
      entityId: account.id,
      eventType: "customer_account.created",
      afterSummary: { name: account.name, tier: tier.name },
    });

    await writeOutboxEvent(prisma, {
      organizationId: auth.organizationId,
      eventType: OutboxEventTypes.DEAL_ACTIVITY_RECORDED,
      payload: { type: "customer_created", customerId: account.id },
    });

    return this.getAccount(auth, account.id);
  }

  async getAccount(auth: AuthContext, customerId: string) {
    const account = await prisma.customerAccount.findFirst({
      where: { id: customerId, organizationId: auth.organizationId },
      include: { tier: true, salesTeam: true, contacts: true },
    });
    if (!account) throw Errors.notFound("Customer account");
    return this.toAccountDto(account);
  }

  async updateAccount(
    auth: AuthContext,
    customerId: string,
    input: {
      name?: string;
      tierId?: string;
      salesTeamId?: string;
      assignedRepId?: string;
      paymentTermsDays?: number;
      creditLimit?: string;
      active?: boolean;
    },
  ) {
    const account = await prisma.customerAccount.findFirst({
      where: { id: customerId, organizationId: auth.organizationId },
    });
    if (!account) throw Errors.notFound("Customer account");

    if (input.tierId) {
      const tier = await prisma.customerTier.findFirst({
        where: { id: input.tierId, organizationId: auth.organizationId },
      });
      if (!tier) throw Errors.notFound("Customer tier");
    }

    const updated = await prisma.customerAccount.update({
      where: { id: customerId },
      data: input,
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "customer_account",
      entityId: customerId,
      eventType: "customer_account.updated",
      beforeSummary: { name: account.name },
      afterSummary: { name: updated.name },
    });

    return this.getAccount(auth, customerId);
  }

  async listContacts(auth: AuthContext, customerId: string) {
    const contacts = await prisma.customerContact.findMany({
      where: { organizationId: auth.organizationId, customerAccountId: customerId },
      orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }],
    });
    return contacts.map((c: any) => this.toContactDto(c));
  }

  async createContact(
    auth: AuthContext,
    customerId: string,
    input: {
      email: string;
      firstName: string;
      lastName: string;
      isPrimary?: boolean;
      portalEnabled?: boolean;
    },
  ) {
    const account = await prisma.customerAccount.findFirst({
      where: { id: customerId, organizationId: auth.organizationId },
    });
    if (!account) throw Errors.notFound("Customer account");

    const existing = await prisma.customerContact.findFirst({
      where: {
        organizationId: auth.organizationId,
        customerAccountId: customerId,
        email: input.email,
      },
    });
    if (existing) throw Errors.conflict("Contact email already exists for this customer");

    if (input.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { organizationId: auth.organizationId, customerAccountId: customerId },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.customerContact.create({
      data: {
        organizationId: auth.organizationId,
        customerAccountId: customerId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        isPrimary: input.isPrimary ?? false,
        portalEnabled: input.portalEnabled ?? false,
      },
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "customer_contact",
      entityId: contact.id,
      eventType: "customer_contact.created",
      afterSummary: { email: contact.email, name: `${contact.firstName} ${contact.lastName}` },
    });

    return this.toContactDto(contact);
  }

  async updateContact(
    auth: AuthContext,
    customerId: string,
    contactId: string,
    input: {
      email?: string;
      firstName?: string;
      lastName?: string;
      isPrimary?: boolean;
      portalEnabled?: boolean;
    },
  ) {
    const contact = await prisma.customerContact.findFirst({
      where: { id: contactId, organizationId: auth.organizationId, customerAccountId: customerId },
    });
    if (!contact) throw Errors.notFound("Customer contact");

    if (input.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { organizationId: auth.organizationId, customerAccountId: customerId },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.customerContact.update({
      where: { id: contactId },
      data: input,
    });

    await writeAuditEvent(prisma, {
      organizationId: auth.organizationId,
      actorId: auth.userId,
      entityType: "customer_contact",
      entityId: contactId,
      eventType: "customer_contact.updated",
      beforeSummary: { email: contact.email },
      afterSummary: { email: updated.email },
    });

    return this.toContactDto(updated);
  }

  private toTierDto(tier: { id: string; name: string; code: string; priority: number; active: boolean }) {
    return {
      id: tier.id,
      name: tier.name,
      code: tier.code,
      priority: tier.priority,
      active: tier.active,
    };
  }

  private toAccountDto(account: {
    id: string;
    name: string;
    tier: { id: string; name: string; code: string };
    salesTeam: { id: string; name: string } | null;
    assignedRepId: string | null;
    preferredCurrency: string;
    paymentTermsDays: number;
    creditLimit: unknown;
    currentExposure: unknown;
    overdueBalance: unknown;
    active: boolean;
    contacts: Array<{ id: string; email: string; firstName: string; lastName: string; isPrimary: boolean; portalEnabled: boolean }>;
  }) {
    return {
      id: account.id,
      name: account.name,
      tier: {
        id: account.tier.id,
        name: account.tier.name,
        code: account.tier.code,
      },
      salesTeam: account.salesTeam
        ? { id: account.salesTeam.id, name: account.salesTeam.name }
        : null,
      assignedRepId: account.assignedRepId,
      preferredCurrency: account.preferredCurrency,
      paymentTermsDays: account.paymentTermsDays,
      creditLimit: String(account.creditLimit),
      currentExposure: String(account.currentExposure),
      overdueBalance: String(account.overdueBalance),
      active: account.active,
      contacts: account.contacts.map((c) => ({
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        isPrimary: c.isPrimary,
        portalEnabled: c.portalEnabled,
      })),
    };
  }

  private toContactDto(contact: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isPrimary: boolean;
    portalEnabled: boolean;
  }) {
    return {
      id: contact.id,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      isPrimary: contact.isPrimary,
      portalEnabled: contact.portalEnabled,
    };
  }
}

export const customerService = new CustomerService();
