"use client";
import {
  InventoryAdjustmentRequestSchema,
  InventoryAdjustmentResultDtoSchema,
  InventoryBalanceDtoSchema,
  SetIncomingStockRequestSchema,
  StockReceiptRequestSchema,
  StockReceiptResultDtoSchema,
  apiRoutes,
  createCursorPageSchema,
  planApiRoutes,
  type ProductDto,
  type WarehouseDto,
} from "@repo/common";
import {
  Button,
  EmptyState,
  ErrorFeedback,
  Field,
  FieldLabel,
  Input,
  PageHeader,
  Panel,
  PanelBody,
  Select,
} from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { browserApiRequest } from "../../lib/api/browser";
import { useIdempotencyKey } from "../shared/use-idempotency-key";

export function InventoryWorkspace({
  warehouses,
  products,
  canAdjust,
}: {
  warehouses: WarehouseDto[];
  products: ProductDto[];
  canAdjust: boolean;
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [operation, setOperation] = useState("receipt");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const key = useIdempotencyKey();
  const query = useQuery({
    enabled: !!warehouseId,
    queryKey: ["inventory", warehouseId, cursors.at(-1)],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ limit: "25" });
      if (cursors.at(-1)) params.set("cursor", cursors.at(-1)!);
      return browserApiRequest(
        `${apiRoutes.inventory.balances(warehouseId)}?${params}`,
        { schema: createCursorPageSchema(InventoryBalanceDtoSchema), signal },
      );
    },
  });
  const product = products.find((item) => item.id === productId);
  return (
    <div className="grid gap-lg">
      <PageHeader
        title="Inventory"
        description="Review available stock, receive deliveries, and record stock corrections."
      />
      <Field>
        <FieldLabel htmlFor="stock-warehouse">Warehouse</FieldLabel>
        <Select
          id="stock-warehouse"
          value={warehouseId}
          onChange={(event) => {
            setWarehouseId(event.target.value);
            setCursors([]);
          }}
        >
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </Select>
      </Field>
      {error || query.isError ? (
        <ErrorFeedback title="Inventory needs attention">
          {error || query.error?.message}
        </ErrorFeedback>
      ) : null}
      <Panel>
        <PanelBody>
          <div className="grid gap-sm">
            {query.data?.items.length ? (
              query.data.items.map((balance) => (
                <article
                  key={balance.id}
                  className="border-b border-border py-sm"
                >
                  <strong>
                    {balance.productName}
                    {balance.sku ? ` · ${balance.sku}` : ""}
                  </strong>
                  <p>
                    On hand: {balance.onHand} · Reserved: {balance.reserved} ·
                    Available: {balance.available} · Incoming:{" "}
                    {balance.incoming}
                  </p>
                </article>
              ))
            ) : (
              <EmptyState
                title={
                  query.isPending && warehouseId
                    ? "Loading stock…"
                    : "No stock balances"
                }
                description="Receive a delivery to add stock to this warehouse."
              />
            )}
          </div>
        </PanelBody>
      </Panel>
      <div className="flex justify-between">
        <Button
          variant="secondary"
          disabled={!cursors.length}
          onClick={() => setCursors((items) => items.slice(0, -1))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={!query.data?.pageInfo.hasNextPage}
          onClick={() => {
            const next = query.data?.pageInfo.nextCursor;
            if (next) setCursors((items) => [...items, next]);
          }}
        >
          Next
        </Button>
      </div>
      {canAdjust && warehouseId && products.length ? (
        <Panel>
          <PanelBody>
            <form
              className="grid gap-sm"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                setBusy(true);
                setError("");
                try {
                  const variantId =
                    String(form.get("variant") ?? "") || undefined;
                  const quantity = String(form.get("quantity") ?? "");
                  const reason = String(form.get("reason") ?? "").trim();
                  if (operation === "receipt") {
                    const body = StockReceiptRequestSchema.parse({
                      warehouseId,
                      items: [{ productId, variantId, quantity }],
                      reference: reason,
                    });
                    await browserApiRequest(apiRoutes.inventory.receipt, {
                      method: "POST",
                      json: body,
                      headers: key.headersFor(body),
                      schema: StockReceiptResultDtoSchema,
                    });
                  } else if (operation === "adjust") {
                    const body = InventoryAdjustmentRequestSchema.parse({
                      productId,
                      variantId,
                      quantity,
                      reason,
                    });
                    await browserApiRequest(
                      apiRoutes.inventory.adjust(warehouseId),
                      {
                        method: "POST",
                        json: body,
                        headers: key.headersFor({ warehouseId, ...body }),
                        schema: InventoryAdjustmentResultDtoSchema,
                      },
                    );
                  } else {
                    const body = SetIncomingStockRequestSchema.parse({
                      productId,
                      variantId,
                      incomingQuantity: quantity,
                      reason,
                      expectedAt:
                        quantity === "0"
                          ? null
                          : new Date(String(form.get("arrival"))).toISOString(),
                    });
                    await browserApiRequest(
                      planApiRoutes.inventory.incoming(warehouseId),
                      {
                        method: "PUT",
                        json: body,
                        headers: key.headersFor({ warehouseId, ...body }),
                        schema: InventoryBalanceDtoSchema,
                      },
                    );
                  }
                  key.clear();
                  await query.refetch();
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Unable to update stock",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field>
                <FieldLabel htmlFor="stock-operation">Action</FieldLabel>
                <Select
                  id="stock-operation"
                  value={operation}
                  onChange={(event) => setOperation(event.target.value)}
                >
                  <option value="receipt">Receive a delivery</option>
                  <option value="adjust">Correct stock count</option>
                  <option value="incoming">Set expected incoming stock</option>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="stock-product">Product</FieldLabel>
                <Select
                  id="stock-product"
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                >
                  {products.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="stock-variant">Variant</FieldLabel>
                <Select
                  key={productId}
                  id="stock-variant"
                  name="variant"
                  defaultValue={product?.variants[0]?.id ?? ""}
                >
                  <option value="">Base product</option>
                  {product?.variants
                    .filter((variant) => variant.status === "ACTIVE")
                    .map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name} · {variant.sku}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="stock-quantity">
                  {operation === "adjust"
                    ? "Quantity change (negative to reduce)"
                    : "Quantity"}
                </FieldLabel>
                <Input
                  id="stock-quantity"
                  name="quantity"
                  type="number"
                  step="0.0001"
                  min={
                    operation === "adjust"
                      ? undefined
                      : operation === "incoming"
                        ? "0"
                        : "0.0001"
                  }
                  required
                />
              </Field>
              {operation === "incoming" ? (
                <Field>
                  <FieldLabel htmlFor="stock-arrival">
                    Expected arrival
                  </FieldLabel>
                  <Input
                    id="stock-arrival"
                    name="arrival"
                    type="datetime-local"
                  />
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="stock-reason">
                  {operation === "receipt" ? "Delivery reference" : "Reason"}
                </FieldLabel>
                <Input
                  id="stock-reason"
                  name="reason"
                  maxLength={120}
                  required
                />
              </Field>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save Stock Movement"}
              </Button>
            </form>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
