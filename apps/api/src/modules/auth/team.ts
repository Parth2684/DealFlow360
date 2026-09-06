import { Router } from "express";
import {
  ListQuerySchema,
  TeamMemberCreateSchema,
  TeamMemberDtoSchema,
  TeamMemberUpdateSchema,
} from "@repo/common";
import { prisma, type Prisma } from "@repo/db";
import {
  authenticateInternal,
  internalPrincipal,
  requireCapability,
  requireCsrf,
} from "../../middleware/auth.js";
import {
  cursorArgs,
  pageFromRows,
  parseBody,
  parsePathId,
  parseQuery,
} from "../../shared/http.js";
import { conflict, notFound } from "../../shared/errors.js";

const include = {
  roleAssignments: { where: { active: true } },
} satisfies Prisma.UserInclude;
const mapMember = (user: Prisma.UserGetPayload<{ include: typeof include }>) =>
  TeamMemberDtoSchema.parse({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    revision: user.revision,
    roles: user.roleAssignments
      .filter(
        (role) =>
          role.organizationId === user.organizationId &&
          role.role !== "CUSTOMER",
      )
      .map((role) => role.role),
  });

export function createTeamRouter(): Router {
  const router = Router();
  router.get(
    "/team/members",
    authenticateInternal,
    requireCapability("configuration.manage"),
    async (request, response) => {
      const actor = internalPrincipal(response);
      const query = parseQuery(ListQuerySchema, request);
      const rows = await prisma.user.findMany({
        where: {
          organizationId: actor.organizationId,
          roleAssignments: {
            some: { role: { not: "CUSTOMER" }, active: true },
          },
          ...(query.search
            ? {
                OR: [
                  { email: { contains: query.search, mode: "insensitive" } },
                  {
                    firstName: { contains: query.search, mode: "insensitive" },
                  },
                  { lastName: { contains: query.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include,
        orderBy: { id: "asc" },
        ...cursorArgs(query.cursor, query.limit),
      });
      response.json(pageFromRows(rows.map(mapMember), query.limit));
    },
  );
  router.post(
    "/team/members",
    authenticateInternal,
    requireCapability("configuration.manage"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const input = parseBody(TeamMemberCreateSchema, request);
      const passwordHash = await Bun.password.hash(input.password, {
        algorithm: "argon2id",
      });
      const user = await prisma.user.create({
        data: {
          organizationId: actor.organizationId,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash,
          status: "ACTIVE",
          roleAssignments: {
            create: [...new Set(input.roles)].map((role) => ({
              organizationId: actor.organizationId,
              role,
            })),
          },
        },
        include,
      });
      response.status(201).json(mapMember(user));
    },
  );
  router.patch(
    "/team/members/:userId",
    authenticateInternal,
    requireCapability("configuration.manage"),
    requireCsrf,
    async (request, response) => {
      const actor = internalPrincipal(response);
      const userId = parsePathId(request, "userId");
      const input = parseBody(TeamMemberUpdateSchema, request);
      if (
        userId === actor.userId &&
        ((input.status && input.status !== "ACTIVE") ||
          (input.roles && !input.roles.includes("ADMIN")))
      )
        conflict(
          "Ask another administrator to change your administrator access",
        );
      const passwordHash = input.password
        ? await Bun.password.hash(input.password, { algorithm: "argon2id" })
        : undefined;
      const user = await prisma.$transaction(async (tx) => {
        const current = await tx.user.findFirst({
          where: { id: userId, organizationId: actor.organizationId },
        });
        if (!current) notFound("Team member");
        if (
          await tx.roleAssignment.count({
            where: {
              userId,
              organizationId: actor.organizationId,
              role: "CUSTOMER",
            },
          })
        )
          conflict("Manage customer access from Customer Requests");
        const claimed = await tx.user.updateMany({
          where: {
            id: userId,
            organizationId: actor.organizationId,
            revision: input.revision,
          },
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            status: input.status,
            passwordHash,
            revision: { increment: 1 },
          },
        });
        if (claimed.count !== 1)
          conflict(
            "The team member changed; reload before saving",
            "REVISION_CONFLICT",
          );
        if (input.roles) {
          await tx.roleAssignment.deleteMany({
            where: { userId, organizationId: actor.organizationId },
          });
          await tx.roleAssignment.createMany({
            data: [...new Set(input.roles)].map((role) => ({
              organizationId: actor.organizationId,
              userId,
              role,
            })),
          });
        }
        if (passwordHash || input.status || input.roles) {
          await tx.session.updateMany({
            where: { userId, organizationId: actor.organizationId },
            data: { revokedAt: new Date() },
          });
          await tx.refreshToken.updateMany({
            where: {
              organizationId: actor.organizationId,
              session: { userId },
            },
            data: { revokedAt: new Date() },
          });
        }
        return tx.user.findUniqueOrThrow({ where: { id: userId }, include });
      });
      response.json(mapMember(user));
    },
  );
  return router;
}
