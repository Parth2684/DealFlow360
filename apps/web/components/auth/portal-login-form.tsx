"use client";

import {
  MagicLinkCreatedResponseSchema,
  planApiRoutes,
  type MagicLinkRequest,
} from "@repo/common";
import {
  Button,
  ButtonLink,
  ErrorFeedback,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  InlineFeedback,
  Input,
  LiveRegion,
} from "@repo/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { browserApiResponse } from "../../lib/api/browser";
import { applyFormProblem } from "./form-problem";

const PortalLoginFormSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
});
type PortalLoginFormValues = z.infer<typeof PortalLoginFormSchema>;

export function PortalLoginForm({ reason }: { reason?: string }) {
  const [formMessage, setFormMessage] = useState<string>();
  const [accepted, setAccepted] = useState(false);
  const [demoToken, setDemoToken] = useState<string>();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<PortalLoginFormValues>({
    defaultValues: { email: "" },
    resolver: zodResolver(PortalLoginFormSchema),
  });

  const submit = handleSubmit(async (values) => {
    setAccepted(false);
    setDemoToken(undefined);
    setFormMessage(undefined);

    const payload: MagicLinkRequest = {
      email: values.email.toLowerCase(),
      scope: "CUSTOMER",
    };

    try {
      const result = await browserApiResponse(
        planApiRoutes.auth.requestPortalMagicLink,
        {
          json: payload,
          method: "POST",
          retryAuth: false,
          schema: MagicLinkCreatedResponseSchema,
          scope: "public",
        },
      );
      setAccepted(result.data.accepted);
      setDemoToken(result.headers.get("X-Demo-Magic-Token") ?? undefined);
    } catch (error) {
      setFormMessage(applyFormProblem(error, setError, ["email"]));
    }
  });

  function clearAcceptedRequest() {
    if (!accepted && !demoToken) return;
    setAccepted(false);
    setDemoToken(undefined);
  }

  return (
    <form
      className="grid gap-md"
      noValidate
      onChange={clearAcceptedRequest}
      onSubmit={submit}
    >
      {reason === "customer-access" ? (
        <InlineFeedback title="Use Secure Portal Access" tone="info">
          Enter your contact email to access your account and shared quotations.
        </InlineFeedback>
      ) : null}
      {accepted ? (
        <InlineFeedback title="Check Your Email" tone="success">
          If your email is enabled for customer access, you will receive a
          secure sign-in link.
        </InlineFeedback>
      ) : null}
      {demoToken ? (
        <InlineFeedback title="Local Demo Link" tone="info">
          <div className="grid gap-xs">
            <p className="m-0">
              Email delivery is not configured locally. Continue with the
              API-issued demo link.
            </p>
            <ButtonLink
              href={`/portal/login?token=${encodeURIComponent(demoToken)}`}
              variant="secondary"
            >
              Verify Demo Link
            </ButtonLink>
          </div>
        </InlineFeedback>
      ) : null}
      {formMessage ? (
        <ErrorFeedback title="Link Not Requested">{formMessage}</ErrorFeedback>
      ) : null}
      <LiveRegion
        message={
          isSubmitting
            ? "Requesting access link…"
            : accepted
              ? "Access link request accepted."
              : formMessage
        }
      />

      <Field>
        <FieldLabel htmlFor="portal-email">Contact Email</FieldLabel>
        <Input
          {...register("email")}
          aria-describedby={
            errors.email ? "portal-email-error" : "portal-email-help"
          }
          aria-invalid={errors.email ? true : undefined}
          autoComplete="email"
          id="portal-email"
          inputMode="email"
          maxLength={254}
          spellCheck={false}
          type="email"
        />
        {errors.email ? (
          <FieldError id="portal-email-error">
            {errors.email.message}
          </FieldError>
        ) : (
          <FieldDescription id="portal-email-help">
            Use the email address your sales team has on file.
          </FieldDescription>
        )}
      </Field>

      <Button disabled={isSubmitting} fullWidth type="submit">
        {isSubmitting ? "Requesting Link…" : "Request Access Link"}
      </Button>
      <ButtonLink fullWidth href="/login" variant="quiet">
        Internal Team Sign In
      </ButtonLink>
    </form>
  );
}
