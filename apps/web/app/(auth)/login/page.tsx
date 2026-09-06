import type { Metadata } from "next";

import { AuthFrame } from "../../../components/auth/auth-frame";
import { LoginForm } from "../../../components/auth/login-form";
import { getSystemHealthState } from "../../../lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign In" };

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [health, query] = await Promise.all([
    getSystemHealthState(),
    searchParams,
  ]);
  const nextPath = typeof query.next === "string" ? query.next : undefined;

  return (
    <AuthFrame
      description="Use your internal account to continue to the governed commercial workspace."
      health={health}
      title="Sign In to Your Workspace"
    >
      <LoginForm nextPath={nextPath} />
    </AuthFrame>
  );
}
