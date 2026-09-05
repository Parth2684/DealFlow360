"use client";

import { useState } from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { Field, Textarea } from "./input";

export function ConfirmWithReasonButton({
  label,
  title,
  description,
  triggerVariant = "danger",
  reasonRequired,
  onConfirm,
  loading,
  icon,
}: {
  label: string;
  title: string;
  description?: string;
  triggerVariant?: "danger" | "secondary" | "primary";
  reasonRequired?: boolean;
  onConfirm: (reason: string) => void;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <>
      <Button size="sm" variant={triggerVariant} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={title} description={description} width="sm">
        <Field label="Reason" htmlFor="reason" required={reasonRequired}>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Back
          </Button>
          <Button
            type="button"
            variant={triggerVariant}
            disabled={reasonRequired && reason.trim().length === 0}
            loading={loading}
            onClick={() => {
              onConfirm(reason);
              setOpen(false);
            }}
          >
            {label}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
