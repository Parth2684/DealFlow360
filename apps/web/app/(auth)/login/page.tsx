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
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
      router.push("/quotations");
    },
    onError: (error) => {
      setError("root", { message: error instanceof ApiError ? error.message : "Login failed" });
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
      <h1 className="text-lg font-medium text-ink">Sign in</h1>
      <Field label="Email" htmlFor="email" required error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" required error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
      </Field>
      {errors.root ? <p className="text-sm text-error">{errors.root.message}</p> : null}
      <Button type="submit" loading={mutation.isPending} className="w-full">
        Sign in
      </Button>
      <p className="text-center text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
