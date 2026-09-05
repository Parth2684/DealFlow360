import { z } from "zod";
import { ApprovalDecisionActions } from "../enums.js";

export const approvalDecisionSchema = z.object({
  action: z.enum([
    ApprovalDecisionActions.APPROVE,
    ApprovalDecisionActions.REJECT,
    ApprovalDecisionActions.REQUEST_REVISION,
  ]),
  reason: z.string().optional(),
});

export const approvalInboxItemSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  quoteNumber: z.string(),
  customerName: z.string(),
  total: z.string(),
  status: z.string(),
  routeReason: z.string().nullable(),
  termsFingerprint: z.string(),
  currentStep: z
    .object({
      id: z.string(),
      sequence: z.number(),
      requiredCapability: z.string(),
      status: z.string(),
      dueAt: z.string().nullable(),
    })
    .nullable(),
  riskSummary: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
});

export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
