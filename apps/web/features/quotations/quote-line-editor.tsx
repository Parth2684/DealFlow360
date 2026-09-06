"use client";

import {
  formatMoney,
  formatPercentage,
  type QuoteLineDto,
  type SubscriptionPlanDto,
  type UpdateQuoteLineRequest,
} from "@repo/common";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableCaption,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  Input,
  Select,
} from "@repo/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { useOrganizationFormatting } from "../../components/foundation/organization-formatting";

type LinePatch = Omit<UpdateQuoteLineRequest, "revision">;

interface LineDraft {
  billingType: "ONE_TIME" | "RECURRING";
  discountPercent: string;
  quantity: string;
  subscriptionPlanId: string;
  unitPrice: string;
}

function draftFrom(line: QuoteLineDto): LineDraft {
  return {
    billingType: line.billingType,
    discountPercent: line.discountPercent,
    quantity: line.quantity,
    subscriptionPlanId: line.subscriptionPlanId ?? "",
    unitPrice: line.unitPrice,
  };
}

function patchFrom(draft: LineDraft): LinePatch {
  return {
    billingType: draft.billingType,
    discountPercent: draft.discountPercent,
    quantity: draft.quantity,
    subscriptionPlanId:
      draft.billingType === "RECURRING"
        ? draft.subscriptionPlanId || null
        : null,
    unitPrice: draft.unitPrice,
  };
}

/**
 * Rendered once per breakpoint container: a <tr> is not a valid child of the
 * mobile <div> and an <article> is not a valid child of <tbody>, so the caller
 * picks the element instead of the component emitting both.
 */
function EditableLine({
  currency,
  disabled,
  line,
  onPatch,
  onRemove,
  plans,
  variant,
}: {
  currency: string;
  disabled: boolean;
  line: QuoteLineDto;
  onPatch: (lineId: string, patch: LinePatch) => Promise<void>;
  onRemove: (line: QuoteLineDto) => void;
  plans: SubscriptionPlanDto[];
  variant: "card" | "row";
}) {
  const { locale } = useOrganizationFormatting();
  const [draft, setDraft] = useState(() => draftFrom(line));
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const committedVersion = useRef(0);
  const latestVersion = useRef(0);
  const timer = useRef<number | null>(null);

  const commit = useCallback(
    (version: number, values: LineDraft) => {
      if (version === 0 || committedVersion.current >= version) return;
      committedVersion.current = version;
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      void onPatch(line.id, patchFrom(values))
        .then(() => {
          if (latestVersion.current === version) setDirtyVersion(0);
        })
        .catch(() => {
          if (latestVersion.current === version) {
            committedVersion.current = Math.max(0, version - 1);
          }
        });
    },
    [line.id, onPatch],
  );

  useEffect(() => {
    if (dirtyVersion === 0) return;
    const version = dirtyVersion;
    timer.current = window.setTimeout(() => {
      commit(version, draft);
    }, 650);
    const guardUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const flushForLink = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("a[href]") !== null
      ) {
        commit(version, draft);
      }
    };
    window.addEventListener("beforeunload", guardUnload);
    document.addEventListener("click", flushForLink, true);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      window.removeEventListener("beforeunload", guardUnload);
      document.removeEventListener("click", flushForLink, true);
    };
  }, [commit, dirtyVersion, draft]);

  function flush() {
    commit(dirtyVersion, draft);
  }

  function update(values: Partial<LineDraft>) {
    setDraft((current) => ({ ...current, ...values }));
    setDirtyVersion((current) => {
      latestVersion.current = current + 1;
      return current + 1;
    });
  }

  const quantityInput = (
    <Input
      aria-label={`${line.productName} quantity`}
      autoComplete="off"
      disabled={disabled}
      inputMode="decimal"
      min="0.0001"
      name={`line-${line.id}-quantity`}
      onBlur={flush}
      onChange={(event) => update({ quantity: event.target.value })}
      step="0.0001"
      type="number"
      value={draft.quantity}
    />
  );
  const unitPriceInput = (
    <Input
      aria-label={`${line.productName} unit price`}
      autoComplete="off"
      disabled={disabled}
      inputMode="decimal"
      min="0"
      name={`line-${line.id}-unit-price`}
      onBlur={flush}
      onChange={(event) => update({ unitPrice: event.target.value })}
      step="0.0001"
      type="number"
      value={draft.unitPrice}
    />
  );
  const discountInput = (
    <Input
      aria-label={`${line.productName} discount percentage`}
      autoComplete="off"
      disabled={disabled}
      inputMode="decimal"
      max="100"
      min="0"
      name={`line-${line.id}-discount`}
      onBlur={flush}
      onChange={(event) => update({ discountPercent: event.target.value })}
      step="0.0001"
      type="number"
      value={draft.discountPercent}
    />
  );
  const billingTypeInput = (
    <Select
      aria-label={`${line.productName} billing type`}
      disabled={disabled}
      name={`line-${line.id}-billing-type`}
      onBlur={flush}
      onChange={(event) =>
        update({
          billingType: event.target.value as LineDraft["billingType"],
        })
      }
      value={draft.billingType}
    >
      <option value="ONE_TIME">One Time</option>
      <option value="RECURRING">Recurring</option>
    </Select>
  );
  const planInput =
    draft.billingType === "RECURRING" ? (
      <Select
        aria-label={`${line.productName} subscription plan`}
        disabled={disabled}
        name={`line-${line.id}-subscription-plan`}
        onBlur={flush}
        onChange={(event) => update({ subscriptionPlanId: event.target.value })}
        value={draft.subscriptionPlanId}
      >
        <option value="">Select Plan</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </Select>
    ) : null;

  if (variant === "card") {
    return (
      <article className="grid gap-sm rounded-control border border-border bg-surface p-sm">
        <div className="min-w-0">
          <strong className="block truncate text-body-sm text-foreground-strong">
            {line.productName}
          </strong>
          <span className="font-mono text-caption text-foreground-muted">
            {line.sku ?? line.productCode}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-xs">
          {quantityInput}
          {unitPriceInput}
          {discountInput}
          {billingTypeInput}
          {planInput}
        </div>
        <dl className="m-0 grid grid-cols-2 gap-xs border-t border-border pt-xs text-caption">
          <dt className="text-foreground-muted">Tax</dt>
          <dd className="m-0 text-right text-foreground-strong">
            {line.taxCode === null
              ? "No tax"
              : `${line.taxCode}, ${formatPercentage(line.taxRate, locale)}`}
          </dd>
          <dt className="text-foreground-muted">Tax Amount</dt>
          <dd className="m-0 text-right font-mono tabular-nums text-foreground-strong">
            {formatMoney(line.taxAmount, currency, locale)}
          </dd>
        </dl>
        <div className="flex items-center justify-between gap-xs">
          <span className="font-mono text-body-sm font-semibold tabular-nums text-foreground-strong">
            {formatMoney(line.total, currency, locale)}
          </span>
          <Button
            disabled={disabled}
            onClick={() => onRemove(line)}
            size="compact"
            variant="danger"
          >
            Remove Line
          </Button>
        </div>
      </article>
    );
  }

  return (
    <DataTableRow>
      <DataTableCell>
        <strong className="block max-w-48 truncate text-foreground-strong">
          {line.productName}
        </strong>
        <span className="font-mono text-caption text-foreground-muted">
          {line.sku ?? line.productCode}
        </span>
      </DataTableCell>
      <DataTableCell>{quantityInput}</DataTableCell>
      <DataTableCell>{unitPriceInput}</DataTableCell>
      <DataTableCell>{discountInput}</DataTableCell>
      <DataTableCell>
        <div className="grid min-w-32 gap-xs">
          {billingTypeInput}
          {planInput}
        </div>
      </DataTableCell>
      <DataTableCell>
        <span className="block text-foreground-strong">
          {line.taxCode ?? "No tax"}
        </span>
        <span className="block font-mono text-caption tabular-nums text-foreground-muted">
          {formatPercentage(line.taxRate, locale)} · {line.taxBehavior}
        </span>
        <span className="block font-mono text-caption tabular-nums text-foreground-muted">
          {formatMoney(line.taxAmount, currency, locale)}
        </span>
      </DataTableCell>
      <DataTableCell numeric>
        {formatMoney(line.total, currency, locale)}
      </DataTableCell>
      <DataTableCell>
        <Button
          disabled={disabled}
          onClick={() => onRemove(line)}
          size="compact"
          variant="danger"
        >
          Remove
        </Button>
      </DataTableCell>
    </DataTableRow>
  );
}

export function QuoteLineEditor({
  currency,
  disabled,
  lines,
  onPatch,
  onRemove,
  plans,
}: {
  currency: string;
  disabled: boolean;
  lines: QuoteLineDto[];
  onPatch: (lineId: string, patch: LinePatch) => Promise<void>;
  onRemove: (line: QuoteLineDto) => void;
  plans: SubscriptionPlanDto[];
}) {
  if (lines.length === 0) {
    return (
      <EmptyState
        description="Choose a product from the browser to build a mixed one-time and recurring quotation."
        headingLevel="h3"
        title="No Quotation Lines"
      />
    );
  }

  return (
    <div className="grid gap-xs">
      <p className="m-0 text-caption text-foreground-muted">
        Tax code, rate, behavior, and amount are read-only here and recalculated
        by the API from the active product tax configuration.
      </p>
      <div className="grid gap-xs md:hidden">
        {lines.map((line) => (
          <EditableLine
            currency={currency}
            disabled={disabled}
            key={`${line.id}-${line.quantity}-${line.unitPrice}-${line.discountPercent}-${line.billingType}-${line.subscriptionPlanId ?? ""}`}
            line={line}
            onPatch={onPatch}
            onRemove={onRemove}
            plans={plans}
            variant="card"
          />
        ))}
      </div>
      <DataTable
        aria-label="Editable quotation lines"
        containerClassName="hidden md:block"
      >
        <DataTableCaption visuallyHidden>
          Editable quotation lines. Changes save automatically.
        </DataTableCaption>
        <DataTableHeader>
          <DataTableRow>
            <DataTableHead>Product</DataTableHead>
            <DataTableHead>Quantity</DataTableHead>
            <DataTableHead>Unit Price</DataTableHead>
            <DataTableHead>Discount %</DataTableHead>
            <DataTableHead>Billing</DataTableHead>
            <DataTableHead>Tax</DataTableHead>
            <DataTableHead numeric>Total</DataTableHead>
            <DataTableHead>Action</DataTableHead>
          </DataTableRow>
        </DataTableHeader>
        <DataTableBody>
          {lines.map((line) => (
            <EditableLine
              currency={currency}
              disabled={disabled}
              key={`${line.id}-${line.quantity}-${line.unitPrice}-${line.discountPercent}-${line.billingType}-${line.subscriptionPlanId ?? ""}`}
              line={line}
              onPatch={onPatch}
              onRemove={onRemove}
              plans={plans}
              variant="row"
            />
          ))}
        </DataTableBody>
      </DataTable>
    </div>
  );
}

export type { LinePatch };
