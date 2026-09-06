"use client";

import {
  PortalSessionExchangeRequestSchema,
  PortalSessionResponseSchema,
  planApiRoutes,
} from "@repo/common";
import { ButtonLink, ErrorFeedback, Skeleton } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";

export function PortalTokenExchange({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const active = useRef(true);
  const startedToken = useRef<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    active.current = true;

    if (startedToken.current !== token) {
      startedToken.current = token;
      window.history.replaceState({}, "", "/portal/login");

      async function exchange() {
        try {
          const input = PortalSessionExchangeRequestSchema.parse({ token });
          const session = await browserApiRequest(
            planApiRoutes.auth.exchangePortalSession,
            {
              json: input,
              method: "POST",
              retryAuth: false,
              schema: PortalSessionResponseSchema,
              scope: "public",
            },
          );
          if (!active.current || startedToken.current !== token) return;

          const destination = session.quoteId
            ? `/portal/quotations/${encodeURIComponent(session.quoteId)}`
            : "/portal";
          queryClient.clear();
          router.replace(destination);
          router.refresh();
        } catch (error) {
          if (!active.current || startedToken.current !== token) return;
          setErrorMessage(
            error instanceof ApiProblemError
              ? (error.problem.detail ??
                  "The access link is not valid. Request a new link.")
              : "The access link could not be verified. Request a new link.",
          );
        }
      }

      void exchange();
    }

    return () => {
      active.current = false;
    };
  }, [queryClient, router, token]);

  if (errorMessage) {
    return (
      <div className="grid gap-md">
        <ErrorFeedback title="Link Not Verified">{errorMessage}</ErrorFeedback>
        <ButtonLink href="/portal/login" variant="secondary">
          Request a New Link
        </ButtonLink>
      </div>
    );
  }

  return (
    <div
      aria-busy="true"
      aria-label="Verifying customer access"
      className="grid gap-sm"
    >
      <Skeleton className="w-full" />
      <Skeleton className="w-3/4" />
      <p className="m-0 text-body-sm text-foreground-muted">
        Verifying access…
      </p>
    </div>
  );
}
