"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  apiRoutes,
  CustomerAccessRequestSchema,
  CustomerAccessAcceptedSchema,
} from "@repo/common";
import {
  Button,
  ButtonLink,
  Field,
  FieldLabel,
  Input,
  Textarea,
  ErrorFeedback,
  InlineFeedback,
} from "@repo/ui";
import { browserApiRequest } from "../../lib/api/browser";
const SuccessSchema = z.object({ success: z.literal(true) });

export function CustomerAccessForm({ organization }: { organization: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  if (done)
    return (
      <InlineFeedback title="Request submitted">
        Your request is ready for the administrator to review. If approved, you
        will receive your sign-in credentials by email. If this email already
        has an account or a pending request, that account remains unchanged.
        <ButtonLink href="/portal/login" variant="quiet">
          Back to Sign In
        </ButtonLink>
      </InlineFeedback>
    );
  return (
    <form
      className="grid gap-md"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          const data = new FormData(event.currentTarget);
          const input = CustomerAccessRequestSchema.parse({
            ...Object.fromEntries(data),
            organization,
          });
          await browserApiRequest(apiRoutes.customerAccess.request, {
            method: "POST",
            json: input,
            schema: CustomerAccessAcceptedSchema,
            scope: "public",
            retryAuth: false,
          });
          setDone(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unable to submit request");
        } finally {
          setBusy(false);
        }
      }}
    >
      {error ? (
        <ErrorFeedback title="Request needs attention">{error}</ErrorFeedback>
      ) : null}
      {[
        { name: "firstName", label: "First Name", max: 100 },
        { name: "lastName", label: "Last Name", max: 100 },
        { name: "companyName", label: "Company Name", max: 180 },
        { name: "email", label: "Work Email", max: 254 },
      ].map((field) => (
        <Field key={field.name}>
          <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
          <Input
            id={field.name}
            name={field.name}
            required
            maxLength={field.max}
            type={field.name === "email" ? "email" : "text"}
            autoComplete={field.name === "email" ? "email" : undefined}
          />
        </Field>
      ))}
      <Field>
        <FieldLabel htmlFor="request-message">
          Message to the Administrator (Optional)
        </FieldLabel>
        <Textarea id="request-message" name="message" maxLength={1000} />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? "Submitting…" : "Request Customer Account"}
      </Button>
      <ButtonLink href="/portal/login" variant="quiet">
        Already approved? Sign In
      </ButtonLink>
    </form>
  );
}
export function CustomerPasswordLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-md"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const data = new FormData(event.currentTarget);
        try {
          await browserApiRequest(apiRoutes.customerAccess.login, {
            method: "POST",
            json: Object.fromEntries(data),
            schema: SuccessSchema,
            scope: "public",
            retryAuth: false,
          });
          router.replace("/portal");
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Sign-in failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {error ? (
        <ErrorFeedback title="Unable to sign in">{error}</ErrorFeedback>
      ) : null}
      <Field>
        <FieldLabel htmlFor="customer-login-email">Email</FieldLabel>
        <Input
          id="customer-login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="customer-login-password">Password</FieldLabel>
        <Input
          id="customer-login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          maxLength={128}
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? "Signing In…" : "Sign In"}
      </Button>
    </form>
  );
}
export function CustomerPasswordChange() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return (
    <form
      className="grid max-w-xl gap-md"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setError("");
        setDone(false);
        try {
          if (data.get("password") !== data.get("confirmPassword"))
            throw new Error("The new passwords do not match");
          await browserApiRequest(apiRoutes.customerAccess.password, {
            method: "POST",
            json: {
              currentPassword: data.get("currentPassword"),
              password: data.get("password"),
            },
            schema: SuccessSchema,
            scope: "portal",
            retryAuth: false,
          });
          setDone(true);
          form.reset();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Password change failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {error ? (
        <ErrorFeedback title="Unable to change password">{error}</ErrorFeedback>
      ) : null}
      {done ? (
        <InlineFeedback tone="success">
          Password updated. Other sessions have been signed out.
        </InlineFeedback>
      ) : null}
      {[
        { name: "currentPassword", label: "Current Password" },
        { name: "password", label: "New Password (at least 12 characters)" },
        { name: "confirmPassword", label: "Confirm New Password" },
      ].map((field) => (
        <Field key={field.name}>
          <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
          <Input
            id={field.name}
            name={field.name}
            type="password"
            required
            minLength={field.name === "currentPassword" ? 1 : 12}
            maxLength={128}
            autoComplete={
              field.name === "currentPassword"
                ? "current-password"
                : "new-password"
            }
          />
        </Field>
      ))}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Change Password"}
      </Button>
    </form>
  );
}
