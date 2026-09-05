import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@repo/db";
import {
  getCapabilitiesForRoles,
  Errors,
  type Role,
} from "@repo/contracts";
import { hashToken } from "../shared/crypto.js";
import type { AuthContext } from "../shared/context.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const SESSION_COOKIE = "df360_session";

interface SessionPayload {
  sub: string;
  org: string;
  sid: string;
  type: "internal" | "portal";
}

export { SESSION_COOKIE };

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token =
      req.cookies?.[SESSION_COOKIE] ??
      extractBearer(req.headers.authorization);

    if (!token) return next();

    const payload = jwt.verify(token, JWT_SECRET) as SessionPayload;
    const session = await prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        organizationId: payload.org,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        tokenHash: hashToken(token),
      },
      include: {
        user: {
          include: { roleAssignments: true },
        },
      },
    });

    if (!session) return next();

    const roles = session.user.roleAssignments.map((r) => r.role as Role);
    req.auth = {
      userId: session.user.id,
      organizationId: session.organizationId,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      roles,
      capabilities: getCapabilitiesForRoles(roles),
      sessionId: session.id,
      isPortal: payload.type === "portal",
    };
    next();
  } catch {
    next();
  }
}

function extractBearer(header?: string): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7);
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function requireCapability(...capabilities: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Errors.unauthorized());
    const hasAny = capabilities.some((c) =>
      req.auth!.capabilities.includes(c as AuthContext["capabilities"][number]),
    );
    if (!hasAny) return next(Errors.forbidden());
    next();
  };
}

export function requireAllCapabilities(...capabilities: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Errors.unauthorized());
    const hasAll = capabilities.every((c) =>
      req.auth!.capabilities.includes(c as AuthContext["capabilities"][number]),
    );
    if (!hasAll) return next(Errors.forbidden());
    next();
  };
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE);
}
