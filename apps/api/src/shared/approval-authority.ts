import {
  CapabilitySchema,
  ROLE_CAPABILITIES,
  RoleSchema,
  type Capability,
  type Role,
} from "@repo/common";

import type { InternalPrincipal } from "./types.js";

const ACTION_CAPABILITIES = [
  "approval.managerAct",
  "approval.financeAct",
] as const satisfies readonly Capability[];

export interface ApprovalAuthority {
  requiredRole: Role;
  requiredCapability: (typeof ACTION_CAPABILITIES)[number];
}

/**
 * Validate persisted approval authority as data, not as executable policy.
 * Only dedicated action capabilities are accepted, and the configured role
 * must actually own the selected capability in the central role contract.
 */
export function approvalAuthority(
  requiredRole: string,
  requiredCapability: string,
): ApprovalAuthority | null {
  const role = RoleSchema.safeParse(requiredRole);
  const capability = CapabilitySchema.safeParse(requiredCapability);
  if (
    !role.success ||
    !capability.success ||
    !ACTION_CAPABILITIES.some((candidate) => candidate === capability.data) ||
    !ROLE_CAPABILITIES[role.data].includes(capability.data)
  ) {
    return null;
  }
  return {
    requiredRole: role.data,
    requiredCapability:
      capability.data as ApprovalAuthority["requiredCapability"],
  };
}

export function principalCanActForApproval(
  principal: InternalPrincipal,
  authority: ApprovalAuthority,
): boolean {
  const hasRole =
    principal.roles.includes(authority.requiredRole) ||
    principal.roles.includes("ADMIN");
  return (
    hasRole && principal.capabilities.includes(authority.requiredCapability)
  );
}
