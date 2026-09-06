"use client";

import { PortalLogoutResponseSchema, planApiRoutes } from "@repo/common";
import { Button, ErrorFeedback, LiveRegion } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";

export function PortalSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  async function signOut() {
    setIsSigningOut(true);
    setErrorMessage(undefined);
    try {
      await browserApiRequest(planApiRoutes.auth.portalLogout, {
        json: {},
        method: "POST",
        retryAuth: false,
        schema: PortalLogoutResponseSchema,
        scope: "portal",
      });
      queryClient.clear();
      router.replace("/portal/login");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiProblemError
          ? (error.problem.detail ?? "Portal sign-out failed. Try again.")
          : "Portal sign-out failed. Check the API and try again.",
      );
      setIsSigningOut(false);
    }
  }

  return (
    <div className="grid gap-xs">
      <Button
        disabled={isSigningOut}
        onClick={() => void signOut()}
        size="compact"
        variant="secondary"
      >
        {isSigningOut ? "Signing Out…" : "Sign Out"}
      </Button>
      {errorMessage ? (
        <div className="fixed bottom-md right-md z-30 max-w-[24rem]">
          <ErrorFeedback title="Sign-out Failed">{errorMessage}</ErrorFeedback>
        </div>
      ) : null}
      <LiveRegion message={isSigningOut ? "Signing out…" : errorMessage} />
    </div>
  );
}
