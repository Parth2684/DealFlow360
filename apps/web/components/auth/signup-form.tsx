"use client";

import {
  AuthResponseSchema,
  SignupRequestSchema,
  apiRoutes,
  type SignupRequest,
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

const signupFields = [
  "organizationName",
  "firstName",
  "lastName",
  "email",
  "password",
] as const;

export function SignupForm() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<string>();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<SignupRequest>({
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      organizationName: "",
      password: "",
    },
    resolver: zodResolver(SignupRequestSchema),
  });

  const submit = handleSubmit(async (values) => {
    setFormMessage(undefined);
    try {
      await browserApiRequest(apiRoutes.auth.signup, {
        json: values,
        method: "POST",
        retryAuth: false,
        schema: AuthResponseSchema,
        scope: "public",
      });
      queryClient.clear();
      router.replace("/workspace");
      router.refresh();
    } catch (error) {
      setFormMessage(applyFormProblem(error, setError, signupFields));
    }
  });

  return (
    <form className="grid gap-md" noValidate onSubmit={submit}>
      {formMessage ? (
        <ErrorFeedback title="Account Not Created">{formMessage}</ErrorFeedback>
      ) : null}
      <LiveRegion message={isSubmitting ? "Creating account…" : formMessage} />

      <Field>
        <FieldLabel htmlFor="signup-organization">Organization Name</FieldLabel>
        <Input
          {...register("organizationName")}
          aria-describedby={
            errors.organizationName ? "signup-organization-error" : undefined
          }
          aria-invalid={errors.organizationName ? true : undefined}
          autoComplete="organization"
          id="signup-organization"
          maxLength={160}
          type="text"
        />
        {errors.organizationName ? (
          <FieldError id="signup-organization-error">
            {errors.organizationName.message}
          </FieldError>
        ) : null}
      </Field>

      <div className="grid gap-md sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="signup-first-name">First Name</FieldLabel>
          <Input
            {...register("firstName")}
            aria-describedby={
              errors.firstName ? "signup-first-name-error" : undefined
            }
            aria-invalid={errors.firstName ? true : undefined}
            autoComplete="given-name"
            id="signup-first-name"
            maxLength={100}
            type="text"
          />
          {errors.firstName ? (
            <FieldError id="signup-first-name-error">
              {errors.firstName.message}
            </FieldError>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="signup-last-name">Last Name</FieldLabel>
          <Input
            {...register("lastName")}
            aria-describedby={
              errors.lastName ? "signup-last-name-error" : undefined
            }
            aria-invalid={errors.lastName ? true : undefined}
            autoComplete="family-name"
            id="signup-last-name"
            maxLength={100}
            type="text"
          />
          {errors.lastName ? (
            <FieldError id="signup-last-name-error">
              {errors.lastName.message}
            </FieldError>
          ) : null}
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="signup-email">Work Email</FieldLabel>
        <Input
          {...register("email")}
          aria-describedby={errors.email ? "signup-email-error" : undefined}
          aria-invalid={errors.email ? true : undefined}
          autoComplete="email"
          id="signup-email"
          inputMode="email"
          maxLength={254}
          spellCheck={false}
          type="email"
        />
        {errors.email ? (
          <FieldError id="signup-email-error">
            {errors.email.message}
          </FieldError>
        ) : null}
      </Field>

      <Field>
        <FieldLabel htmlFor="signup-password">Password</FieldLabel>
        <Input
          {...register("password")}
          aria-describedby={
            errors.password ? "signup-password-error" : "signup-password-help"
          }
          aria-invalid={errors.password ? true : undefined}
          autoComplete="new-password"
          id="signup-password"
          maxLength={128}
          minLength={12}
          type="password"
        />
        {errors.password ? (
          <FieldError id="signup-password-error">
            {errors.password.message}
          </FieldError>
        ) : (
          <FieldDescription id="signup-password-help">
            Use at least 12 characters.
          </FieldDescription>
        )}
      </Field>

      <Button disabled={isSubmitting} fullWidth type="submit">
        {isSubmitting ? "Creating Account…" : "Create Account"}
      </Button>
      <ButtonLink fullWidth href="/login" variant="quiet">
        Return to Sign In
      </ButtonLink>
    </form>
  );
}
