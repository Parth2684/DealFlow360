import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { once } from "node:events";
import type { Server } from "node:http";
import { prisma } from "@repo/db";
import {
  MagicLinkRequestSchema,
  PortalQuoteDtoSchema,
  PortalQuoteListDtoSchema,
  PortalSessionResponseSchema,
  TeamMemberDtoSchema,
  apiRoutes,
  planApiRoutes,
} from "@repo/common";
import { createApp } from "../src/app.js";
import { hashToken, randomToken } from "../src/shared/security.js";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let server: Server;
let origin: string;
const sessions: string[] = [];
const portalSessions: string[] = [];
const cookies = new Map<string, string>();

beforeAll(async () => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Integration checks require a development database");
  server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No test address");
  origin = `http://127.0.0.1:${address.port}`;
  for (const [role, userId] of [
    ["admin", 10],
    ["sales", 11],
    ["finance", 13],
    ["operations", 14],
  ] as const) {
    const raw = randomToken();
    const session = await prisma.session.create({
      data: {
        organizationId: id(1),
        userId: id(userId),
        tokenHash: hashToken(raw),
        metadata: { csrfHash: hashToken(raw) },
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    sessions.push(session.id);
    cookies.set(role, `session=${raw}; csrf_token=${raw}`);
  }
  for (const [name, quoteId] of [
    ["customer", null],
    ["quote", id(360)],
  ] as const) {
    const raw = randomToken();
    const session = await prisma.portalSession.create({
      data: {
        organizationId: id(1),
        portalIdentityId: id(60),
        customerAccountId: id(40),
        quoteId,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    portalSessions.push(session.id);
    cookies.set(name, `portal_session=${raw}`);
  }
});

afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.session.deleteMany({ where: { id: { in: sessions } } });
  await prisma.portalSession.deleteMany({
    where: { id: { in: portalSessions } },
  });
  await prisma.$disconnect();
});

async function get(path: string, role?: string) {
  return fetch(`${origin}${path}`, {
    headers: role ? { cookie: cookies.get(role)! } : {},
  });
}

describe("route boundaries and reachable workspaces", () => {
  test("only administrators manage staff, with revision checks and session revocation", async () => {
    const email = `route-test-${randomToken(8).toLowerCase()}@example.test`;
    const cookie = cookies.get("admin")!;
    const headers = {
      cookie,
      "content-type": "application/json",
      "x-csrf-token": cookie.split("csrf_token=")[1]!,
    };
    const input = {
      email,
      firstName: "Test",
      lastName: "Colleague",
      password: randomToken(24),
      roles: ["FINANCE"],
    };
    let memberId: string | undefined;
    try {
      expect((await get(apiRoutes.team.list, "finance")).status).toBe(403);
      const response = await fetch(`${origin}${apiRoutes.team.list}`, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      });
      expect(response.status).toBe(201);
      const member = TeamMemberDtoSchema.parse(await response.json());
      memberId = member.id;
      expect(member.roles).toEqual(["FINANCE"]);
      const raw = randomToken();
      const activeSession = await prisma.session.create({
        data: {
          organizationId: id(1),
          userId: member.id,
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      const update = await fetch(
        `${origin}${apiRoutes.team.member(member.id)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            revision: member.revision,
            status: "DISABLED",
          }),
        },
      );
      expect(update.status).toBe(200);
      expect(
        (
          await prisma.session.findUniqueOrThrow({
            where: { id: activeSession.id },
          })
        ).revokedAt,
      ).not.toBeNull();
      const stale = await fetch(
        `${origin}${apiRoutes.team.member(member.id)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            revision: member.revision,
            firstName: "Stale",
          }),
        },
      );
      expect(stale.status).toBe(409);
    } finally {
      if (memberId) {
        await prisma.session.deleteMany({ where: { userId: memberId } });
        await prisma.roleAssignment.deleteMany({ where: { userId: memberId } });
        await prisma.user.delete({ where: { id: memberId } });
      }
    }
  });
  test("email alone requests account access; contradictory quote scope is rejected", () => {
    expect(
      MagicLinkRequestSchema.parse({ email: "buyer@alderridge.demo" }).scope,
    ).toBe("CUSTOMER");
    expect(
      MagicLinkRequestSchema.safeParse({
        email: "buyer@alderridge.demo",
        scope: "CUSTOMER",
        quoteId: id(360),
      }).success,
    ).toBe(false);
  });
  test("unknown paths return 404 instead of being intercepted by unrelated authentication", async () => {
    expect((await get("/api/v1/no-such-route")).status).toBe(404);
  });
  test("customer session reaches the portal without an internal login", async () => {
    const response = await get(planApiRoutes.portal.session, "customer");
    expect(response.status).toBe(200);
    expect(
      PortalSessionResponseSchema.parse(await response.json()).portalIdentity
        .customerAccountId,
    ).toBe(id(40));
    const list = await get(planApiRoutes.portal.quotes, "customer");
    expect(list.status).toBe(200);
    const page = PortalQuoteListDtoSchema.parse(await list.json());
    expect(page.items.some((row) => row.id === id(360))).toBe(true);
    expect(
      page.items.some((row) =>
        [id(190), id(300), id(330), id(390)].includes(row.id),
      ),
    ).toBe(false);
    const detail = await get(planApiRoutes.portal.quote(id(360)), "customer");
    expect(detail.status).toBe(200);
    const body = await detail.json();
    PortalQuoteDtoSchema.parse(body);
    expect(JSON.stringify(body)).not.toContain("unitCost");
    expect(body.notes).toBeNull();
    expect(
      (await get(planApiRoutes.portal.quote(id(390)), "customer")).status,
    ).toBe(404);
    expect((await get(apiRoutes.orders.list, "customer")).status).toBe(401);
  });
  test("quote-scoped sessions cannot list or open another quotation", async () => {
    const response = await get(planApiRoutes.portal.quotes, "quote");
    expect(
      PortalQuoteListDtoSchema.parse(await response.json()).items.map(
        (row) => row.id,
      ),
    ).toEqual([id(360)]);
    expect(
      (await get(planApiRoutes.portal.quote(id(450)), "quote")).status,
    ).toBe(403);
  });
  test("finance can reach order billing and standalone overdue invoices", async () => {
    for (const path of [
      apiRoutes.orders.list,
      apiRoutes.orders.detail(id(457)),
      apiRoutes.orders.billing(id(457)),
      apiRoutes.billing.invoice(id(220)),
      apiRoutes.billing.payments(id(220)),
    ]) {
      const response = await get(path, "finance");
      expect({ path, status: response.status }).toEqual({ path, status: 200 });
    }
    expect(
      (await get(apiRoutes.inventory.balances(id(160)), "finance")).status,
    ).toBe(403);
  });
  test("all primary list and detail routes return usable responses", async () => {
    const paths = [
      apiRoutes.auth.me,
      apiRoutes.quotes.list,
      apiRoutes.quotes.detail(id(190)),
      planApiRoutes.approvals.inbox,
      apiRoutes.catalog.products,
      apiRoutes.catalog.productCategories,
      apiRoutes.customers.accounts,
      apiRoutes.customers.tiers,
      apiRoutes.customers.contacts(id(40)),
      apiRoutes.pricing.priceLists,
      apiRoutes.pricing.taxes,
      apiRoutes.pricing.discountLimits,
      apiRoutes.pricing.subscriptionPlans,
      apiRoutes.inventory.warehouses,
      apiRoutes.inventory.balances(id(160)),
      apiRoutes.inventory.movements,
      apiRoutes.orders.list,
      apiRoutes.billing.invoices,
      apiRoutes.billing.creditNotes,
      apiRoutes.subscriptions.list,
      apiRoutes.subscriptions.detail(id(462)),
      apiRoutes.subscriptions.schedules(id(462)),
      apiRoutes.negotiation.workspace(id(390)),
      apiRoutes.dealHealth.alerts,
      planApiRoutes.dealHealth.dashboard,
      `${planApiRoutes.reporting.summary}?reportType=QUOTES`,
      apiRoutes.reporting.exports,
      apiRoutes.notifications.list,
    ];
    for (const path of paths) {
      const response = await get(path, "admin");
      const body = await response.json();
      expect({
        path,
        status: response.status,
        ...(response.ok ? {} : { body }),
      }).toEqual({ path, status: 200 });
    }
  });
});
