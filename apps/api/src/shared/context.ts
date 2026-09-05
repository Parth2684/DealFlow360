import type { Role } from "@repo/contracts";
import type { Capability } from "@repo/contracts";

export interface AuthContext {
  userId: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  capabilities: Capability[];
  sessionId?: string;
  isPortal?: boolean;
  portalContactId?: string;
}

declare module "Express" {
  interface Request {
    auth?: AuthContext;
    requestId?: string;
  }
}

export {};
