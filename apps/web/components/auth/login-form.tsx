"use client";

import {
  AuthResponseSchema,
  LoginRequestSchema,
  apiRoutes,
  type LoginRequest,
} from "@repo/common";
import {
  Button,
  ButtonLink,
  ErrorFeedback,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  LiveRegion,
} from "@repo/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { browserApiRequest } from "../../lib/api/browser";
import { applyFormProblem } from "./form-problem";

const loginFields = ["email", "password"] as const;

function safeNextPath(value: string | undefined): string {
  if (!value) return "/workspace";

  try {
    const destination = new URL(value, window.location.origin);
    const isPortalPath =
      destination.pathname === "/portal" ||
      destination.pathname.startsWith("/portal/");

    if (destination.origin !== window.location.origin || isPortalPath) {
      return "/workspace";
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/workspace";
  }
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string>();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginRequest>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(LoginRequestSchema),
  });

  const submit = handleSubmit(async (values) => {
    setFormMessage(undefined);
    try {
      const session = await browserApiRequest(apiRoutes.auth.login, {
        json: values,
        method: "POST",
        retryAuth: false,
        schema: AuthResponseSchema,
        scope: "public",
      });
      const hasInternalAccess = session.user.capabilities.some(
        (capability) => !capability.startsWith("portal."),
      );
      queryClient.clear();
      router.replace(
        hasInternalAccess
          ? safeNextPath(nextPath)
          : "/portal/login?reason=customer-access",
      );
      router.refresh();
    } catch (error) {
      setFormMessage(applyFormProblem(error, setError, loginFields));
    }
  });

  return (
    <form className="grid gap-md" noValidate onSubmit={submit}>
      {formMessage ? (
        <ErrorFeedback title="Sign-in Failed">{formMessage}</ErrorFeedback>
      ) : null}
      <LiveRegion message={isSubmitting ? "Signing in…" : formMessage} />

      <Field>
        <FieldLabel htmlFor="login-email">Work Email</FieldLabel>
        <Input
          {...register("email")}
          aria-describedby={errors.email ? "login-email-error" : undefined}
          aria-invalid={errors.email ? true : undefined}
          autoComplete="email"
          id="login-email"
          inputMode="email"
          maxLength={254}
          spellCheck={false}
          type="email"
        />
        {errors.email ? (
          <FieldError id="login-email-error">{errors.email.message}</FieldError>
        ) : null}
      </Field>

      <Field>
        <FieldLabel htmlFor="login-password">Password</FieldLabel>
        <Input
          {...register("password")}
          aria-describedby={
            errors.password ? "login-password-error" : "login-password-help"
          }
          aria-invalid={errors.password ? true : undefined}
          autoComplete="current-password"
          id="login-password"
          maxLength={128}
          type="password"
        />
        {errors.password ? (
          <FieldError id="login-password-error">
            {errors.password.message}
          </FieldError>
        ) : (
          <FieldDescription id="login-password-help">
            Use the password configured for your DealFlow360 account.
          </FieldDescription>
        )}
      </Field>

      <Button disabled={isSubmitting} fullWidth type="submit">
        {isSubmitting ? "Signing In…" : "Sign In"}
      </Button>

      <div className="grid gap-xs border-t border-border pt-md sm:grid-cols-2">
        <ButtonLink href="/signup" variant="secondary">
          Create an Account
        </ButtonLink>
        <ButtonLink href="/portal/login" variant="quiet">
          Customer Portal
        </ButtonLink>
      </div>
    </form>
  );
}
