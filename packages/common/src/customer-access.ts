import { z } from "zod";
import {
  EmailSchema,
  IdSchema,
  IsoDateTimeSchema,
  RevisionSchema,
} from "./primitives.js";
export const RegistrationContextSchema = z.object({
  name: z.string(),
  slug: z.string(),
});
export const CustomerAccessRequestSchema = z
  .object({
    organization: z.string().min(1).max(80),
    email: EmailSchema,
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    companyName: z.string().trim().min(1).max(180),
    message: z.string().trim().max(1000).default(""),
  })
  .strict();
export const CustomerAccessDtoSchema = z.object({
  id: IdSchema,
  revision: RevisionSchema,
  email: EmailSchema,
  firstName: z.string(),
  lastName: z.string(),
  companyName: z.string(),
  message: z.string(),
  status: z.enum(["PENDING", "APPROVED", "DECLINED"]),
  emailStatus: z.enum(["NONE", "PENDING", "SENT", "FAILED"]),
  reason: z.string(),
  createdAt: IsoDateTimeSchema,
});
export const CustomerAccessDecisionSchema = z
  .object({
    revision: RevisionSchema,
    decision: z.enum(["APPROVE", "DECLINE"]),
    customerAccountId: IdSchema.optional(),
    tierId: IdSchema.optional(),
    reason: z.string().trim().max(1000).default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.decision === "APPROVE" &&
      !value.customerAccountId &&
      !value.tierId
    )
      ctx.addIssue({
        code: "custom",
        path: ["tierId"],
        message: "Choose an existing customer or a tier for the new customer",
      });
    if (value.decision === "DECLINE" && !value.reason)
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Tell the customer why the request was declined",
      });
  });
export const CustomerAccessAcceptedSchema = z.object({
  accepted: z.literal(true),
});
