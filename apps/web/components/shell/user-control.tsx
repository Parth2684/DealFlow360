"use client";

import {
  LogoutResponseSchema,
  apiRoutes,
  type CurrentUserResponse,
} from "@repo/common";
import { Button, ErrorFeedback, LiveRegion } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";

export function UserControl({ session }: { session: CurrentUserResponse }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const primaryRole =
    session.user.roles[0]?.replaceAll("_", " ") ?? "Team Member";

  async function signOut() {
    setIsSigningOut(true);
    setErrorMessage(undefined);
    try {
      await browserApiRequest(apiRoutes.auth.logout, {
        json: {},
        method: "POST",
        retryAuth: false,
        schema: LogoutResponseSchema,
        scope: "internal",
      });
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiProblemError
          ? (error.problem.detail ?? "Sign-out failed. Try again.")
          : "Sign-out failed. Check the API and try again.",
      );
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-sm">
      <div className="hidden min-w-0 text-right md:block">
        <p className="m-0 truncate text-body-sm font-semibold text-foreground-strong">
          {session.user.firstName} {session.user.lastName}
        </p>
        <p className="m-0 truncate text-caption text-foreground-muted">
          {primaryRole}
        </p>
      </div>
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
