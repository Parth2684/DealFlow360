import { prisma } from "@repo/db";
import { hashToken, randomToken } from "../src/shared/security.js";
import "../src/config/env.js";

// Run against the seeded local application: bun run scripts/smoke-web.ts
if (process.env.NODE_ENV === "production")
  throw new Error("Local smoke check only");
const origin = process.argv[2] ?? "http://localhost:3001";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname))
  throw new Error("Use a local web server");
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const token = randomToken();
const session = await prisma.session.create({
  data: {
    organizationId: id(1),
    userId: id(10),
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 600_000),
  },
});
const paths = [
  "/workspace",
  "/quotations",
  "/quotations/new",
  `/quotations/${id(190)}`,
  `/quotations/${id(390)}`,
  "/approvals",
  "/customers",
  `/customers/${id(40)}`,
  "/orders",
  `/orders/${id(457)}`,
  `/orders/${id(457)}/fulfillment`,
  `/orders/${id(457)}/billing`,
  "/invoices",
  `/invoices/${id(220)}`,
  "/subscriptions",
  "/inventory",
  "/pipeline",
  "/deal-health",
  "/reports",
  ...[
    "products",
    "customers",
    "warehouses",
    "price-lists",
    "discount-policies",
    "promotions",
    "recommendations",
    "subscription-plans",
    "approval-chains",
    "team",
    "customer-requests",
  ].map((name) => `/settings/${name}`),
];
try {
  for (const path of paths) {
    const response = await fetch(`${origin}${path}`, {
      headers: { cookie: `session=${token}` },
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    });
    const body = await response.text();
    if (
      response.status !== 200 ||
      /"digest":"[^"\s]+"/.test(body) ||
      body.includes("data-next-error")
    )
      throw new Error(
        `${path}: status ${response.status}, server render failed`,
      );
    console.log(`PASS ${path}`);
  }
  console.log(`${paths.length} internal pages rendered successfully`);
} finally {
  await prisma.session.delete({ where: { id: session.id } });
  await prisma.$disconnect();
}
