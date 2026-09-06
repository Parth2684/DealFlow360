import { IsoDateSchema, TimeZoneSchema } from "@repo/common";
import { prisma, Prisma } from "@repo/db";

import type { TransactionClient } from "../../shared/activity.js";
import { HttpError } from "../../shared/errors.js";
import {
  addBillingDays,
  startOfBillingDateInstant,
} from "../billing/periods.js";

const CSV_EXPORT_ROW_LIMIT = 10_000;
const DATABASE_EXPORT_VERSION = "v1";
export const EXPORT_FAILURE_MESSAGE =
  "The export could not be generated after repeated attempts. Review the filters and retry.";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const QUOTE_STAGES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "REVISION_REQUIRED",
  "READY_TO_SEND",
  "SENT",
  "UNDER_NEGOTIATION",
  "CUSTOMER_ACCEPTED",
  "CONFIRMED",
  "EXPIRED",
  "CANCELLED",
] as const;
const ORDER_STATUSES = [
  "CONFIRMED",
  "ALLOCATION_PENDING",
  "RESERVED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "CANCELLED",
] as const;
const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
] as const;
const CONFIGURATION_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

type ReportType = "QUOTES" | "ORDERS" | "INVOICES" | "CUSTOMERS" | "INVENTORY";
type ExportFormat = "CSV" | "XLSX" | "PDF";
type CsvCell = boolean | Date | number | Prisma.Decimal | string | null;

type SalesScope = {
  ownerId: string;
  salesTeamIds: string[];
};

type CsvExport = {
  body: string;
  filename: string;
  rowCount: number;
};

const FILTER_KEYS: Readonly<Record<ReportType, ReadonlySet<string>>> = {
  QUOTES: new Set([
    "from",
    "to",
    "customerAccountId",
    "ownerId",
    "salesTeamId",
    "stage",
  ]),
  ORDERS: new Set([
    "from",
    "to",
    "customerAccountId",
    "ownerId",
    "salesTeamId",
    "status",
  ]),
  INVOICES: new Set([
    "from",
    "to",
    "customerAccountId",
    "ownerId",
    "salesTeamId",
    "status",
  ]),
  CUSTOMERS: new Set([
    "from",
    "to",
    "customerAccountId",
    "ownerId",
    "salesTeamId",
    "status",
  ]),
  INVENTORY: new Set(["from", "to", "warehouseId", "productId", "variantId"]),
};

export type ExportArtifact = {
  body: Buffer | string;
  contentType: string;
  filename: string;
  rowCount: number;
};

function jsonObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalString(
  object: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = object[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new HttpError(
      422,
      "Invalid export filter",
      `${key} must be a string`,
      {
        code: "INVALID_EXPORT_FILTER",
      },
    );
  }
  return value.trim().length > 0 ? value.trim() : undefined;
}

function optionalUuid(
  object: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = optionalString(object, key);
  if (value === undefined) return undefined;
  if (!UUID_PATTERN.test(value)) {
    throw new HttpError(422, "Invalid export filter", `${key} must be a UUID`, {
      code: "INVALID_EXPORT_FILTER",
    });
  }
  return value;
}

function optionalEnum<const Values extends readonly string[]>(
  object: Record<string, unknown>,
  key: string,
  allowed: Values,
): Values[number] | undefined {
  const value = optionalString(object, key);
  if (value === undefined) return undefined;
  if (!allowed.includes(value)) {
    throw new HttpError(
      422,
      "Invalid export filter",
      `${key} must be one of ${allowed.join(", ")}`,
      { code: "INVALID_EXPORT_FILTER" },
    );
  }
  return value as Values[number];
}

function optionalCalendarDate(
  object: Record<string, unknown>,
  key: "from" | "to",
): Date | undefined {
  const value = optionalString(object, key);
  if (value === undefined) return undefined;
  const parsed = IsoDateSchema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(
      422,
      "Invalid export filter",
      `${key} must be an ISO date`,
      {
        code: "INVALID_EXPORT_FILTER",
      },
    );
  }
  return new Date(`${parsed.data}T00:00:00.000Z`);
}

function dateRange(
  filters: Record<string, unknown>,
  timeZone: string,
): Prisma.DateTimeFilter | undefined {
  const from = optionalCalendarDate(filters, "from");
  const to = optionalCalendarDate(filters, "to");
  if (from !== undefined && to !== undefined && from > to) {
    throw new HttpError(
      422,
      "Invalid export filter",
      "The export from date must not be after the to date",
      { code: "INVALID_EXPORT_FILTER" },
    );
  }
  if (from === undefined && to === undefined) return undefined;

  const parsedTimeZone = TimeZoneSchema.safeParse(timeZone);
  if (!parsedTimeZone.success) {
    throw new HttpError(
      409,
      "Export unavailable",
      "The organization timezone is invalid",
      { code: "INVALID_ORGANIZATION_TIMEZONE" },
    );
  }
  try {
    return {
      ...(from === undefined
        ? {}
        : { gte: startOfBillingDateInstant(from, parsedTimeZone.data) }),
      ...(to === undefined
        ? {}
        : {
            lt: startOfBillingDateInstant(
              addBillingDays(to, 1),
              parsedTimeZone.data,
            ),
          }),
    };
  } catch (error) {
    if (error instanceof RangeError) {
      throw new HttpError(
        422,
        "Invalid export filter",
        "The export date range is not valid in the organization timezone",
        { code: "INVALID_EXPORT_DATE_RANGE" },
      );
    }
    throw error;
  }
}

function accessScope(filters: Record<string, unknown>): SalesScope | null {
  if (!("accessScope" in filters)) return null;
  const raw = filters["accessScope"];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpError(
      409,
      "Export unavailable",
      "The stored export access scope is invalid",
      {
        code: "INVALID_EXPORT_SCOPE",
      },
    );
  }
  const scopeObject = jsonObject(raw);
  if (
    Object.keys(scopeObject).some(
      (key) => key !== "ownerId" && key !== "salesTeamIds",
    )
  ) {
    throw new HttpError(
      409,
      "Export unavailable",
      "The stored export access scope is invalid",
      {
        code: "INVALID_EXPORT_SCOPE",
      },
    );
  }
  const ownerIdValue = scopeObject["ownerId"];
  const ownerId =
    typeof ownerIdValue === "string" && UUID_PATTERN.test(ownerIdValue)
      ? ownerIdValue
      : undefined;
  const rawTeamIds = scopeObject["salesTeamIds"];
  if (
    ownerId === undefined ||
    !Array.isArray(rawTeamIds) ||
    rawTeamIds.some(
      (value) => typeof value !== "string" || !UUID_PATTERN.test(value),
    )
  ) {
    throw new HttpError(
      409,
      "Export unavailable",
      "The stored export owner scope is missing",
      {
        code: "INVALID_EXPORT_SCOPE",
      },
    );
  }
  return { ownerId, salesTeamIds: rawTeamIds as string[] };
}

function quoteScope(scope: SalesScope | null): Prisma.QuoteWhereInput {
  if (scope === null) return {};
  return {
    OR: [
      { ownerId: scope.ownerId },
      ...(scope.salesTeamIds.length === 0
        ? []
        : [{ salesTeamId: { in: scope.salesTeamIds } }]),
    ],
  };
}

function orderScope(scope: SalesScope | null): Prisma.OrderWhereInput {
  if (scope === null) return {};
  return {
    OR: [
      { ownerId: scope.ownerId },
      ...(scope.salesTeamIds.length === 0
        ? []
        : [{ quote: { salesTeamId: { in: scope.salesTeamIds } } }]),
    ],
  };
}

function customerScope(
  scope: SalesScope | null,
): Prisma.CustomerAccountWhereInput {
  if (scope === null) return {};
  return {
    OR: [
      { assignedRepId: scope.ownerId },
      ...(scope.salesTeamIds.length === 0
        ? []
        : [{ salesTeamId: { in: scope.salesTeamIds } }]),
    ],
  };
}

function invoiceScope(scope: SalesScope | null): Prisma.InvoiceWhereInput {
  if (scope === null) return {};
  return {
    order: {
      is: {
        OR: [
          { ownerId: scope.ownerId },
          ...(scope.salesTeamIds.length === 0
            ? []
            : [{ quote: { is: { salesTeamId: { in: scope.salesTeamIds } } } }]),
        ],
      },
    },
  };
}

function assertWithinLimit(rowCount: number): void {
  if (rowCount > CSV_EXPORT_ROW_LIMIT) {
    throw new HttpError(
      409,
      "Export too large",
      `The export exceeds ${CSV_EXPORT_ROW_LIMIT.toLocaleString("en-US")} rows; narrow the filters and retry`,
      { code: "EXPORT_ROW_LIMIT" },
    );
  }
}

function spreadsheetFormulaRisk(value: string): boolean {
  let index = 0;
  while (index < value.length) {
    const character = value[index] ?? "";
    const code = character.charCodeAt(0);
    if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
    if (code > 0x1f && !/\s/u.test(character)) break;
    index += 1;
  }
  const firstSignificant = value[index];
  return firstSignificant !== undefined && "=+-@".includes(firstSignificant);
}

function encodeString(value: string): string {
  const formulaSafe = spreadsheetFormulaRisk(value) ? `'${value}` : value;
  return `"${formulaSafe.replaceAll('"', '""')}"`;
}

function encodeCell(value: CsvCell): string {
  if (value === null) return "";
  if (value instanceof Date) return encodeString(value.toISOString());
  if (value instanceof Prisma.Decimal) return value.toString();
  if (typeof value === "string") return encodeString(value);
  return String(value);
}

function csv(headers: readonly string[], rows: readonly CsvCell[][]): string {
  const lines = [headers.map(encodeString).join(",")];
  for (const row of rows) lines.push(row.map(encodeCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function filename(reportType: ReportType): string {
  return `dealflow360-${reportType.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export function validateExportFilters(
  reportType: ReportType,
  value: unknown,
  options: { allowStoredAccessScope?: boolean; timeZone?: string } = {},
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(
      422,
      "Invalid export filter",
      "filters must be an object",
      {
        code: "INVALID_EXPORT_FILTER",
      },
    );
  }
  const filters = jsonObject(value);
  const allowedKeys = FILTER_KEYS[reportType];
  for (const key of Object.keys(filters)) {
    if (
      !allowedKeys.has(key) &&
      !(options.allowStoredAccessScope === true && key === "accessScope")
    ) {
      throw new HttpError(
        422,
        "Invalid export filter",
        `${key} is not supported for ${reportType.toLowerCase()} exports`,
        { code: "INVALID_EXPORT_FILTER" },
      );
    }
  }
  dateRange(filters, options.timeZone ?? "UTC");
  switch (reportType) {
    case "QUOTES":
      optionalUuid(filters, "customerAccountId");
      optionalUuid(filters, "ownerId");
      optionalUuid(filters, "salesTeamId");
      optionalEnum(filters, "stage", QUOTE_STAGES);
      break;
    case "ORDERS":
      optionalUuid(filters, "customerAccountId");
      optionalUuid(filters, "ownerId");
      optionalUuid(filters, "salesTeamId");
      optionalEnum(filters, "status", ORDER_STATUSES);
      break;
    case "INVOICES":
      optionalUuid(filters, "customerAccountId");
      optionalUuid(filters, "ownerId");
      optionalUuid(filters, "salesTeamId");
      optionalEnum(filters, "status", INVOICE_STATUSES);
      break;
    case "CUSTOMERS":
      optionalUuid(filters, "customerAccountId");
      optionalUuid(filters, "ownerId");
      optionalUuid(filters, "salesTeamId");
      optionalEnum(filters, "status", CONFIGURATION_STATUSES);
      break;
    case "INVENTORY":
      optionalUuid(filters, "warehouseId");
      optionalUuid(filters, "productId");
      optionalUuid(filters, "variantId");
      break;
  }
}

export async function buildCsvExport(input: {
  database?: TransactionClient;
  filters: Prisma.JsonValue;
  organizationId: string;
  reportType: ReportType;
}): Promise<CsvExport> {
  const database: TransactionClient = input.database ?? prisma;
  const organization = await database.organization.findUnique({
    where: { id: input.organizationId },
    select: { timezone: true },
  });
  if (organization === null) {
    throw new HttpError(
      404,
      "Organization not found",
      "The export organization no longer exists",
      {
        code: "ORGANIZATION_NOT_FOUND",
      },
    );
  }
  validateExportFilters(input.reportType, input.filters, {
    allowStoredAccessScope: true,
    timeZone: organization.timezone,
  });
  const filters = jsonObject(input.filters);
  const scope = accessScope(filters);
  const range = dateRange(filters, organization.timezone);

  switch (input.reportType) {
    case "QUOTES": {
      const rows = await database.quote.findMany({
        where: {
          organizationId: input.organizationId,
          AND: [
            quoteScope(scope),
            {
              ...(optionalUuid(filters, "customerAccountId") === undefined
                ? {}
                : {
                    customerAccountId: optionalUuid(
                      filters,
                      "customerAccountId",
                    ),
                  }),
              ...(optionalUuid(filters, "ownerId") === undefined
                ? {}
                : { ownerId: optionalUuid(filters, "ownerId") }),
              ...(optionalUuid(filters, "salesTeamId") === undefined
                ? {}
                : { salesTeamId: optionalUuid(filters, "salesTeamId") }),
              ...(optionalEnum(filters, "stage", QUOTE_STAGES) === undefined
                ? {}
                : { stage: optionalEnum(filters, "stage", QUOTE_STAGES) }),
              ...(range === undefined ? {} : { updatedAt: range }),
            },
          ],
        },
        select: {
          id: true,
          quoteNumber: true,
          stage: true,
          expiresAt: true,
          updatedAt: true,
          customerAccount: { select: { accountCode: true, name: true } },
          owner: { select: { firstName: true, lastName: true } },
          currentVersion: {
            select: { currency: true, total: true, marginPercent: true },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: CSV_EXPORT_ROW_LIMIT + 1,
      });
      assertWithinLimit(rows.length);
      const data = rows.map((row): CsvCell[] => [
        row.quoteNumber,
        row.customerAccount.accountCode,
        row.customerAccount.name,
        `${row.owner.firstName} ${row.owner.lastName}`,
        row.stage,
        row.currentVersion?.currency ?? null,
        row.currentVersion?.total ?? null,
        row.currentVersion?.marginPercent ?? null,
        row.expiresAt,
        row.updatedAt,
      ]);
      return {
        body: csv(
          [
            "Quote number",
            "Customer code",
            "Customer",
            "Owner",
            "Stage",
            "Currency",
            "Total",
            "Margin percent",
            "Expires at",
            "Updated at",
          ],
          data,
        ),
        filename: filename(input.reportType),
        rowCount: rows.length,
      };
    }
    case "ORDERS": {
      const rows = await database.order.findMany({
        where: {
          organizationId: input.organizationId,
          AND: [
            orderScope(scope),
            {
              ...(optionalUuid(filters, "customerAccountId") === undefined
                ? {}
                : {
                    customerAccountId: optionalUuid(
                      filters,
                      "customerAccountId",
                    ),
                  }),
              ...(optionalUuid(filters, "ownerId") === undefined
                ? {}
                : { ownerId: optionalUuid(filters, "ownerId") }),
              ...(optionalUuid(filters, "salesTeamId") === undefined
                ? {}
                : {
                    quote: {
                      is: {
                        salesTeamId: optionalUuid(filters, "salesTeamId"),
                      },
                    },
                  }),
              ...(optionalEnum(filters, "status", ORDER_STATUSES) === undefined
                ? {}
                : { status: optionalEnum(filters, "status", ORDER_STATUSES) }),
              ...(range === undefined ? {} : { updatedAt: range }),
            },
          ],
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          currency: true,
          total: true,
          confirmedAt: true,
          updatedAt: true,
          customerName: true,
          customerAccount: { select: { accountCode: true } },
          owner: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: CSV_EXPORT_ROW_LIMIT + 1,
      });
      assertWithinLimit(rows.length);
      const data = rows.map((row): CsvCell[] => [
        row.orderNumber,
        row.customerAccount.accountCode,
        row.customerName,
        `${row.owner.firstName} ${row.owner.lastName}`,
        row.status,
        row.currency,
        row.total,
        row.confirmedAt,
        row.updatedAt,
      ]);
      return {
        body: csv(
          [
            "Order number",
            "Customer code",
            "Customer",
            "Owner",
            "Status",
            "Currency",
            "Total",
            "Confirmed at",
            "Updated at",
          ],
          data,
        ),
        filename: filename(input.reportType),
        rowCount: rows.length,
      };
    }
    case "INVOICES": {
      const ownerId = optionalUuid(filters, "ownerId");
      const salesTeamId = optionalUuid(filters, "salesTeamId");
      const rows = await database.invoice.findMany({
        where: {
          organizationId: input.organizationId,
          AND: [
            invoiceScope(scope),
            {
              ...(optionalUuid(filters, "customerAccountId") === undefined
                ? {}
                : {
                    customerAccountId: optionalUuid(
                      filters,
                      "customerAccountId",
                    ),
                  }),
              ...(ownerId === undefined && salesTeamId === undefined
                ? {}
                : {
                    order: {
                      is: {
                        ...(ownerId === undefined ? {} : { ownerId }),
                        ...(salesTeamId === undefined
                          ? {}
                          : { quote: { is: { salesTeamId } } }),
                      },
                    },
                  }),
              ...(optionalEnum(filters, "status", INVOICE_STATUSES) ===
              undefined
                ? {}
                : {
                    status: optionalEnum(filters, "status", INVOICE_STATUSES),
                  }),
              ...(range === undefined ? {} : { updatedAt: range }),
            },
          ],
        },
        select: {
          id: true,
          invoiceNumber: true,
          type: true,
          status: true,
          currency: true,
          total: true,
          amountPaid: true,
          balanceDue: true,
          dueDate: true,
          issuedAt: true,
          updatedAt: true,
          customerAccount: { select: { accountCode: true, name: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: CSV_EXPORT_ROW_LIMIT + 1,
      });
      assertWithinLimit(rows.length);
      const data = rows.map((row): CsvCell[] => [
        row.invoiceNumber,
        row.customerAccount.accountCode,
        row.customerAccount.name,
        row.type,
        row.status,
        row.currency,
        row.total,
        row.amountPaid,
        row.balanceDue,
        row.dueDate,
        row.issuedAt,
        row.updatedAt,
      ]);
      return {
        body: csv(
          [
            "Invoice number",
            "Customer code",
            "Customer",
            "Type",
            "Status",
            "Currency",
            "Total",
            "Amount paid",
            "Balance due",
            "Due date",
            "Issued at",
            "Updated at",
          ],
          data,
        ),
        filename: filename(input.reportType),
        rowCount: rows.length,
      };
    }
    case "CUSTOMERS": {
      const rows = await database.customerAccount.findMany({
        where: {
          organizationId: input.organizationId,
          AND: [
            customerScope(scope),
            {
              ...(optionalUuid(filters, "customerAccountId") === undefined
                ? {}
                : { id: optionalUuid(filters, "customerAccountId") }),
              ...(optionalUuid(filters, "ownerId") === undefined
                ? {}
                : { assignedRepId: optionalUuid(filters, "ownerId") }),
              ...(optionalUuid(filters, "salesTeamId") === undefined
                ? {}
                : { salesTeamId: optionalUuid(filters, "salesTeamId") }),
              ...(optionalEnum(filters, "status", CONFIGURATION_STATUSES) ===
              undefined
                ? {}
                : {
                    status: optionalEnum(
                      filters,
                      "status",
                      CONFIGURATION_STATUSES,
                    ),
                  }),
              ...(range === undefined ? {} : { updatedAt: range }),
            },
          ],
        },
        select: {
          id: true,
          accountCode: true,
          name: true,
          preferredCurrency: true,
          paymentTermsDays: true,
          creditLimit: true,
          currentExposure: true,
          overdueBalance: true,
          status: true,
          updatedAt: true,
          tier: { select: { name: true } },
          assignedRep: { select: { firstName: true, lastName: true } },
          salesTeam: { select: { name: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: CSV_EXPORT_ROW_LIMIT + 1,
      });
      assertWithinLimit(rows.length);
      const data = rows.map((row): CsvCell[] => [
        row.accountCode,
        row.name,
        row.tier.name,
        row.assignedRep === null
          ? null
          : `${row.assignedRep.firstName} ${row.assignedRep.lastName}`,
        row.salesTeam?.name ?? null,
        row.preferredCurrency,
        row.paymentTermsDays,
        row.creditLimit,
        row.currentExposure,
        row.overdueBalance,
        row.status,
        row.updatedAt,
      ]);
      return {
        body: csv(
          [
            "Customer code",
            "Customer",
            "Tier",
            "Assigned rep",
            "Sales team",
            "Currency",
            "Payment terms days",
            "Credit limit",
            "Current exposure",
            "Overdue balance",
            "Status",
            "Updated at",
          ],
          data,
        ),
        filename: filename(input.reportType),
        rowCount: rows.length,
      };
    }
    case "INVENTORY": {
      const rows = await database.inventoryBalance.findMany({
        where: {
          organizationId: input.organizationId,
          ...(optionalUuid(filters, "warehouseId") === undefined
            ? {}
            : { warehouseId: optionalUuid(filters, "warehouseId") }),
          ...(optionalUuid(filters, "productId") === undefined
            ? {}
            : { productId: optionalUuid(filters, "productId") }),
          ...(optionalUuid(filters, "variantId") === undefined
            ? {}
            : { variantId: optionalUuid(filters, "variantId") }),
          ...(range === undefined ? {} : { updatedAt: range }),
        },
        select: {
          id: true,
          onHand: true,
          reserved: true,
          available: true,
          incoming: true,
          revision: true,
          updatedAt: true,
          warehouse: { select: { code: true, name: true } },
          product: { select: { code: true, name: true } },
          variant: { select: { sku: true, name: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: CSV_EXPORT_ROW_LIMIT + 1,
      });
      assertWithinLimit(rows.length);
      const data = rows.map((row): CsvCell[] => [
        row.warehouse.code,
        row.warehouse.name,
        row.product.code,
        row.product.name,
        row.variant?.sku ?? null,
        row.variant?.name ?? null,
        row.onHand,
        row.reserved,
        row.available,
        row.incoming,
        row.revision,
        row.updatedAt,
      ]);
      return {
        body: csv(
          [
            "Warehouse code",
            "Warehouse",
            "Product code",
            "Product",
            "SKU",
            "Variant",
            "On hand",
            "Reserved",
            "Available",
            "Incoming",
            "Revision",
            "Updated at",
          ],
          data,
        ),
        filename: filename(input.reportType),
        rowCount: rows.length,
      };
    }
  }
}

function parseCsv(body: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const start = body.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (let index = start; index < body.length; index += 1) {
    const character = body[index] ?? "";
    if (quoted) {
      if (character === '"') {
        if (body[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && body[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (row.length > 0 || cell.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function displayCell(value: string): string {
  return value.startsWith("'") && spreadsheetFormulaRisk(value.slice(1))
    ? value.slice(1)
    : value;
}

function xml(value: string): string {
  return [...displayCell(value)]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
    })
    .join("")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

const CRC32_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries: readonly { name: string; data: Buffer }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const checksum = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + entry.data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function buildXlsx(rows: readonly string[][]): Buffer {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => {
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
          return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xml(cell)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const lastColumn = columnName(columnCount - 1);
  const lastRow = Math.max(rows.length, 1);
  const columns = Array.from(
    { length: columnCount },
    (_unused, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="20" customWidth="1"/>`,
  ).join("");
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${rowXml}</sheetData><autoFilter ref="A1:${lastColumn}${lastRow}"/></worksheet>`;
  const entries = [
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
        "utf8",
      ),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
        "utf8",
      ),
    },
    {
      name: "xl/workbook.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>`,
        "utf8",
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
        "utf8",
      ),
    },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(worksheet, "utf8") },
  ];
  return zip(entries);
}

function pdfText(value: string): string {
  return displayCell(value)
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/gu, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function truncate(value: string, maximum: number): string {
  const display = displayCell(value).replace(/\s+/gu, " ").trim();
  return display.length <= maximum
    ? display
    : `${display.slice(0, Math.max(1, maximum - 3))}...`;
}

function buildPdf(rows: readonly string[][], title: string): Buffer {
  const header = rows[0] ?? ["No data"];
  const dataRows = rows.slice(1);
  const columnWidth = Math.max(
    4,
    Math.floor(
      (106 - Math.max(0, header.length - 1) * 3) / Math.max(1, header.length),
    ),
  );
  const renderRow = (row: readonly string[]) =>
    row.map((cell) => truncate(cell, columnWidth)).join(" | ");
  const pages: string[][] = [];
  const pageCapacity = 50;
  if (dataRows.length === 0) pages.push([]);
  for (let index = 0; index < dataRows.length; index += pageCapacity) {
    pages.push(dataRows.slice(index, index + pageCapacity).map(renderRow));
  }

  const objects: string[] = [];
  const pageReferences = pages
    .map((_page, index) => `${4 + index * 2} 0 R`)
    .join(" ");
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pageReferences}] /Count ${pages.length} >>`,
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  for (const [pageIndex, lines] of pages.entries()) {
    const pageObject = 4 + pageIndex * 2;
    const contentObject = pageObject + 1;
    const displayed = [
      `${title} - page ${pageIndex + 1} of ${pages.length}`,
      renderRow(header),
      "-".repeat(106),
      ...lines,
    ];
    const content = `BT\n/F1 7 Tf\n24 588 Td\n10 TL\n${displayed
      .map((line) => `(${pdfText(line)}) Tj\nT*`)
      .join("\n")}\nET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
    );
  }

  let document = "%PDF-1.4\n%DealFlow360\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document, "ascii"));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, "ascii");
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document, "ascii");
}

export async function buildExportArtifact(input: {
  database?: TransactionClient;
  filters: Prisma.JsonValue;
  format: ExportFormat;
  organizationId: string;
  reportType: ReportType;
}): Promise<ExportArtifact> {
  const source = await buildCsvExport(input);
  if (input.format === "CSV") {
    return {
      ...source,
      contentType: "text/csv; charset=utf-8",
    };
  }
  const rows = parseCsv(source.body);
  const baseName = source.filename.replace(/\.csv$/u, "");
  if (input.format === "XLSX") {
    return {
      body: buildXlsx(rows),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `${baseName}.xlsx`,
      rowCount: source.rowCount,
    };
  }
  return {
    body: buildPdf(rows, baseName),
    contentType: "application/pdf",
    filename: `${baseName}.pdf`,
    rowCount: source.rowCount,
  };
}

export const persistedExportStorage = {
  resultLocation(format: ExportFormat): string {
    return `database:${format.toLowerCase()}:${DATABASE_EXPORT_VERSION}`;
  },
  isPersistedLocation(value: string | null, format: ExportFormat): boolean {
    return value === this.resultLocation(format);
  },
} as const;
