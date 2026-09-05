import { z } from "zod";
import { BillingTypes, ProductTypes } from "../enums.js";

export const createQuoteSchema = z.object({
  customerAccountId: z.string(),
  currency: z.string().default("USD"),
  paymentTermsDays: z.number().int().min(0).default(30),
  expiresAt: z.iso.datetime().optional(),
  notes: z.string().optional(),
});

export const updateQuoteSchema = z.object({
  revision: z.number().int(),
  paymentTermsDays: z.number().int().min(0).optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const createQuoteLineSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().positive(),
  discountPercent: z.number().min(0).max(100).default(0),
  billingType: z.enum([BillingTypes.ONE_TIME, BillingTypes.RECURRING]).default(BillingTypes.ONE_TIME),
  subscriptionPlanId: z.string().optional(),
  unitPriceOverride: z.number().optional(),
});

export const updateQuoteLineSchema = z.object({
  revision: z.number().int(),
  quantity: z.number().positive().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  billingType: z.enum([BillingTypes.ONE_TIME, BillingTypes.RECURRING]).optional(),
  subscriptionPlanId: z.string().nullable().optional(),
  unitPriceOverride: z.number().optional(),
});

export const calculateQuoteSchema = z.object({
  revision: z.number().int(),
});

export const submitQuoteSchema = z.object({
  revision: z.number().int(),
});

export const quoteLineDtoSchema = z.object({
  id: z.string(),
  lineNumber: z.number(),
  productId: z.string(),
  productName: z.string(),
  productType: z.enum([ProductTypes.HARDWARE, ProductTypes.SERVICE, ProductTypes.SUBSCRIPTION]),
  sku: z.string().nullable(),
  quantity: z.string(),
  unitPrice: z.string(),
  discountPercent: z.string(),
  discountAmount: z.string(),
  taxRate: z.string(),
  taxAmount: z.string(),
  lineTotal: z.string(),
  billingType: z.enum([BillingTypes.ONE_TIME, BillingTypes.RECURRING]),
  subscriptionPlanId: z.string().nullable(),
  riskContribution: z.record(z.string(), z.unknown()).optional(),
});

export const riskFactsSchema = z.object({
  blendedExcess: z.string(),
  maxLineExcess: z.string(),
  marginPercent: z.string(),
  creditExposure: z.string(),
  lineContributions: z.array(
    z.object({
      lineId: z.string(),
      allowedDiscount: z.string(),
      appliedDiscount: z.string(),
      excess: z.string(),
      weight: z.string(),
      weightedExcess: z.string(),
    }),
  ),
  routeReasons: z.array(z.string()),
  requiredApprovers: z.array(z.string()),
  safeDiscountSuggestion: z
    .object({
      lineId: z.string(),
      suggestedDiscount: z.string(),
      reason: z.string(),
    })
    .nullable()
    .optional(),
});

export const quoteVersionDtoSchema = z.object({
  id: z.string(),
  revisionNumber: z.number(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.string(),
  taxTotal: z.string(),
  discountTotal: z.string(),
  total: z.string(),
  grossMargin: z.string(),
  marginPercent: z.string(),
  termsFingerprint: z.string(),
  paymentTermsDays: z.number(),
  riskFacts: riskFactsSchema.optional(),
  lines: z.array(quoteLineDtoSchema),
});

export const quoteDtoSchema = z.object({
  id: z.string(),
  quoteNumber: z.string(),
  stage: z.string(),
  customerAccountId: z.string(),
  customerName: z.string(),
  ownerId: z.string(),
  ownerName: z.string(),
  revision: z.number(),
  expiresAt: z.string().nullable(),
  currentVersion: quoteVersionDtoSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type CreateQuoteLineInput = z.infer<typeof createQuoteLineSchema>;
export type QuoteDto = z.infer<typeof quoteDtoSchema>;
export type RiskFacts = z.infer<typeof riskFactsSchema>;
