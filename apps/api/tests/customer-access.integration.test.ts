import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { once } from "node:events";
import type { Server } from "node:http";
import { SMTPServer } from "smtp-server";
import { prisma } from "@repo/db";
import { apiRoutes, CustomerAccessDtoSchema } from "@repo/common";
import { createApp } from "../src/app.js";
import { createEmailSender } from "../src/shared/email.js";
import { hashToken, randomToken } from "../src/shared/security.js";
let smtp: SMTPServer;
let server: Server;
let origin: string;
let organizationId: string;
let slug: string;
let tierId: string;
let headers: Record<string, string>;
const messages: string[] = [];
let rejectMail = false;
beforeAll(async () => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development database required");
  smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["AUTH", "STARTTLS"],
    onData(stream, _session, callback) {
      let body = "";
      stream.on("data", (chunk) => {
        body += chunk.toString();
      });
      stream.on("end", () => {
        if (rejectMail) callback(new Error("Test SMTP rejection"));
        else {
          messages.push(body);
          callback();
        }
      });
    },
  });
  await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve));
  const address = smtp.server.address();
  if (!address || typeof address === "string")
    throw new Error("SMTP unavailable");
  server = createApp({
    sendEmail: createEmailSender({
      host: "127.0.0.1",
      port: address.port,
      from: "test@example.test",
      requireTLS: false,
    }),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const http = server.address();
  if (!http || typeof http === "string") throw new Error("HTTP unavailable");
  origin = "http://127.0.0.1:" + http.port;
  slug = "access-test-" + randomToken(8).toLowerCase();
  organizationId = (
    await prisma.organization.create({
      data: { name: "Access Test Organization", slug },
    })
  ).id;
  tierId = (
    await prisma.customerTier.create({
      data: { organizationId, name: "Standard", code: "STANDARD" },
    })
  ).id;
  const admin = await prisma.user.create({
    data: {
      organizationId,
      email: slug + "-admin@example.test",
      firstName: "Test",
      lastName: "Admin",
      status: "ACTIVE",
      roleAssignments: { create: { organizationId, role: "ADMIN" } },
    },
  });
  const raw = randomToken();
  await prisma.session.create({
    data: {
      organizationId,
      userId: admin.id,
      tokenHash: hashToken(raw),
      metadata: { csrfHash: hashToken(raw) },
      expiresAt: new Date(Date.now() + 600_000),
    },
  });
  headers = {
    cookie: "session=" + raw + "; csrf_token=" + raw,
    "x-csrf-token": raw,
    "content-type": "application/json",
  };
});
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  if (smtp) await new Promise<void>((resolve) => smtp.close(() => resolve()));
  if (organizationId)
    await prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { organizationId } });
      await tx.auditEvent.deleteMany({ where: { organizationId } });
      await tx.magicLinkToken.deleteMany({ where: { organizationId } });
      await tx.portalSession.deleteMany({ where: { organizationId } });
      await tx.portalIdentity.deleteMany({ where: { organizationId } });
      await tx.customerContact.deleteMany({ where: { organizationId } });
      await tx.customerAccount.deleteMany({ where: { organizationId } });
      await tx.customerTier.deleteMany({ where: { organizationId } });
      await tx.refreshToken.deleteMany({ where: { organizationId } });
      await tx.session.deleteMany({ where: { organizationId } });
      await tx.roleAssignment.deleteMany({ where: { organizationId } });
      await tx.user.deleteMany({ where: { organizationId } });
      await tx.organization.delete({ where: { id: organizationId } });
    });
});
async function post(path: string, body: unknown, authenticated = true) {
  return fetch(origin + path, {
    method: "POST",
    headers: authenticated ? headers : { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function requestAccount(label: string) {
  const email = slug + "-" + label + "@example.test";
  const body = {
    organization: slug,
    email,
    firstName: "Portal",
    lastName: "Customer",
    companyName: "Example Customer",
    message: "Please allow purchasing access.",
  };
  expect(
    (await post(apiRoutes.customerAccess.request, body, false)).status,
  ).toBe(202);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { user, body };
}
async function decide(
  user: { id: string; revision: number },
  decision: "APPROVE" | "DECLINE",
) {
  return post(apiRoutes.customerAccess.decision(user.id), {
    revision: user.revision,
    decision,
    ...(decision === "APPROVE"
      ? { tierId }
      : { reason: "We cannot service your region yet." }),
  });
}
function passwordFromEmail() {
  const match = messages.at(-1)?.match(/Password: ([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("Credential email is missing password");
  return match[1]!;
}
describe("customer requests with Nodemailer SMTP", () => {
  test("pending requests, duplicates, and admin notification", async () => {
    const { user, body } = await requestAccount("pending");
    expect(user.status).toBe("INVITED");
    expect(user.passwordHash).toBeNull();
    expect(
      (await post(apiRoutes.customerAccess.request, body, false)).status,
    ).toBe(202);
    expect(
      await prisma.auditEvent.count({
        where: {
          organizationId,
          entityId: user.id,
          eventType: "CUSTOMER_ACCESS_REQUESTED",
        },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: { organizationId, type: "CUSTOMER_ACCESS_REQUESTED" },
      }),
    ).toBe(1);
    expect((await fetch(origin + apiRoutes.customerAccess.list)).status).toBe(
      401,
    );
    expect(
      (await fetch(origin + apiRoutes.customerAccess.list, { headers })).status,
    ).toBe(200);
  });
  test("approval emails working credentials, stores only a hash, and supports password change", async () => {
    const { user } = await requestAccount("approve");
    const response = await decide(user, "APPROVE");
    expect(response.status).toBe(200);
    const result = CustomerAccessDtoSchema.parse(await response.json());
    expect(result.emailStatus).toBe("SENT");
    const password = passwordFromEmail();
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.status).toBe("ACTIVE");
    expect(stored.passwordHash).toStartWith("$argon2id$");
    expect(await Bun.password.verify(password, stored.passwordHash!)).toBe(
      true,
    );
    expect(
      JSON.stringify(
        await prisma.auditEvent.findMany({
          where: { organizationId, entityId: user.id },
        }),
      ),
    ).not.toContain(password);
    expect(JSON.stringify(result)).not.toContain(password);
    const login = await post(
      apiRoutes.customerAccess.login,
      { email: user.email, password },
      false,
    );
    expect(login.status).toBe(200);
    const setCookies = login.headers.getSetCookie();
    const cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
    const csrf = setCookies
      .find((value) => value.startsWith("portal_csrf_token="))!
      .split(";")[0]!
      .split("=")[1]!;
    expect(
      (await fetch(origin + "/api/v1/portal/session", { headers: { cookie } }))
        .status,
    ).toBe(200);
    expect(
      (await fetch(origin + apiRoutes.team.list, { headers: { cookie } }))
        .status,
    ).toBe(401);
    const newPassword = randomToken(24);
    expect(
      (
        await fetch(origin + apiRoutes.customerAccess.password, {
          method: "POST",
          headers: {
            cookie,
            "content-type": "application/json",
            "x-csrf-token": csrf,
          },
          body: JSON.stringify({
            currentPassword: password,
            password: newPassword,
          }),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post(
          apiRoutes.customerAccess.login,
          { email: user.email, password },
          false,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await post(
          apiRoutes.customerAccess.login,
          { email: user.email, password: newPassword },
          false,
        )
      ).status,
    ).toBe(200);
    expect((await decide(user, "APPROVE")).status).toBe(409);
  });
  test("decline emails a reason without enabling access", async () => {
    const { user } = await requestAccount("decline");
    const result = CustomerAccessDtoSchema.parse(
      await (await decide(user, "DECLINE")).json(),
    );
    expect(result.status).toBe("DECLINED");
    expect(result.emailStatus).toBe("SENT");
    expect(messages.at(-1)).toContain("cannot service your region");
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.status).toBe("DISABLED");
    expect(stored.passwordHash).toBeNull();
  });
  test("SMTP failure keeps login disabled and retry delivers a fresh password", async () => {
    const { user } = await requestAccount("retry");
    rejectMail = true;
    let result;
    try {
      result = CustomerAccessDtoSchema.parse(
        await (await decide(user, "APPROVE")).json(),
      );
    } finally {
      rejectMail = false;
    }
    expect(result.emailStatus).toBe("FAILED");
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(before.status).toBe("INVITED");
    const retry = await post(apiRoutes.customerAccess.retryEmail(user.id), {
      revision: result.revision,
    });
    expect(retry.status).toBe(200);
    expect(CustomerAccessDtoSchema.parse(await retry.json()).emailStatus).toBe(
      "SENT",
    );
    const password = passwordFromEmail();
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(await Bun.password.verify(password, after.passwordHash!)).toBe(true);
    expect(
      (
        await post(
          apiRoutes.customerAccess.login,
          { email: user.email, password },
          false,
        )
      ).status,
    ).toBe(200);
  });
  test("concurrent review sends one decision", async () => {
    const { user } = await requestAccount("concurrent");
    const count = messages.length;
    const results = await Promise.all([
      decide(user, "APPROVE"),
      decide(user, "DECLINE"),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(messages.length - count).toBe(1);
  });
});
