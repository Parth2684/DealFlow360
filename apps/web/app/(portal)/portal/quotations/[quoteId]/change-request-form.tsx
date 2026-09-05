"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { negotiationApi } from "@/lib/api/resources";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { CHANGE_REQUEST_ACTIONS } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";
import type { QuoteLine } from "@/lib/api/types";

export function ChangeRequestForm({ quoteId, lines }: { quoteId: string; lines: QuoteLine[] }) {
  const [message, setMessage] = useState("");
  const [lineId, setLineId] = useState(lines[0]?.id ?? "");
  const [action, setAction] = useState<(typeof CHANGE_REQUEST_ACTIONS)[number]>("CHANGE_QUANTITY");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      negotiationApi.createChangeRequest(quoteId, {
        message: message || undefined,
        requestedChanges: [
          {
            quoteLineId: lineId,
            action,
            quantity: action === "CHANGE_QUANTITY" ? quantity : undefined,
            unitPrice: action === "CHANGE_PRICE" ? unitPrice : undefined,
          },
        ],
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["change-requests", quoteId] });
      notify({ title: "Change request sent", variant: "success" });
      setMessage("");
      setQuantity("");
      setUnitPrice("");
    },
    onError: (err) => {
      notify({
        title: "Could not send request",
        description: err instanceof ApiError ? err.message : undefined,
        variant: "error",
      });
    },
  });

  if (lines.length === 0) return null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <Field label="Line" htmlFor="lineId">
        <Select id="lineId" value={lineId} onChange={(e) => setLineId(e.target.value)}>
          {lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.productName}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="What would you like to change?" htmlFor="action">
        <Select id="action" value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
          {CHANGE_REQUEST_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </Field>
      {action === "CHANGE_QUANTITY" ? (
        <Field label="New quantity" htmlFor="quantity">
          <Input id="quantity" type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
      ) : null}
      {action === "CHANGE_PRICE" ? (
        <Field label="Proposed unit price" htmlFor="unitPrice">
          <Input id="unitPrice" type="number" min={0} step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </Field>
      ) : null}
      <Field label="Message" htmlFor="message" helper="Optional">
        <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add context for the seller…" />
      </Field>
      <Button type="submit" loading={mutation.isPending} className="w-full">
        Send request
      </Button>
    </form>
  );
}
