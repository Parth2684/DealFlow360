"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  apiRoutes,
  CustomerAccessDtoSchema,
  CustomerAccessDecisionSchema,
  createCursorPageSchema,
  type CustomerAccountDto,
  type CustomerTierDto,
} from "@repo/common";
import {
  Badge,
  Button,
  Field,
  FieldLabel,
  Select,
  Textarea,
  Input,
  PageHeader,
  Panel,
  PanelBody,
  ErrorFeedback,
  InlineFeedback,
} from "@repo/ui";
import { browserApiRequest } from "../../lib/api/browser";
import type { z } from "zod";
type AccessRequest = z.infer<typeof CustomerAccessDtoSchema>;
export function CustomerRequestsWorkspace({
  customers,
  tiers,
  organizationSlug,
}: {
  customers: CustomerAccountDto[];
  tiers: CustomerTierDto[];
  organizationSlug: string;
}) {
  const [status, setStatus] = useState("PENDING");
  const [cursors, setCursors] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["customer-requests", status, cursors.at(-1)],
    refetchInterval: 15000,
    queryFn: ({ signal }) =>
      browserApiRequest(
        apiRoutes.customerAccess.list +
          "?limit=25&status=" +
          status +
          (cursors.at(-1) ? "&cursor=" + cursors.at(-1) : ""),
        { schema: createCursorPageSchema(CustomerAccessDtoSchema), signal },
      ),
  });
  async function mutate(row: AccessRequest, body: unknown, retry = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await browserApiRequest(
        retry
          ? apiRoutes.customerAccess.retryEmail(row.id)
          : apiRoutes.customerAccess.decision(row.id),
        {
          method: "POST",
          json: retry
            ? { revision: row.revision }
            : CustomerAccessDecisionSchema.parse(body),
          schema: CustomerAccessDtoSchema,
        },
      );
      setMessage(
        result.emailStatus === "SENT"
          ? result.status === "APPROVED"
            ? "Account approved. Credentials were sent by email."
            : "Request declined. The customer was notified by email."
          : "Decision saved, but email could not be sent. Check SMTP settings and use Retry Email in the reviewed tab.",
      );
      await query.refetch();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The request could not be updated",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-lg">
      <PageHeader
        title="Customer Account Requests"
        description="Review new customer access requests and send the customer your decision."
      />
      <Panel>
        <PanelBody>
          <Field>
            <FieldLabel htmlFor="registration-link">
              Customer Registration Link
            </FieldLabel>
            <Input
              id="registration-link"
              value={"/portal/request-access?organization=" + organizationSlug}
              readOnly
            />
          </Field>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  window.location.origin +
                    "/portal/request-access?organization=" +
                    encodeURIComponent(organizationSlug),
                );
                setMessage("Registration link copied.");
              } catch {
                setError(
                  "Could not copy. Use the registration path above with this website's address.",
                );
              }
            }}
          >
            Copy Registration Link
          </Button>
        </PanelBody>
      </Panel>
      {error || query.isError ? (
        <ErrorFeedback title="Request needs attention">
          {error || query.error?.message}
        </ErrorFeedback>
      ) : null}
      {message ? <InlineFeedback>{message}</InlineFeedback> : null}
      <Field>
        <FieldLabel htmlFor="request-status">Show Requests</FieldLabel>
        <Select
          id="request-status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setCursors([]);
          }}
        >
          <option value="PENDING">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="DECLINED">Declined</option>
        </Select>
      </Field>
      {query.isPending ? <p>Loading requests…</p> : null}
      {query.data?.items.length === 0 ? (
        <p>No requests in this category.</p>
      ) : null}
      {query.data?.items.map((row) => (
        <Panel key={row.id}>
          <PanelBody>
            <div className="grid gap-md">
              <div>
                <h2 className="text-heading-sm">
                  {row.firstName} {row.lastName}
                </h2>
                <p>
                  {row.email} · {row.companyName}
                </p>
                <Badge>{row.status}</Badge>{" "}
                <Badge>
                  Email:{" "}
                  {row.emailStatus === "NONE"
                    ? "Awaiting decision"
                    : row.emailStatus}
                </Badge>
              </div>
              {row.message ? <p>Customer message: {row.message}</p> : null}
              {row.status === "PENDING" ? (
                <form
                  className="grid gap-md"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const decision = (
                      event.nativeEvent as SubmitEvent
                    ).submitter?.getAttribute("value");
                    void mutate(row, {
                      revision: row.revision,
                      decision,
                      customerAccountId:
                        data.get("customerAccountId") || undefined,
                      tierId: data.get("tierId") || undefined,
                      reason: data.get("reason") || "",
                    });
                  }}
                >
                  <Field>
                    <FieldLabel htmlFor={row.id + "-customer"}>
                      Customer Account
                    </FieldLabel>
                    <Select id={row.id + "-customer"} name="customerAccountId">
                      <option value="">
                        Create a new account for {row.companyName}
                      </option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} ({customer.accountCode})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={row.id + "-tier"}>
                      Tier for a New Customer Account
                    </FieldLabel>
                    <Select id={row.id + "-tier"} name="tierId">
                      <option value="">
                        Choose a tier if creating a new account
                      </option>
                      {tiers.map((tier) => (
                        <option key={tier.id} value={tier.id}>
                          {tier.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={row.id + "-reason"}>
                      Reason (Required When Declining)
                    </FieldLabel>
                    <Textarea
                      id={row.id + "-reason"}
                      name="reason"
                      maxLength={1000}
                    />
                  </Field>
                  <div className="flex gap-sm">
                    <Button
                      type="submit"
                      name="decision"
                      value="APPROVE"
                      disabled={busy}
                    >
                      Approve &amp; Email Credentials
                    </Button>
                    <Button
                      type="submit"
                      name="decision"
                      value="DECLINE"
                      variant="secondary"
                      disabled={busy}
                    >
                      Decline &amp; Email Customer
                    </Button>
                  </div>
                </form>
              ) : (
                <div>
                  {row.reason ? <p>Decision reason: {row.reason}</p> : null}
                  {row.emailStatus !== "SENT" ? (
                    <>
                      <p>
                        {row.emailStatus === "PENDING"
                          ? "Email is being sent. If a previous attempt was interrupted, retry becomes available after two minutes."
                          : "The email failed. Customer sign-in remains disabled until the credentials email is sent."}
                      </p>
                      <Button
                        disabled={busy}
                        onClick={() => void mutate(row, {}, true)}
                      >
                        Retry Email
                      </Button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </PanelBody>
        </Panel>
      ))}
      <div className="flex gap-sm">
        <Button
          variant="secondary"
          disabled={!cursors.length}
          onClick={() => setCursors((c) => c.slice(0, -1))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={!query.data?.pageInfo.hasNextPage}
          onClick={() => {
            const next = query.data?.pageInfo.nextCursor;
            if (next) setCursors((c) => [...c, next]);
          }}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
