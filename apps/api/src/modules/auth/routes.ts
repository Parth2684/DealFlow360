import { Router } from "express";

import {
  AuthResponseSchema,
  CurrentUserResponseSchema,
  LoginRequestSchema,
  LogoutResponseSchema,
  MagicLinkCreatedResponseSchema,
  MagicLinkRequestSchema,
  PortalLogoutRequestSchema,
  PortalLogoutResponseSchema,
  PortalSessionExchangeRequestSchema,
  PortalSessionResponseSchema,
  RefreshSessionRequestSchema,
  ROLE_CAPABILITIES,
  RoleSchema,
  SignupRequestSchema,
  resolveOrganizationLocale,
  type Capability,
  type MagicLinkRequest,
  type Role,
} from "@repo/common";
import { prisma, type Prisma } from "@repo/db";

import { env } from "../../config/env.js";
import {
  authenticateInternal,
  authenticatePortal,
  internalPrincipal,
  portalPrincipal,
  requireCsrf,
  requireRefreshCsrf,
} from "../../middleware/auth.js";
import {
  loginRateLimit,
  portalRateLimit,
} from "../../middleware/rate-limit.js";
import {
  clearPortalCookies,
  clearInternalCookies,
  readCookies,
  REFRESH_COOKIE_NAME,
  setInternalCookies,
  setPortalCookies,
} from "../../shared/cookies.js";
import { conflict, HttpError, unauthorized } from "../../shared/errors.js";
import { parseBody } from "../../shared/http.js";
import { portalShareabilityWhere } from "../../shared/portal-access.js";
import { hashToken, randomToken } from "../../shared/security.js";
import { deliverEmail, emailConfigured } from "../../shared/email.js";

interface UserForAuth {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "DISABLED";
}

interface OrganizationForAuth {
  id: string;
  name: string;
  slug: string;
  baseCurrency: string;
  timezone: string;
  settings: unknown;
}

const magicLinkContactInclude = {
  customerAccount: true,
  portalIdentity: true,
} satisfies Prisma.CustomerContactInclude;

type MagicLinkContact = Prisma.CustomerContactGetPayload<{
  include: typeof magicLinkContactInclude;
}>;

async function resolveMagicLinkContact(
  input: MagicLinkRequest,
): Promise<MagicLinkContact | null> {
  if (input.quoteId !== undefined) {
    const target = await prisma.quote.findUnique({
      where: { id: input.quoteId },
      select: { organizationId: true, customerAccountId: true },
    });
    if (target === null) return null;
    const contact = await prisma.customerContact.findFirst({
      where: {
        organizationId: target.organizationId,
        customerAccountId: target.customerAccountId,
        email: input.email,
        portalEnabled: true,
        status: "ACTIVE",
      },
      include: magicLinkContactInclude,
    });
    if (contact === null) return null;
    const sharedQuote = await prisma.quote.findFirst({
      where: {
        id: input.quoteId,
        organizationId: target.organizationId,
        customerAccountId: target.customerAccountId,
        ...portalShareabilityWhere(target.customerAccountId),
      },
      select: { id: true },
    });
    return sharedQuote === null ? null : contact;
  }

  // Customer-scoped links without a quote are only issued when the email maps
  // to exactly one tenant/customer. Ambiguous cross-tenant email matches keep
  // the same generic 202 response but deliberately produce no token.
  const candidates = await prisma.customerContact.findMany({
    where: {
      email: input.email,
      portalEnabled: true,
      status: "ACTIVE",
      customerAccount: { status: "ACTIVE" },
    },
    include: magicLinkContactInclude,
    orderBy: { id: "asc" },
    take: 2,
  });
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}

function uniqueRoles(values: readonly string[]): Role[] {
  return [...new Set(values.map((value) => RoleSchema.parse(value)))];
}

function capabilitiesFor(roles: readonly Role[]): Capability[] {
  return [...new Set(roles.flatMap((role) => ROLE_CAPABILITIES[role]))];
}

function authResponse(
  user: UserForAuth,
  organization: OrganizationForAuth,
  roles: Role[],
  csrfToken: string,
  sessionExpiresAt: Date,
) {
  return AuthResponseSchema.parse({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles,
      capabilities: capabilitiesFor(roles),
    },
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      baseCurrency: organization.baseCurrency,
      locale: resolveOrganizationLocale(organization.settings),
      timezone: organization.timezone,
    },
    csrfToken,
    sessionExpiresAt: sessionExpiresAt.toISOString(),
  });
}

async function createSession(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  familyId: string = crypto.randomUUID(),
) {
  const sessionToken = randomToken();
  const refreshToken = randomToken();
  const csrfToken = randomToken(24);
  const sessionExpiresAt = new Date(
    Date.now() + env.SESSION_TTL_HOURS * 3_600_000,
  );
  const refreshExpiresAt = new Date(
    Date.now() + env.REFRESH_TTL_DAYS * 86_400_000,
  );
  const session = await transaction.session.create({
    data: {
      organizationId,
      userId,
      tokenHash: hashToken(sessionToken),
      expiresAt: sessionExpiresAt,
      metadata: { csrfHash: hashToken(csrfToken) },
    },
  });
  const refresh = await transaction.refreshToken.create({
    data: {
      organizationId,
      sessionId: session.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: refreshExpiresAt,
    },
  });
  return {
    session,
    refresh,
    raw: { session: sessionToken, refresh: refreshToken, csrf: csrfToken },
  };
}

function slugFromName(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "organization";
  return `${base}-${randomToken(5).toLowerCase()}`;
}

export function createAuthRouter(): Router {
  const router = Router();

  router.get(
    "/portal/session",
    authenticatePortal,
    async (_request, response) => {
      const actor = portalPrincipal(response);
      const session = await prisma.portalSession.findUniqueOrThrow({
        where: { id: actor.sessionId },
        include: {
          organization: true,
          portalIdentity: {
            include: {
              customerContact: { include: { customerAccount: true } },
            },
          },
        },
      });
      response.json(
        PortalSessionResponseSchema.parse({
          portalIdentity: {
            id: actor.portalIdentityId,
            email: actor.email,
            customerAccountId: actor.customerAccountId,
            customerName:
              session.portalIdentity.customerContact.customerAccount.name,
          },
          quoteId: actor.quoteId,
          scope: actor.quoteId ? "QUOTE" : "CUSTOMER",
          formatting: {
            locale: resolveOrganizationLocale(session.organization.settings),
            timezone: session.organization.timezone,
          },
          expiresAt: session.expiresAt.toISOString(),
        }),
      );
    },
  );

  router.post("/auth/signup", loginRateLimit, async (request, response) => {
    const input = parseBody(SignupRequestSchema, request);
    const passwordHash = await Bun.password.hash(input.password, {
      algorithm: "argon2id",
    });
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (existing !== null)
        conflict("An account already uses this email", "EMAIL_EXISTS");
      const organization = await transaction.organization.create({
        data: {
          name: input.organizationName,
          slug: slugFromName(input.organizationName),
        },
      });
      const user = await transaction.user.create({
        data: {
          organizationId: organization.id,
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });
      await transaction.roleAssignment.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: "ADMIN",
        },
      });
      const session = await createSession(
        transaction,
        organization.id,
        user.id,
      );
      return { organization, user, session };
    });
    setInternalCookies(response, result.session.raw);
    response
      .status(201)
      .json(
        authResponse(
          result.user,
          result.organization,
          ["ADMIN"],
          result.session.raw.csrf,
          result.session.session.expiresAt,
        ),
      );
  });

  router.post("/auth/login", loginRateLimit, async (request, response) => {
    const input = parseBody(LoginRequestSchema, request);
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        organization: true,
        roleAssignments: { where: { active: true } },
      },
    });
    const valid =
      user?.passwordHash !== null && user?.passwordHash !== undefined
        ? await Bun.password.verify(input.password, user.passwordHash)
        : false;
    if (!valid || user === null || user.status !== "ACTIVE") {
      unauthorized("The email or password is incorrect");
    }
    const roles = uniqueRoles(
      user.roleAssignments
        .filter((role) => role.organizationId === user.organizationId)
        .map((role) => role.role),
    );
    if (roles.length === 1 && roles[0] === "CUSTOMER")
      unauthorized("Use Customer Portal Sign In with your email and password.");
    const session = await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      return createSession(transaction, user.organizationId, user.id);
    });
    setInternalCookies(response, session.raw);
    response.json(
      authResponse(
        user,
        user.organization,
        roles,
        session.raw.csrf,
        session.session.expiresAt,
      ),
    );
  });

  router.post(
    "/auth/logout",
    authenticateInternal,
    requireCsrf,
    async (_request, response) => {
      const principal = internalPrincipal(response);
      await prisma.$transaction([
        prisma.session.update({
          where: { id: principal.sessionId },
          data: { revokedAt: new Date() },
        }),
        prisma.refreshToken.updateMany({
          where: { sessionId: principal.sessionId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
      clearInternalCookies(response);
      response.json(LogoutResponseSchema.parse({ success: true }));
    },
  );

  router.get("/auth/me", authenticateInternal, async (_request, response) => {
    const principal = internalPrincipal(response);
    const organization = await prisma.organization.findUnique({
      where: { id: principal.organizationId },
    });
    if (organization === null) unauthorized();
    const csrfToken = readCookies(_request)["csrf_token"];
    if (csrfToken === undefined)
      unauthorized("The session CSRF token is missing");
    response.json(
      CurrentUserResponseSchema.parse(
        authResponse(
          {
            id: principal.userId,
            email: principal.email,
            firstName: principal.firstName,
            lastName: principal.lastName,
            status: "ACTIVE",
          },
          organization,
          principal.roles,
          csrfToken,
          principal.sessionExpiresAt,
        ),
      ),
    );
  });

  router.post(
    "/auth/refresh",
    requireRefreshCsrf,
    async (request, response) => {
      parseBody(RefreshSessionRequestSchema, request);
      const rawRefresh = readCookies(request)[REFRESH_COOKIE_NAME];
      if (rawRefresh === undefined) unauthorized("A refresh token is required");
      const current = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(rawRefresh) },
        include: {
          session: {
            include: {
              user: {
                include: {
                  organization: true,
                  roleAssignments: { where: { active: true } },
                },
              },
            },
          },
        },
      });
      if (current !== null && current.revokedAt !== null) {
        // A rotated token being presented again signals likely replay. Revoke the
        // complete family so a stolen descendant cannot continue rotating.
        await prisma.$transaction([
          prisma.refreshToken.updateMany({
            where: { familyId: current.familyId, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
          prisma.session.updateMany({
            where: {
              refreshTokens: { some: { familyId: current.familyId } },
              revokedAt: null,
            },
            data: { revokedAt: new Date() },
          }),
        ]);
        unauthorized("Refresh token reuse was detected");
      }
      if (
        current === null ||
        current.expiresAt <= new Date() ||
        current.session.revokedAt !== null ||
        current.organizationId !== current.session.organizationId ||
        current.organizationId !== current.session.user.organizationId ||
        current.session.user.status !== "ACTIVE"
      ) {
        unauthorized("The refresh token is missing, expired, or revoked");
      }
      const next = await prisma.$transaction(async (transaction) => {
        const rotated = await transaction.refreshToken.updateMany({
          where: { id: current.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (rotated.count !== 1) {
          unauthorized("The refresh token was already rotated");
        }
        const created = await createSession(
          transaction,
          current.organizationId,
          current.session.userId,
          current.familyId,
        );
        await transaction.refreshToken.update({
          where: { id: current.id },
          data: { replacedByTokenId: created.refresh.id },
        });
        await transaction.session.update({
          where: { id: current.sessionId },
          data: { revokedAt: new Date() },
        });
        return created;
      });
      const roles = uniqueRoles(
        current.session.user.roleAssignments
          .filter((role) => role.organizationId === current.organizationId)
          .map((role) => role.role),
      );
      setInternalCookies(response, next.raw);
      response.json(
        authResponse(
          current.session.user,
          current.session.user.organization,
          roles,
          next.raw.csrf,
          next.session.expiresAt,
        ),
      );
    },
  );

  router.post(
    "/portal/magic-links",
    portalRateLimit,
    async (request, response) => {
      const input = parseBody(MagicLinkRequestSchema, request);
      if (env.NODE_ENV === "production" && !emailConfigured()) {
        throw new HttpError(
          503,
          "Email unavailable",
          "Customer sign-in email is not configured. Contact your sales team.",
          { code: "EMAIL_UNAVAILABLE" },
        );
      }
      const expiresAt = new Date(
        Date.now() + env.MAGIC_LINK_TTL_MINUTES * 60_000,
      );
      const rawToken = randomToken(40);
      const contact = await resolveMagicLinkContact(input);
      if (
        contact !== null &&
        contact.customerAccount.status === "ACTIVE" &&
        (contact.portalIdentity === null ||
          contact.portalIdentity.status === "ACTIVE")
      ) {
        await prisma.$transaction(async (transaction) => {
          const identity =
            contact.portalIdentity ??
            (await transaction.portalIdentity.create({
              data: {
                organizationId: contact.organizationId,
                customerContactId: contact.id,
                email: contact.email,
              },
            }));
          await transaction.magicLinkToken.create({
            data: {
              organizationId: contact.organizationId,
              portalIdentityId: identity.id,
              customerAccountId: contact.customerAccountId,
              quoteId: input.quoteId,
              tokenHash: hashToken(rawToken),
              scope: input.scope,
              expiresAt,
            },
          });
        });
        if (emailConfigured()) {
          try {
            const link = new URL("/portal/login", env.WEB_ORIGIN);
            link.searchParams.set("token", rawToken);
            await deliverEmail(
              {
                to: contact.email,
                subject: "Your DealFlow360 sign-in link",
                text: `Sign in to your customer account: ${link.toString()}\nThis link expires in ${env.MAGIC_LINK_TTL_MINUTES} minutes and can be used once.`,
              },
              hashToken(rawToken),
            );
          } catch (error) {
            await prisma.magicLinkToken.updateMany({
              where: { tokenHash: hashToken(rawToken) },
              data: { revokedAt: new Date() },
            });
            if (error instanceof HttpError) throw error;
            throw new HttpError(
              503,
              "Email unavailable",
              "The access email could not be delivered. Try again later.",
              { code: "EMAIL_UNAVAILABLE" },
            );
          }
        } else if (env.NODE_ENV !== "production") {
          response.setHeader("X-Demo-Magic-Token", rawToken);
        }
      }
      response.status(202).json(
        MagicLinkCreatedResponseSchema.parse({
          accepted: true,
          // The response is deliberately identical for unknown emails,
          // unshareable quote IDs, and accepted requests to prevent enumeration.
          expiresAt: expiresAt.toISOString(),
        }),
      );
    },
  );

  router.post(
    "/portal/session/exchange",
    portalRateLimit,
    async (request, response) => {
      const input = parseBody(PortalSessionExchangeRequestSchema, request);
      const token = await prisma.magicLinkToken.findUnique({
        where: { tokenHash: hashToken(input.token) },
        include: {
          organization: { select: { settings: true, timezone: true } },
          portalIdentity: {
            include: {
              customerContact: { include: { customerAccount: true } },
            },
          },
        },
      });
      if (
        token === null ||
        token.revokedAt !== null ||
        token.expiresAt <= new Date() ||
        token.useCount >= token.maxUses ||
        token.organizationId !== token.portalIdentity.organizationId ||
        token.customerAccountId !==
          token.portalIdentity.customerContact.customerAccountId ||
        token.portalIdentity.status !== "ACTIVE" ||
        !token.portalIdentity.customerContact.portalEnabled ||
        token.portalIdentity.customerContact.status !== "ACTIVE" ||
        token.portalIdentity.customerContact.customerAccount.status !== "ACTIVE"
      ) {
        throw new HttpError(
          401,
          "Invalid magic link",
          "The link is invalid, expired, or already used",
          {
            code: "MAGIC_LINK_INVALID",
          },
        );
      }
      const rawSession = randomToken();
      const csrf = randomToken(24);
      const expiresAt = new Date(
        Date.now() + env.PORTAL_SESSION_TTL_MINUTES * 60_000,
      );
      await prisma.$transaction(async (transaction) => {
        const consumed = await transaction.magicLinkToken.updateMany({
          where: {
            id: token.id,
            revokedAt: null,
            expiresAt: { gt: new Date() },
            // Optimistic compare-and-swap makes a one-use token atomic even when
            // two exchange requests read it at the same time.
            useCount: token.useCount,
          },
          data: { useCount: { increment: 1 }, usedAt: new Date() },
        });
        if (consumed.count !== 1) {
          throw new HttpError(
            401,
            "Invalid magic link",
            "The link is invalid, expired, or already used",
            { code: "MAGIC_LINK_INVALID" },
          );
        }
        await transaction.portalIdentity.update({
          where: { id: token.portalIdentityId },
          data: { lastLoginAt: new Date() },
        });
        await transaction.portalSession.create({
          data: {
            organizationId: token.organizationId,
            portalIdentityId: token.portalIdentityId,
            customerAccountId: token.customerAccountId,
            quoteId: token.quoteId,
            tokenHash: hashToken(rawSession),
            expiresAt,
          },
        });
      });
      setPortalCookies(response, { session: rawSession, csrf });
      response.json(
        PortalSessionResponseSchema.parse({
          portalIdentity: {
            id: token.portalIdentityId,
            email: token.portalIdentity.email,
            customerAccountId: token.customerAccountId,
            customerName:
              token.portalIdentity.customerContact.customerAccount.name,
          },
          quoteId: token.quoteId,
          scope: token.scope,
          formatting: {
            locale: resolveOrganizationLocale(token.organization.settings),
            timezone: token.organization.timezone,
          },
          expiresAt: expiresAt.toISOString(),
        }),
      );
    },
  );

  router.post(
    "/portal/session/logout",
    authenticatePortal,
    requireCsrf,
    async (request, response) => {
      parseBody(PortalLogoutRequestSchema, request);
      const principal = portalPrincipal(response);
      await prisma.portalSession.updateMany({
        where: {
          id: principal.sessionId,
          organizationId: principal.organizationId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      clearPortalCookies(response);
      response.json(PortalLogoutResponseSchema.parse({ success: true }));
    },
  );

  return router;
}
