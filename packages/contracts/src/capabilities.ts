import type { Role } from "./enums.js";

export const Capabilities = {
  QUOTATION_CREATE: "quotation.create",
  QUOTATION_EDIT_OWN: "quotation.editOwn",
  QUOTATION_EDIT_ANY: "quotation.editAny",
  QUOTATION_VIEW: "quotation.view",
  QUOTATION_SUBMIT: "quotation.submit",
  QUOTATION_SEND: "quotation.send",
  APPROVAL_MANAGER_ACT: "approval.managerAct",
  APPROVAL_FINANCE_ACT: "approval.financeAct",
  FULFILLMENT_VIEW: "fulfillment.view",
  FULFILLMENT_OVERRIDE: "fulfillment.override",
  BILLING_VIEW: "billing.view",
  BILLING_RECORD_PAYMENT: "billing.recordPayment",
  CONFIGURATION_MANAGE: "configuration.manage",
  REPORTS_VIEW: "reports.view",
  REPORTS_EXPORT: "reports.export",
  CUSTOMER_PORTAL: "customer.portal",
} as const;

export type Capability = (typeof Capabilities)[keyof typeof Capabilities];

const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  ADMIN: Object.values(Capabilities),
  SALES_REP: [
    Capabilities.QUOTATION_CREATE,
    Capabilities.QUOTATION_EDIT_OWN,
    Capabilities.QUOTATION_VIEW,
    Capabilities.QUOTATION_SUBMIT,
    Capabilities.QUOTATION_SEND,
    Capabilities.FULFILLMENT_VIEW,
    Capabilities.BILLING_VIEW,
    Capabilities.REPORTS_VIEW,
  ],
  SALES_MANAGER: [
    Capabilities.QUOTATION_CREATE,
    Capabilities.QUOTATION_EDIT_ANY,
    Capabilities.QUOTATION_VIEW,
    Capabilities.QUOTATION_SUBMIT,
    Capabilities.QUOTATION_SEND,
    Capabilities.APPROVAL_MANAGER_ACT,
    Capabilities.FULFILLMENT_VIEW,
    Capabilities.BILLING_VIEW,
    Capabilities.REPORTS_VIEW,
    Capabilities.CONFIGURATION_MANAGE,
  ],
  FINANCE: [
    Capabilities.QUOTATION_VIEW,
    Capabilities.APPROVAL_FINANCE_ACT,
    Capabilities.BILLING_VIEW,
    Capabilities.BILLING_RECORD_PAYMENT,
    Capabilities.REPORTS_VIEW,
    Capabilities.REPORTS_EXPORT,
  ],
  OPERATIONS: [
    Capabilities.QUOTATION_VIEW,
    Capabilities.FULFILLMENT_VIEW,
    Capabilities.FULFILLMENT_OVERRIDE,
    Capabilities.REPORTS_VIEW,
  ],
  CUSTOMER: [Capabilities.CUSTOMER_PORTAL],
};

export function getCapabilitiesForRoles(roles: Role[]): Capability[] {
  const set = new Set<Capability>();
  for (const role of roles) {
    for (const cap of ROLE_CAPABILITIES[role] ?? []) {
      set.add(cap);
    }
  }
  return [...set];
}

export function hasCapability(
  roles: Role[],
  capability: Capability,
): boolean {
  return getCapabilitiesForRoles(roles).includes(capability);
}
