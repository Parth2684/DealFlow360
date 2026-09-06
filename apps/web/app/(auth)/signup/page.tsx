import type { Metadata } from "next";

import { AuthFrame } from "../../../components/auth/auth-frame";
import { SignupForm } from "../../../components/auth/signup-form";
import { getSystemHealthState } from "../../../lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create Account" };

export default async function SignupPage() {
  const health = await getSystemHealthState();

  return (
    <AuthFrame
      description="Create an organization and its first administrator account."
      health={health}
      title="Set Up DealFlow360"
    >
      <SignupForm />
    </AuthFrame>
  );
}
