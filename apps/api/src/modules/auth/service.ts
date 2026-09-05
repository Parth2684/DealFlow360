import { prisma } from "@repo/db";
import {
  getCapabilitiesForRoles,
  OutboxEventTypes,
  type Role,
} from "@repo/contracts";
import {
  generateToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "../../shared/crypto.js";
import {
  signSessionToken,
  setSessionCookie,
  clearSessionCookie,
} from "../../middleware/auth.js";
import { writeAuditEvent, writeOutboxEvent } from "../../shared/outbox.js";
import { Errors } from "@repo/contracts";
import type { LoginInput, SignupInput } from "@repo/contracts";

const SESSION_HOURS = 8;

export class AuthService {
  async signup(input: SignupInput) {
    const existing = await prisma.user.findFirst({
      where: { email: input.email },
    });
    if (existing) throw Errors.conflict("Email already registered");

    const passwordHash = await hashPassword(input.password);

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.organizationName,
          baseCurrency: "USD",
          timezone: "UTC",
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      await tx.roleAssignment.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "ADMIN",
        },
      });

      await writeAuditEvent(tx, {
        organizationId: org.id,
        actorId: user.id,
        entityType: "organization",
        entityId: org.id,
        eventType: "organization.created",
        afterSummary: { name: org.name },
      });

      await writeOutboxEvent(tx, {
        organizationId: org.id,
        eventType: OutboxEventTypes.DEAL_ACTIVITY_RECORDED,
        payload: { type: "signup", userId: user.id },
      });

      return { org, user };
    });

    const session = await this.createSession(result.user.id, result.org.id);
    return this.buildAuthResponse(result.user, session.token);
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findFirst({
      where: { email: input.email, status: "ACTIVE" },
      include: { roleAssignments: true },
    });

    if (!user?.passwordHash) throw Errors.unauthorized("Invalid credentials");

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw Errors.unauthorized("Invalid credentials");

    const session = await this.createSession(user.id, user.organizationId);
    return this.buildAuthResponse(user, session.token);
  }

  async logout(sessionId: string | undefined, res: import("express").Response) {
    if (sessionId) {
      await prisma.session.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    clearSessionCookie(res);
  }

  async me(userId: string, organizationId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId, status: "ACTIVE" },
      include: { roleAssignments: true },
    });
    if (!user) throw Errors.notFound("User");
    return this.toAuthUser(user);
  }

  applySessionCookie(res: import("express").Response, token: string) {
    setSessionCookie(res, token);
  }

  private async createSession(userId: string, organizationId: string) {
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        organizationId,
        userId,
        tokenHash,
        expiresAt,
      },
    });

    const jwt = signSessionToken({
      sub: userId,
      org: organizationId,
      sid: session.id,
      type: "internal",
    });

    return { session, token: jwt };
  }

  private buildAuthResponse(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      organizationId: string;
      roleAssignments: Array<{ role: string }>;
    },
    token: string,
  ) {
    return {
      user: this.toAuthUser(user),
      accessToken: token,
    };
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    organizationId: string;
    roleAssignments: Array<{ role: string }>;
  }) {
    const roles = user.roleAssignments.map((r) => r.role as Role);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: user.organizationId,
      roles,
      capabilities: getCapabilitiesForRoles(roles),
    };
  }
}

export const authService = new AuthService();
