import { Router } from "express";
import { z } from "zod";
import {
  CustomerAccessRequestSchema,
  CustomerAccessDecisionSchema,
  CustomerAccessDtoSchema,
  ListQuerySchema,
  LoginRequestSchema,
  RevisionPreconditionSchema,
} from "@repo/common";
import { prisma, type Prisma } from "@repo/db";
import { env } from "../../config/env.js";
import {
  authenticateInternal,
  authenticatePortal,
  internalPrincipal,
  portalPrincipal,
  requireCapability,
  requireCsrf,
} from "../../middleware/auth.js";
import {
  portalRateLimit,
  loginRateLimit,
} from "../../middleware/rate-limit.js";
import {
  cursorArgs,
  pageFromRows,
  parseBody,
  parsePathId,
  parseQuery,
} from "../../shared/http.js";
import { conflict, notFound, unauthorized } from "../../shared/errors.js";
import { deliverEmail, type EmailSender } from "../../shared/email.js";
import { hashToken, randomToken } from "../../shared/security.js";
import { setPortalCookies } from "../../shared/cookies.js";

const entityType = "CUSTOMER_ACCESS_REQUEST";
const DetailsSchema = z.object({
  companyName: z.string(),
  message: z.string(),
  status: z.enum(["PENDING", "APPROVED", "DECLINED"]),
  emailStatus: z.enum(["NONE", "PENDING", "SENT", "FAILED"]),
  reason: z.string(),
  contactId: z.string().optional(),
  identityId: z.string().optional(),
  accountId: z.string().optional(),
  attemptAt: z.string().optional(),
});
const includeRoles = { roleAssignments: true } satisfies Prisma.UserInclude;
async function loadRequest(
  tx: Prisma.TransactionClient,
  organizationId: string,
  requestId: string,
) {
  const event = await tx.auditEvent.findFirst({
    where: {
      organizationId,
      entityType,
      entityId: requestId,
      eventType: "CUSTOMER_ACCESS_REQUESTED",
    },
  });
  const user = await tx.user.findFirst({
    where: { id: requestId, organizationId },
    include: includeRoles,
  });
  if (!event || !user) notFound("Customer account request");
  if (
    !user.roleAssignments.length ||
    user.roleAssignments.some((role) => role.role !== "CUSTOMER")
  )
    conflict("This identity is managed as a team member");
  return { event, user, details: DetailsSchema.parse(event.metadata) };
}
async function dto(organizationId: string, requestId: string) {
  const { event, user, details } = await loadRequest(
    prisma,
    organizationId,
    requestId,
  );
  return CustomerAccessDtoSchema.parse({
    ...details,
    id: user.id,
    revision: user.revision,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: event.occurredAt.toISOString(),
  });
}

export function createCustomerAccessRouter(
  sendEmail: EmailSender = deliverEmail,
): Router {
  const router = Router();
  router.get(
    "/portal/registration-context",
    portalRateLimit,
    async (request, response) => {
      const slug =
        z.string().max(80).optional().parse(request.query.organization) ||
        env.PORTAL_ORGANIZATION_SLUG;
      const organizations = await prisma.organization.findMany({
        where: slug
          ? { slug }
          : {
              users: {
                some: {
                  status: "ACTIVE",
                  roleAssignments: { some: { role: "ADMIN", active: true } },
                },
              },
            },
        select: { name: true, slug: true },
        take: 2,
      });
      if (organizations.length !== 1)
        notFound(
          "Registration link; ask your sales team for their customer registration link",
        );
      response.json(organizations[0]);
    },
  );
  router.post(
    "/portal/account-requests",
    portalRateLimit,
    async (request, response) => {
      const input = parseBody(CustomerAccessRequestSchema, request);
      const organization = await prisma.organization.findUnique({
        where: { slug: input.organization },
      });
      if (!organization) notFound("Organization");
      await prisma.$transaction(async (tx) => {
        // Serialize duplicate submissions without revealing whether an email is registered.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.email}))`;
        if (await tx.user.findUnique({ where: { email: input.email } })) return;
        const user = await tx.user.create({
          data: {
            organizationId: organization.id,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            status: "INVITED",
            roleAssignments: {
              create: {
                organizationId: organization.id,
                role: "CUSTOMER",
                active: false,
              },
            },
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: organization.id,
            actorType: "SYSTEM",
            entityType,
            entityId: user.id,
            eventType: "CUSTOMER_ACCESS_REQUESTED",
            metadata: {
              companyName: input.companyName,
              message: input.message,
              status: "PENDING",
              emailStatus: "NONE",
              reason: "",
            },
          },
        });
        const admins = await tx.user.findMany({
          where: {
            organizationId: organization.id,
            status: "ACTIVE",
            roleAssignments: {
              some: {
                organizationId: organization.id,
                role: "ADMIN",
                active: true,
              },
            },
          },
          select: { id: true },
        });
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            organizationId: organization.id,
            recipientUserId: admin.id,
            channel: "IN_APP",
            type: "CUSTOMER_ACCESS_REQUESTED",
            title: "Customer account request",
            body:
              input.firstName +
              " " +
              input.lastName +
              " requested access for " +
              input.companyName,
            data: { href: "/settings/customer-requests", requestId: user.id },
            status: "SENT",
            sentAt: new Date(),
          })),
        });
      });
      response.status(202).json({ accepted: true });
    },
  );
  router.get(
    "/customer-access/requests",
    authenticateInternal,
    requireCapability("configuration.manage"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const query = parseQuery(ListQuerySchema, request);
      const status = z
        .enum(["PENDING", "APPROVED", "DECLINED"])
        .optional()
        .parse(request.query.status);
      const events = await prisma.auditEvent.findMany({
        where: {
          organizationId: actor.organizationId,
          entityType,
          eventType: "CUSTOMER_ACCESS_REQUESTED",
          ...(status ? { metadata: { path: ["status"], equals: status } } : {}),
        },
        orderBy: { id: "asc" },
        ...cursorArgs(query.cursor, query.limit),
      });
      const rows = await Promise.all(
        events.map((event) => dto(actor.organizationId, event.entityId)),
      );
      const page = pageFromRows(events, query.limit);
      response.json({
        items: rows.slice(0, query.limit),
        pageInfo: page.pageInfo,
      });
    },
  );

  async function sendDecision(
    organizationId: string,
    requestId: string,
    password: string | undefined,
    revision: number,
  ) {
    const { event, user, details } = await loadRequest(
      prisma,
      organizationId,
      requestId,
    );
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const approved = details.status === "APPROVED";
    const link = new URL("/portal/login", env.WEB_ORIGIN).toString();
    try {
      await sendEmail(
        {
          to: user.email,
          subject: approved
            ? "Your customer account is approved"
            : "Your customer account request",
          text: approved
            ? "Hello " +
              user.firstName +
              ",\n\n" +
              organization.name +
              " has approved your customer account.\n\nSign in: " +
              link +
              "\nEmail: " +
              user.email +
              "\nPassword: " +
              password +
              "\n\nYou can change this password in the customer portal after signing in.\n"
            : "Hello " +
              user.firstName +
              ",\n\n" +
              organization.name +
              " declined your customer account request.\n\nReason: " +
              details.reason +
              "\n\nContact your sales representative if you need help.\n",
        },
        event.id + "-" + revision,
      );
    } catch {
      await prisma.auditEvent.update({
        where: { id: event.id },
        data: { metadata: { ...details, emailStatus: "FAILED" } },
      });
      return;
    }
    await prisma.$transaction(async (tx) => {
      const claim = await tx.user.updateMany({
        where: { id: user.id, organizationId, revision },
        data: { status: approved ? "ACTIVE" : "DISABLED" },
      });
      if (!claim.count) conflict("The request changed while email was sending");
      if (approved) {
        await tx.roleAssignment.updateMany({
          where: { userId: user.id, organizationId, role: "CUSTOMER" },
          data: { active: true },
        });
        await tx.customerContact.update({
          where: { id: details.contactId! },
          data: { portalEnabled: true, status: "ACTIVE" },
        });
        await tx.portalIdentity.update({
          where: { id: details.identityId! },
          data: { status: "ACTIVE" },
        });
      }
      await tx.auditEvent.update({
        where: { id: event.id },
        data: { metadata: { ...details, emailStatus: "SENT" } },
      });
    });
  }

  router.post(
    "/customer-access/requests/:requestId/decision",
    authenticateInternal,
    requireCapability("configuration.manage"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const requestId = parsePathId(request, "requestId");
      const input = parseBody(CustomerAccessDecisionSchema, request);
      const password =
        input.decision === "APPROVE" ? randomToken(18) : undefined;
      const passwordHash = password
        ? await Bun.password.hash(password, { algorithm: "argon2id" })
        : null;
      const revision = await prisma.$transaction(async (tx) => {
        const { event, user, details } = await loadRequest(
          tx,
          actor.organizationId,
          requestId,
        );
        if (details.status !== "PENDING")
          conflict("This request has already been reviewed");
        const claim = await tx.user.updateMany({
          where: {
            id: user.id,
            organizationId: actor.organizationId,
            revision: input.revision,
            status: "INVITED",
          },
          data: { revision: { increment: 1 }, passwordHash },
        });
        if (!claim.count)
          conflict("The request changed. Reload before deciding.");
        if (input.decision === "APPROVE") {
          const organization = await tx.organization.findUniqueOrThrow({
            where: { id: actor.organizationId },
          });
          let account = input.customerAccountId
            ? await tx.customerAccount.findFirst({
                where: {
                  id: input.customerAccountId,
                  organizationId: actor.organizationId,
                  status: "ACTIVE",
                },
              })
            : null;
          if (input.customerAccountId && !account) notFound("Active customer");
          if (!account) {
            const tier = await tx.customerTier.findFirst({
              where: {
                id: input.tierId,
                organizationId: actor.organizationId,
                status: "ACTIVE",
              },
            });
            if (!tier) notFound("Customer tier");
            account = await tx.customerAccount.create({
              data: {
                organizationId: actor.organizationId,
                tierId: tier.id,
                name: details.companyName,
                accountCode: "CUST-" + randomToken(9),
                preferredCurrency: organization.baseCurrency,
              },
            });
          }
          const existingIdentity = await tx.portalIdentity.findUnique({
            where: {
              organizationId_email: {
                organizationId: actor.organizationId,
                email: user.email,
              },
            },
            include: { customerContact: true },
          });
          if (
            existingIdentity &&
            existingIdentity.customerContact.customerAccountId !== account.id
          )
            conflict(
              "This email already belongs to another customer. Select that customer account.",
            );
          const contact = await tx.customerContact.upsert({
            where: {
              organizationId_customerAccountId_email: {
                organizationId: actor.organizationId,
                customerAccountId: account.id,
                email: user.email,
              },
            },
            create: {
              organizationId: actor.organizationId,
              customerAccountId: account.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              portalEnabled: false,
            },
            update: {},
          });
          const identity =
            existingIdentity ??
            (await tx.portalIdentity.create({
              data: {
                organizationId: actor.organizationId,
                customerContactId: contact.id,
                email: user.email,
                status: "DISABLED",
              },
            }));
          Object.assign(details, {
            accountId: account.id,
            contactId: contact.id,
            identityId: identity.id,
          });
        }
        Object.assign(details, {
          status: input.decision === "APPROVE" ? "APPROVED" : "DECLINED",
          emailStatus: "PENDING",
          reason: input.reason,
          attemptAt: new Date().toISOString(),
        });
        await tx.auditEvent.update({
          where: { id: event.id },
          data: { metadata: details },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: actor.organizationId,
            actorType: "USER",
            actorId: actor.userId,
            entityType,
            entityId: user.id,
            eventType: "CUSTOMER_ACCESS_" + details.status,
            reason: input.reason || null,
            metadata: { requestEventId: event.id },
          },
        });
        return input.revision + 1;
      });
      await sendDecision(actor.organizationId, requestId, password, revision);
      response.json(await dto(actor.organizationId, requestId));
    },
  );
  router.post(
    "/customer-access/requests/:requestId/retry-email",
    authenticateInternal,
    requireCapability("configuration.manage"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const requestId = parsePathId(request, "requestId");
      const input = parseBody(RevisionPreconditionSchema, request);
      const password = randomToken(18);
      const passwordHash = await Bun.password.hash(password, {
        algorithm: "argon2id",
      });
      await prisma.$transaction(async (tx) => {
        const { event, user, details } = await loadRequest(
          tx,
          actor.organizationId,
          requestId,
        );
        if (
          details.status === "PENDING" ||
          details.emailStatus === "SENT" ||
          (details.emailStatus === "PENDING" &&
            Date.now() - Date.parse(details.attemptAt ?? "") < 120_000)
        )
          conflict("There is no failed email to retry");
        const claim = await tx.user.updateMany({
          where: {
            id: user.id,
            organizationId: actor.organizationId,
            revision: input.revision,
            status: "INVITED",
          },
          data: {
            revision: { increment: 1 },
            passwordHash: details.status === "APPROVED" ? passwordHash : null,
          },
        });
        if (!claim.count)
          conflict("The request changed. Reload before retrying.");
        await tx.auditEvent.update({
          where: { id: event.id },
          data: {
            metadata: {
              ...details,
              emailStatus: "PENDING",
              attemptAt: new Date().toISOString(),
            },
          },
        });
      });
      await sendDecision(
        actor.organizationId,
        requestId,
        password,
        input.revision + 1,
      );
      response.json(await dto(actor.organizationId, requestId));
    },
  );
  router.post(
    "/portal/password-login",
    loginRateLimit,
    async (request, response) => {
      const input = parseBody(LoginRequestSchema, request);
      const user = await prisma.user.findUnique({
        where: { email: input.email },
        include: includeRoles,
      });
      const valid = user?.passwordHash
        ? await Bun.password.verify(input.password, user.passwordHash)
        : false;
      if (
        !valid ||
        !user ||
        user.status !== "ACTIVE" ||
        !user.roleAssignments.some(
          (role) =>
            role.organizationId === user.organizationId &&
            role.role === "CUSTOMER" &&
            role.active,
        )
      )
        unauthorized(
          "The email or password is incorrect, or access has not been approved.",
        );
      const identity = await prisma.portalIdentity.findUnique({
        where: {
          organizationId_email: {
            organizationId: user.organizationId,
            email: user.email,
          },
        },
        include: { customerContact: { include: { customerAccount: true } } },
      });
      if (
        !identity ||
        identity.status !== "ACTIVE" ||
        !identity.customerContact.portalEnabled ||
        identity.customerContact.status !== "ACTIVE" ||
        identity.customerContact.customerAccount.status !== "ACTIVE"
      )
        unauthorized("Customer access is disabled");
      const token = randomToken();
      const csrf = randomToken();
      await prisma.$transaction(async (tx) => {
        await tx.portalSession.create({
          data: {
            organizationId: user.organizationId,
            portalIdentityId: identity.id,
            customerAccountId: identity.customerContact.customerAccountId,
            tokenHash: hashToken(token),
            expiresAt: new Date(
              Date.now() + env.PORTAL_SESSION_TTL_MINUTES * 60_000,
            ),
          },
        });
        await tx.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          },
        });
      });
      setPortalCookies(response, { session: token, csrf });
      response.json({ success: true });
    },
  );
  router.post(
    "/portal/password",
    authenticatePortal,
    requireCsrf,
    async (request, response) => {
      const actor = portalPrincipal(response);
      const input = parseBody(
        z
          .object({
            currentPassword: z.string().min(1).max(128),
            password: z.string().min(12).max(128),
          })
          .strict(),
        request,
      );
      const user = await prisma.user.findUnique({
        where: { email: actor.email },
        include: includeRoles,
      });
      if (
        !user ||
        user.organizationId !== actor.organizationId ||
        user.status !== "ACTIVE" ||
        !user.passwordHash ||
        !user.roleAssignments.some(
          (role) => role.role === "CUSTOMER" && role.active,
        ) ||
        !(await Bun.password.verify(input.currentPassword, user.passwordHash))
      )
        unauthorized("The current password is incorrect");
      const passwordHash = await Bun.password.hash(input.password, {
        algorithm: "argon2id",
      });
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.user.updateMany({
          where: { id: user.id, revision: user.revision },
          data: { passwordHash, revision: { increment: 1 } },
        });
        if (!claimed.count) conflict("The password changed. Sign in again.");
        await tx.portalSession.updateMany({
          where: {
            portalIdentityId: actor.portalIdentityId,
            id: { not: actor.sessionId },
          },
          data: { revokedAt: new Date() },
        });
        await tx.session.updateMany({
          where: { userId: user.id },
          data: { revokedAt: new Date() },
        });
        await tx.magicLinkToken.updateMany({
          where: { portalIdentityId: actor.portalIdentityId, usedAt: null },
          data: { revokedAt: new Date() },
        });
      });
      response.json({ success: true });
    },
  );
  return router;
}
