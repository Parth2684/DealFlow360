"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { catalogApi, quotesApi } from "@/lib/api/resources";
import { ApiError } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { CURRENCIES } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";

interface FormValues {
  customerAccountId: string;
  currency: string;
  paymentTermsDays: number;
  expiresAt: string;
}

export default function NewQuotationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { currency: "USD", paymentTermsDays: 30, expiresAt: "" },
  });

  const { data: customers, isLoading: loadingCustomers } = useQuery({
    queryKey: ["catalog-customers"],
    queryFn: catalogApi.customers,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      quotesApi.create({
        customerAccountId: values.customerAccountId,
        currency: values.currency,
        paymentTermsDays: Number(values.paymentTermsDays),
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
      }),
    onSuccess: async (quote) => {
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      notify({ title: "Quotation created", variant: "success" });
      router.push(`/quotations/${quote.id}`);
    },
    onError: (error) => {
      notify({
        title: "Could not create quotation",
        description: error instanceof ApiError ? error.message : undefined,
        variant: "error",
      });
    },
  });

  return (
    <div className="max-w-xl">
      <PageHeader title="New quotation" description="Pick the customer this deal is for. You'll add products next." />
      <Card className="p-6">
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <Field label="Customer" htmlFor="customerAccountId" required error={errors.customerAccountId?.message}>
            <Select id="customerAccountId" {...register("customerAccountId", { required: "Select a customer" })}>
              <option value="">{loadingCustomers ? "Loading customers…" : "Select a customer"}</option>
              {customers?.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Currency" htmlFor="currency">
              <Select id="currency" {...register("currency")}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Payment terms (days)" htmlFor="paymentTermsDays">
              <Input id="paymentTermsDays" type="number" min={0} {...register("paymentTermsDays", { valueAsNumber: true })} />
            </Field>
          </div>
          <Field label="Expires on" htmlFor="expiresAt" helper="Optional">
            <Input id="expiresAt" type="date" {...register("expiresAt")} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Create quotation
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
