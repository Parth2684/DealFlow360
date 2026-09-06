import { z } from "zod";

import { DEFAULT_LOCALE } from "./constants.js";
import { CapabilitySchema } from "./constants.js";
import { MagicLinkScopeSchema, RoleSchema, UserStatusSchema } from "./enums.js";
import {
  CurrencyCodeSchema,
  EmailSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  NonEmptyStringSchema,
  TimeZoneSchema,
  type Locale,
} from "./primitives.js";

export const OrganizationFormattingSchema = z.object({
  locale: LocaleSchema,
  timezone: TimeZoneSchema,
});
export type OrganizationFormatting = z.infer<
  typeof OrganizationFormattingSchema
>;

export const StoredOrganizationSettingsSchema = z
  .object({ locale: LocaleSchema.default(DEFAULT_LOCALE) })
  .passthrough();

/**
 * Stored settings predate locale support, so missing or malformed locale data
 * resolves to the documented product default instead of breaking a session.
 */
export function resolveOrganizationLocale(settings: unknown): Locale {
  const parsed = StoredOrganizationSettingsSchema.safeParse(settings);
  return parsed.success ? parsed.data.locale : DEFAULT_LOCALE;
}

export const OrganizationSummarySchema = OrganizationFormattingSchema.extend({
  id: IdSchema,
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(80),
  baseCurrency: CurrencyCodeSchema,
});
export type OrganizationSummary = z.infer<typeof OrganizationSummarySchema>;

export const UserSummarySchema = z.object({
  id: IdSchema,
  email: EmailSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  status: UserStatusSchema,
  roles: z.array(RoleSchema),
  capabilities: z.array(CapabilitySchema),
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

export const SignupRequestSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(12).max(128),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    organizationName: z.string().trim().min(2).max(160),
  })
  .strict();
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const LoginRequestSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthResponseSchema = z.object({
  user: UserSummarySchema,
  organization: OrganizationSummarySchema,
  csrfToken: z.string().min(16),
  sessionExpiresAt: IsoDateTimeSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const CurrentUserResponseSchema = AuthResponseSchema;
export type CurrentUserResponse = z.infer<typeof CurrentUserResponseSchema>;

/** Refresh is cookie-backed; an empty strict body prevents token material in JSON. */
export const RefreshSessionRequestSchema = z.object({}).strict();
export type RefreshSessionRequest = z.infer<typeof RefreshSessionRequestSchema>;

export const RefreshSessionResponseSchema = AuthResponseSchema;
export type RefreshSessionResponse = z.infer<
  typeof RefreshSessionResponseSchema
>;

export const CsrfTokenResponseSchema = z.object({
  csrfToken: z.string().min(16),
});
export type CsrfTokenResponse = z.infer<typeof CsrfTokenResponseSchema>;

export const LogoutResponseSchema = z.object({
  success: z.literal(true),
});
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;

/** Portal logout is cookie-backed and accepts no client-controlled fields. */
export const PortalLogoutRequestSchema = z.object({}).strict();
export type PortalLogoutRequest = z.infer<typeof PortalLogoutRequestSchema>;

export const PortalLogoutResponseSchema = LogoutResponseSchema;
export type PortalLogoutResponse = LogoutResponse;

export const MagicLinkRequestSchema = z
  .object({
    email: EmailSchema,
    quoteId: IdSchema.optional(),
    scope: MagicLinkScopeSchema.default("CUSTOMER"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.scope === "QUOTE" && value.quoteId === undefined) {
      context.addIssue({
        code: "custom",
        path: ["quoteId"],
        message: "quoteId is required for a quote-scoped magic link",
      });
    }
    if (value.scope === "CUSTOMER" && value.quoteId !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["quoteId"],
        message: "Account access does not require a quote reference",
      });
    }
  });
export type MagicLinkRequest = z.infer<typeof MagicLinkRequestSchema>;

export const MagicLinkCreatedResponseSchema = z.object({
  accepted: z.literal(true),
  expiresAt: IsoDateTimeSchema.optional(),
});
export type MagicLinkCreatedResponse = z.infer<
  typeof MagicLinkCreatedResponseSchema
>;

export const PortalSessionExchangeRequestSchema = z
  .object({
    token: NonEmptyStringSchema.max(512),
  })
  .strict();
export type PortalSessionExchangeRequest = z.infer<
  typeof PortalSessionExchangeRequestSchema
>;

export const PortalSessionResponseSchema = z.object({
  portalIdentity: z.object({
    id: IdSchema,
    email: EmailSchema,
    customerAccountId: IdSchema,
    customerName: z.string().min(1),
  }),
  quoteId: IdSchema.nullable(),
  scope: MagicLinkScopeSchema,
  formatting: OrganizationFormattingSchema,
  expiresAt: IsoDateTimeSchema,
});
export type PortalSessionResponse = z.infer<typeof PortalSessionResponseSchema>;
