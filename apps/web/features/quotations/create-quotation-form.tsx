"use client";

import {
  CreateQuoteRequestSchema,
  QuoteDtoSchema,
  apiRoutes,
  type CreateQuoteRequest,
  type CustomerAccountDto,
} from "@repo/common";
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorFeedback,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  LiveRegion,
  PageHeader,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  Select,
  Textarea,
} from "@repo/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ApiProblemError, browserApiRequest } from "../../lib/api/browser";

function problemMessage(error: unknown): string {
  if (error instanceof ApiProblemError) {
    return error.problem.detail ?? error.problem.title;
  }
  return "The quotation could not be created. Check the values and try again.";
}

export function CreateQuotationForm({
  baseCurrency,
  customers,
  initialCustomerId,
}: {
  baseCurrency: string;
  customers: CustomerAccountDto[];
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const [problem, setProblem] = useState("");
  const initialCustomer =
    customers.find((customer) => customer.id === initialCustomerId) ??
    customers[0];
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
  } = useForm<CreateQuoteRequest>({
    defaultValues: {
      currency: initialCustomer?.preferredCurrency ?? baseCurrency,
      customerAccountId: initialCustomer?.id,
      paymentTermsDays: initialCustomer?.paymentTermsDays ?? 30,
    },
    resolver: zodResolver(CreateQuoteRequestSchema),
  });

  async function create(input: CreateQuoteRequest) {
    setProblem("");
    try {
      const quote = await browserApiRequest(apiRoutes.quotes.create, {
        json: input,
        method: "POST",
        schema: QuoteDtoSchema,
        scope: "internal",
      });
      router.push(`/quotations/${quote.id}`);
      router.refresh();
    } catch (error) {
      setProblem(problemMessage(error));
    }
  }

  return (
    <div className="grid gap-lg">
      <PageHeader
        actions={
          <ButtonLink href="/quotations" variant="secondary">
            Back to Quotations
          </ButtonLink>
        }
        description="Start the commercial record with a customer, currency, payment terms, and optional expiration. Products are added next."
        title="New Quotation"
      />

      <LiveRegion message={problem} politeness="assertive" />
      {customers.length === 0 ? (
        <EmptyState
          action={
            <ButtonLink href="/settings/products" variant="secondary">
              Open Configuration
            </ButtonLink>
          }
          description="A quotation needs an active customer account. Ask an administrator to create one before continuing."
          title="No Customer Accounts"
        />
      ) : (
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Commercial Details</PanelTitle>
              <PanelDescription>
                The API creates revision 1 and becomes authoritative for all
                totals.
              </PanelDescription>
            </div>
          </PanelHeader>
          <PanelBody>
            <form
              className="grid gap-lg"
              noValidate
              onSubmit={handleSubmit(create)}
            >
              {problem ? (
                <ErrorFeedback title="Quotation Was Not Created">
                  {problem}
                </ErrorFeedback>
              ) : null}
              <FieldGroup className="md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="new-quote-customer">Customer</FieldLabel>
                  <Select
                    {...register("customerAccountId", { onChange: (event) => {
                      const customer = customers.find((item) => item.id === event.target.value);
                      if (customer) { setValue("currency", customer.preferredCurrency); setValue("paymentTermsDays", customer.paymentTermsDays); }
                    } })}
                    aria-describedby={
                      errors.customerAccountId
                        ? "new-quote-customer-error"
                        : "new-quote-customer-help"
                    }
                    aria-invalid={Boolean(errors.customerAccountId)}
                    id="new-quote-customer"
                  >
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.accountCode} - {customer.name}
                      </option>
                    ))}
                  </Select>
                  <FieldDescription id="new-quote-customer-help">
                    Customer tier and credit exposure influence approval
                    routing.
                  </FieldDescription>
                  {errors.customerAccountId ? (
                    <FieldError id="new-quote-customer-error">
                      {errors.customerAccountId.message}
                    </FieldError>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-quote-currency">Currency</FieldLabel>
                  <Input
                    {...register("currency")}
                    aria-describedby={
                      errors.currency
                        ? "new-quote-currency-error"
                        : "new-quote-currency-help"
                    }
                    aria-invalid={Boolean(errors.currency)}
                    autoComplete="off"
                    id="new-quote-currency"
                    inputMode="text"
                    maxLength={3}
                    spellCheck={false}
                  />
                  <FieldDescription id="new-quote-currency-help">
                    Enter a 3-letter ISO currency code such as USD.
                  </FieldDescription>
                  {errors.currency ? (
                    <FieldError id="new-quote-currency-error">
                      {errors.currency.message}
                    </FieldError>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-quote-terms">
                    Payment Terms in Days
                  </FieldLabel>
                  <Input
                    {...register("paymentTermsDays", { valueAsNumber: true })}
                    aria-describedby={
                      errors.paymentTermsDays
                        ? "new-quote-terms-error"
                        : "new-quote-terms-help"
                    }
                    aria-invalid={Boolean(errors.paymentTermsDays)}
                    autoComplete="off"
                    id="new-quote-terms"
                    inputMode="numeric"
                    max={365}
                    min={0}
                    type="number"
                  />
                  <FieldDescription id="new-quote-terms-help">
                    Use 0 for payment due immediately.
                  </FieldDescription>
                  {errors.paymentTermsDays ? (
                    <FieldError id="new-quote-terms-error">
                      {errors.paymentTermsDays.message}
                    </FieldError>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-quote-expires">
                    Expires At
                  </FieldLabel>
                  <Input
                    {...register("expiresAt", {
                      setValueAs(value: unknown) {
                        return typeof value === "string" && value
                          ? new Date(value).toISOString()
                          : undefined;
                      },
                    })}
                    aria-describedby={
                      errors.expiresAt ? "new-quote-expires-error" : undefined
                    }
                    aria-invalid={Boolean(errors.expiresAt)}
                    autoComplete="off"
                    id="new-quote-expires"
                    type="datetime-local"
                  />
                  {errors.expiresAt ? (
                    <FieldError id="new-quote-expires-error">
                      {errors.expiresAt.message}
                    </FieldError>
                  ) : null}
                </Field>
              </FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-quote-notes">
                  Internal Notes
                </FieldLabel>
                <Textarea
                  {...register("notes")}
                  aria-describedby={
                    errors.notes
                      ? "new-quote-notes-error"
                      : "new-quote-notes-help"
                  }
                  aria-invalid={Boolean(errors.notes)}
                  autoComplete="off"
                  id="new-quote-notes"
                  placeholder="Add commercial context for reviewers…"
                />
                <FieldDescription id="new-quote-notes-help">
                  Internal notes are not included in the customer portal
                  response.
                </FieldDescription>
                {errors.notes ? (
                  <FieldError id="new-quote-notes-error">
                    {errors.notes.message}
                  </FieldError>
                ) : null}
              </Field>
              <div className="flex flex-wrap justify-end gap-xs border-t border-border pt-md">
                <ButtonLink href="/quotations" variant="quiet">
                  Cancel
                </ButtonLink>
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Creating Quotation…" : "Create Quotation"}
                </Button>
              </div>
            </form>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}
