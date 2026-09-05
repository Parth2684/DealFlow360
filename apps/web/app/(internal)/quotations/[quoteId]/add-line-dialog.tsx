"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { catalogApi, quotesApi, type AddQuoteLineInput } from "@/lib/api/resources";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { BILLING_TYPES } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";

interface FormValues {
  productId: string;
  variantId: string;
  quantity: string;
  discountPercent: string;
  billingType: "ONE_TIME" | "RECURRING";
  subscriptionPlanId: string;
}

export function AddLineDialog({ quoteId }: { quoteId: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { quantity: "1", discountPercent: "0", billingType: "ONE_TIME" },
  });

  const { data: products } = useQuery({ queryKey: ["catalog-products"], queryFn: catalogApi.products, enabled: open });
  const { data: plans } = useQuery({
    queryKey: ["catalog-subscription-plans"],
    queryFn: catalogApi.subscriptionPlans,
    enabled: open,
  });

  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() is a stable escape hatch, not a memoization hazard here.
  const productId = watch("productId");
  const billingType = watch("billingType");
  const selectedProduct = products?.find((p) => p.id === productId);

  const mutation = useMutation({
    mutationFn: (input: AddQuoteLineInput) => quotesApi.addLine(quoteId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      notify({ title: "Line added", variant: "success" });
      reset();
      setOpen(false);
    },
    onError: (error) => {
      notify({
        title: "Could not add line",
        description: error instanceof ApiError ? error.message : undefined,
        variant: "error",
      });
    },
  });

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} /> Add line
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Add quote line" width="md">
        <form
          onSubmit={handleSubmit((values) =>
            mutation.mutate({
              productId: values.productId,
              variantId: values.variantId || undefined,
              quantity: values.quantity,
              discountPercent: values.discountPercent,
              billingType: values.billingType,
              subscriptionPlanId: values.billingType === "RECURRING" ? values.subscriptionPlanId || undefined : undefined,
            }),
          )}
          className="space-y-4"
        >
          <Field label="Product" htmlFor="productId" required error={errors.productId?.message}>
            <Select id="productId" {...register("productId", { required: "Select a product" })}>
              <option value="">Select a product</option>
              {products?.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.code})
                </option>
              ))}
            </Select>
          </Field>
          {selectedProduct?.variants && selectedProduct.variants.length > 0 ? (
            <Field label="Variant" htmlFor="variantId" helper="Optional">
              <Select id="variantId" {...register("variantId")}>
                <option value="">No variant</option>
                {selectedProduct.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name ?? variant.sku}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity" htmlFor="quantity" required error={errors.quantity?.message}>
              <Input id="quantity" type="number" min={0} step="any" {...register("quantity", { required: "Required" })} />
            </Field>
            <Field label="Discount %" htmlFor="discountPercent">
              <Input id="discountPercent" type="number" min={0} max={100} step="any" {...register("discountPercent")} />
            </Field>
          </div>
          <Field label="Billing type" htmlFor="billingType">
            <Select id="billingType" {...register("billingType")}>
              {BILLING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          {billingType === "RECURRING" ? (
            <Field label="Subscription plan" htmlFor="subscriptionPlanId">
              <Select id="subscriptionPlanId" {...register("subscriptionPlanId")}>
                <option value="">Select a plan</option>
                {plans?.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Add line
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
