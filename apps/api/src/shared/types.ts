import type { Capability, Role } from "@repo/common";

export interface InternalPrincipal {
  kind: "internal";
  sessionId: string;
  sessionExpiresAt: Date;
  organizationId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  capabilities: Capability[];
  salesTeamIds: string[];
  csrfHash: string;
}

export interface PortalPrincipal {
  kind: "portal";
  sessionId: string;
  organizationId: string;
  portalIdentityId: string;
  customerAccountId: string;
  quoteId: string | null;
  email: string;
}

declare global {
  // Express exposes request-scoped locals through this ambient namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      internalPrincipal?: InternalPrincipal;
      portalPrincipal?: PortalPrincipal;
      traceId: string;
    }
  }
}
