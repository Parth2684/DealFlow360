import { z } from "zod";

import {
  ApprovalDecisionActionSchema,
  ApprovalRequestStatusSchema,
  ApprovalStepStatusSchema,
  ConfigurationStatusSchema,
  RoleSchema,
} from "./enums.js";
import {
  EmailSchema,
  IdSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  RevisionSchema,
  TermsFingerprintSchema,
} from "./primitives.js";
import { ApprovalRouteStepDtoSchema, QuoteSummaryDtoSchema } from "./quotes.js";

export const ApprovalDecisionDtoSchema = z.object({
  id: IdSchema,
  approvalStepId: IdSchema,
  actorId: IdSchema,
  actorName: z.string().min(1),
  action: ApprovalDecisionActionSchema,
  reason: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type ApprovalDecisionDto = z.infer<typeof ApprovalDecisionDtoSchema>;

export const ApprovalDelegateDtoSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  email: EmailSchema,
  assignedAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
  assignedBy: z.object({ id: IdSchema, name: z.string().min(1) }),
  reason: z.string().min(1),
});
export type ApprovalDelegateDto = z.infer<typeof ApprovalDelegateDtoSchema>;

export const ApprovalStepDtoSchema = z.object({
  id: IdSchema,
  sequence: z.number().int().positive(),
  requiredCapability: z.string().min(1),
  requiredRole: RoleSchema,
  assignee: z.object({ id: IdSchema, name: z.string().min(1) }).nullable(),
  delegate: ApprovalDelegateDtoSchema.nullable(),
  status: ApprovalStepStatusSchema,
  dueAt: IsoDateTimeSchema.nullable(),
  activatedAt: IsoDateTimeSchema.nullable(),
  completedAt: IsoDateTimeSchema.nullable(),
  decisions: z.array(ApprovalDecisionDtoSchema),
});
export type ApprovalStepDto = z.infer<typeof ApprovalStepDtoSchema>;

export const ApprovalPolicyMatchDtoSchema = z.object({
  policyId: IdSchema,
  policyCode: z.string().min(1),
  policyName: z.string().min(1),
  policyVersion: RevisionSchema,
  matchedFacts: JsonObjectSchema,
  reason: z.string().min(1),
});
export type ApprovalPolicyMatchDto = z.infer<
  typeof ApprovalPolicyMatchDtoSchema
>;

export const ApprovalRequestDtoSchema = z.object({
  id: IdSchema,
  quoteId: IdSchema,
  quoteVersionId: IdSchema,
  quote: QuoteSummaryDtoSchema,
  termsFingerprint: TermsFingerprintSchema,
  currentTermsFingerprint: TermsFingerprintSchema,
  termsChanged: z.boolean(),
  status: ApprovalRequestStatusSchema,
  currentSequence: z.number().int().positive().nullable(),
  requiredRoute: z.array(ApprovalRouteStepDtoSchema),
  decisionExplanation: z.array(z.string().min(1)),
  policyMatches: z.array(ApprovalPolicyMatchDtoSchema),
  steps: z.array(ApprovalStepDtoSchema),
  requestedAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema.nullable(),
  updatedAt: IsoDateTimeSchema,
});
export type ApprovalRequestDto = z.infer<typeof ApprovalRequestDtoSchema>;

export const ApprovalInboxQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: ApprovalRequestStatusSchema.optional(),
  overdueOnly: z.coerce.boolean().optional(),
  queue: z.enum(["manager", "finance", "completed", "overdue"]).optional(),
});
export type ApprovalInboxQuery = z.infer<typeof ApprovalInboxQuerySchema>;

export const AssignApprovalDelegateRequestSchema = z
  .object({
    delegateEmail: EmailSchema,
    expiresAt: IsoDateTimeSchema,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type AssignApprovalDelegateRequest = z.infer<
  typeof AssignApprovalDelegateRequestSchema
>;

export const ClearApprovalDelegateRequestSchema = z
  .object({ reason: z.string().trim().min(1).max(500) })
  .strict();
export type ClearApprovalDelegateRequest = z.infer<
  typeof ClearApprovalDelegateRequestSchema
>;

export const ApprovalDecisionRequestSchema = z
  .object({
    action: ApprovalDecisionActionSchema,
    comment: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action !== "APPROVE" && value.comment === undefined) {
      context.addIssue({
        code: "custom",
        path: ["comment"],
        message: "A reason is required when rejecting or requesting revision",
      });
    }
  });
export type ApprovalDecisionRequest = z.infer<
  typeof ApprovalDecisionRequestSchema
>;

export const ApproveApprovalRequestSchema = z
  .object({ comment: z.string().trim().min(1).max(1000).optional() })
  .strict();
export type ApproveApprovalRequest = z.infer<
  typeof ApproveApprovalRequestSchema
>;

export const RejectApprovalRequestSchema = z
  .object({ comment: z.string().trim().min(1).max(1000) })
  .strict();
export type RejectApprovalRequest = z.infer<typeof RejectApprovalRequestSchema>;

export const RequestRevisionApprovalRequestSchema = RejectApprovalRequestSchema;
export type RequestRevisionApprovalRequest = z.infer<
  typeof RequestRevisionApprovalRequestSchema
>;

export const ApprovalStepTemplateInputSchema = z
  .object({
    sequence: z.number().int().positive(),
    requiredRole: RoleSchema,
    requiredCapability: z.string().trim().min(1).max(100),
    assigneeStrategy: z.string().trim().min(1).max(80),
    dueAfterHours: z.number().int().positive().optional(),
  })
  .strict();
export type ApprovalStepTemplateInput = z.infer<
  typeof ApprovalStepTemplateInputSchema
>;

export const ApprovalPolicyDtoSchema = z.object({
  id: IdSchema,
  code: z.string().min(1),
  version: RevisionSchema,
  name: z.string().min(1),
  predicates: JsonObjectSchema,
  priority: z.number().int(),
  status: ConfigurationStatusSchema,
  effectiveFrom: IsoDateTimeSchema,
  effectiveTo: IsoDateTimeSchema.nullable(),
  steps: z.array(ApprovalStepTemplateInputSchema),
});
export type ApprovalPolicyDto = z.infer<typeof ApprovalPolicyDtoSchema>;

export const CreateApprovalPolicyRequestSchema = z
  .object({
    code: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(140),
    predicates: JsonObjectSchema,
    priority: z.number().int().default(0),
    status: ConfigurationStatusSchema.default("DRAFT"),
    effectiveFrom: IsoDateTimeSchema,
    effectiveTo: IsoDateTimeSchema.optional(),
    steps: z.array(ApprovalStepTemplateInputSchema).min(1),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.steps.map((step) => step.sequence)).size ===
      value.steps.length,
    {
      message: "Approval step sequence values must be unique",
      path: ["steps"],
    },
  );
export type CreateApprovalPolicyRequest = z.infer<
  typeof CreateApprovalPolicyRequestSchema
>;

export const UpdateApprovalPolicyRequestSchema = z
  .object({
    revision: RevisionSchema,
    name: z.string().trim().min(1).max(140).optional(),
    predicates: JsonObjectSchema.optional(),
    priority: z.number().int().optional(),
    status: ConfigurationStatusSchema.optional(),
    effectiveTo: IsoDateTimeSchema.nullable().optional(),
    steps: z.array(ApprovalStepTemplateInputSchema).min(1).optional(),
  })
  .strict();
export type UpdateApprovalPolicyRequest = z.infer<
  typeof UpdateApprovalPolicyRequestSchema
>;
