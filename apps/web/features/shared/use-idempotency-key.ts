"use client";

import { IDEMPOTENCY_HEADER } from "@repo/common";
import { useCallback, useRef } from "react";

interface LogicalCommand {
  key: string;
  signature: string;
}

/**
 * Reuses a key when the same command is retried after an uncertain response.
 * A changed payload is a new logical command and receives a new key.
 */
export function useIdempotencyKey() {
  const command = useRef<LogicalCommand | null>(null);

  const headersFor = useCallback((payload: unknown): HeadersInit => {
    const signature = JSON.stringify(payload);
    if (command.current?.signature !== signature) {
      command.current = { key: crypto.randomUUID(), signature };
    }

    return { [IDEMPOTENCY_HEADER]: command.current.key };
  }, []);

  const clear = useCallback(() => {
    command.current = null;
  }, []);

  return { clear, headersFor } as const;
}
