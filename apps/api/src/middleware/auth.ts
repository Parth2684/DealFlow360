import type { NextFunction, Request, Response } from "express";

import {
  CSRF_HEADER,
  PORTAL_SESSION_COOKIE_NAME,
  ROLE_CAPABILITIES,
  RoleSchema,
  SESSION_COOKIE_NAME,
  type Capability,
} from "@repo/common";
import { prisma } from "@repo/db";

import { env } from "../config/env.js";
import {
  CSRF_COOKIE_NAME,
  PORTAL_CSRF_COOKIE_NAME,
  readCookies,
} from "../shared/cookies.js";
import { forbidden, unauthorized } from "../shared/errors.js";
import { hashToken, safeTokenEqual } from "../shared/security.js";
import type { InternalPrincipal, PortalPrincipal } from "../shared/types.js";

function metadataCsrfHash(metadata: unknown): string {
  if (
    metadata === null ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return "";
  }
  const value = Reflect.get(metadata, "csrfHash");
  return typeof value === "string" ? value : "";
}

export async function authenticateInternal(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = readCookies(request)[SESSION_COOKIE_NAME];
    if (token === undefined) unauthorized();
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          include: {
            roleAssignments: {
              where: { active: true },
            },
          },
        },
      },
    });
    if (
      session === null ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date() ||
      session.organizationId !== session.user.organizationId ||
      session.user.status !== "ACTIVE"
    ) {
      unauthorized("The session is missing, expired, or revoked");
    }

    const tenantAssignments = session.user.roleAssignments.filter(
      (assignment) => assignment.organizationId === session.organizationId,
    );
    const roles = tenantAssignments.map((assignment) =>
      RoleSchema.parse(assignment.role),
    );
    const capabilities = [
      ...new Set(roles.flatMap((role) => ROLE_CAPABILITIES[role])),
    ];
    const principal: InternalPrincipal = {
      kind: "internal",
      sessionId: session.id,
      sessionExpiresAt: session.expiresAt,
      organizationId: session.organizationId,
      userId: session.userId,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      roles,
      capabilities,
      salesTeamIds: tenantAssignments.flatMap((assignment) =>
        assignment.salesTeamId === null ? [] : [assignment.salesTeamId],
      ),
      csrfHash: metadataCsrfHash(session.metadata),
    };
    response.locals.internalPrincipal = principal;
    void prisma.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      })
      .catch((error: unknown) => {
        console.error("Could not update authenticated session activity", error);
      });
    next();
  } catch (error) {
    next(error);
  }
}

export async function authenticatePortal(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = readCookies(request)[PORTAL_SESSION_COOKIE_NAME];
    if (token === undefined)
      unauthorized("A customer portal session is required");
    const session = await prisma.portalSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        portalIdentity: {
          include: {
            customerContact: { include: { customerAccount: true } },
          },
        },
      },
    });
    if (
      session === null ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date() ||
      session.organizationId !== session.portalIdentity.organizationId ||
      session.customerAccountId !==
        session.portalIdentity.customerContact.customerAccountId ||
      session.portalIdentity.status !== "ACTIVE" ||
      !session.portalIdentity.customerContact.portalEnabled ||
      session.portalIdentity.customerContact.status !== "ACTIVE" ||
      session.portalIdentity.customerContact.customerAccount.status !== "ACTIVE"
    ) {
      unauthorized("The portal session is missing, expired, or revoked");
    }
    const principal: PortalPrincipal = {
      kind: "portal",
      sessionId: session.id,
      organizationId: session.organizationId,
      portalIdentityId: session.portalIdentityId,
      customerAccountId: session.customerAccountId,
      quoteId: session.quoteId,
      email: session.portalIdentity.email,
    };
    response.locals.portalPrincipal = principal;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireCapability(capability: Capability) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    const principal = response.locals.internalPrincipal;
    if (principal === undefined) {
      next(new Error("authenticateInternal must run before requireCapability"));
      return;
    }
    if (!principal.capabilities.includes(capability)) {
      try {
        forbidden(`Capability ${capability} is required`);
      } catch (error) {
        next(error);
      }
      return;
    }
    next();
  };
}

export function requireAnyCapability(...capabilities: Capability[]) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    const actor = internalPrincipal(response);
    if (
      capabilities.some((capability) => actor.capabilities.includes(capability))
    )
      next();
    else {
      try {
        forbidden("Your role cannot access this workspace");
      } catch (error) {
        next(error);
      }
    }
  };
}

export function requireCsrf(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  try {
    const origin = request.get("origin");
    if (origin !== undefined && origin !== env.WEB_ORIGIN) {
      forbidden("The mutation origin is not trusted");
    }
    const supplied = request.get(CSRF_HEADER);
    const cookies = readCookies(request);
    const internal = response.locals.internalPrincipal;
    const portal = response.locals.portalPrincipal;
    const cookieToken =
      internal === undefined
        ? cookies[PORTAL_CSRF_COOKIE_NAME]
        : cookies[CSRF_COOKIE_NAME];
    if (
      supplied === undefined ||
      cookieToken === undefined ||
      !safeTokenEqual(supplied, cookieToken)
    ) {
      forbidden("A valid CSRF token is required");
    }
    if (
      internal !== undefined &&
      !safeTokenEqual(hashToken(supplied), internal.csrfHash)
    ) {
      forbidden("The CSRF token does not belong to this session");
    }
    if (internal === undefined && portal === undefined) {
      unauthorized();
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRefreshCsrf(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  try {
    const origin = request.get("origin");
    if (origin !== undefined && origin !== env.WEB_ORIGIN) {
      forbidden("The mutation origin is not trusted");
    }
    const supplied = request.get(CSRF_HEADER);
    const cookieToken = readCookies(request)[CSRF_COOKIE_NAME];
    if (
      supplied === undefined ||
      cookieToken === undefined ||
      !safeTokenEqual(supplied, cookieToken)
    ) {
      forbidden("A valid CSRF token is required");
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function internalPrincipal(response: Response): InternalPrincipal {
  const principal = response.locals.internalPrincipal;
  if (principal === undefined) unauthorized();
  return principal;
}

export function portalPrincipal(response: Response): PortalPrincipal {
  const principal = response.locals.portalPrincipal;
  if (principal === undefined)
    unauthorized("A customer portal session is required");
  return principal;
}
