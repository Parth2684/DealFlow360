"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/resources";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const schema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: authApi.signup,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      router.push("/quotations");
    },
    onError: (error) => {
      setError("root", { message: error instanceof ApiError ? error.message : "Signup failed" });
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
      <h1 className="text-lg font-medium text-ink">Create your organization</h1>
      <Field label="Organization name" htmlFor="organizationName" required error={errors.organizationName?.message}>
        <Input id="organizationName" {...register("organizationName")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="firstName" required error={errors.firstName?.message}>
          <Input id="firstName" {...register("firstName")} />
        </Field>
        <Field label="Last name" htmlFor="lastName" required error={errors.lastName?.message}>
          <Input id="lastName" {...register("lastName")} />
        </Field>
      </div>
      <Field label="Email" htmlFor="email" required error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" required error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
      </Field>
      {errors.root ? <p className="text-sm text-error">{errors.root.message}</p> : null}
      <Button type="submit" loading={mutation.isPending} className="w-full">
        Create account
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
