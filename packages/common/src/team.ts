import { z } from "zod";
import { EmailSchema, IdSchema, RevisionSchema } from "./primitives.js";
import { RoleSchema, UserStatusSchema } from "./enums.js";

const InternalRoleSchema = RoleSchema.exclude(["CUSTOMER"]);
export const TeamMemberDtoSchema = z.object({
  id: IdSchema,
  email: EmailSchema,
  firstName: z.string(),
  lastName: z.string(),
  status: UserStatusSchema,
  revision: RevisionSchema,
  roles: z.array(InternalRoleSchema),
});
export const TeamMemberCreateSchema = z
  .object({
    email: EmailSchema,
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    password: z.string().min(12).max(128),
    roles: z.array(InternalRoleSchema).min(1),
  })
  .strict();
export const TeamMemberUpdateSchema = TeamMemberCreateSchema.partial()
  .omit({ email: true })
  .extend({
    revision: RevisionSchema,
    status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
  })
  .strict();
