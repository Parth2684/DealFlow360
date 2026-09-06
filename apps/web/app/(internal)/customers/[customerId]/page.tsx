import {
  CustomerAccountDtoSchema,
  CustomerContactDtoSchema,
  IdSchema,
  apiRoutes,
  formatMoney,
} from "@repo/common";
import { ButtonLink, EmptyState, PageHeader, Panel, PanelBody } from "@repo/ui";
import { notFound } from "next/navigation";
import { requireAccess } from "../../../../features/shared/require-access";
import { loadConfigurationItems } from "../../../../features/configuration/server";
import { ServerApiError, serverApiRequest } from "../../../../lib/api/server";

export const metadata = { title: "Customer Details" };
export default async function Page({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const session = await requireAccess("customer.read");
  const { customerId } = await params;
  if (!IdSchema.safeParse(customerId).success) notFound();
  const customer = await serverApiRequest(
    apiRoutes.customers.account(customerId),
    CustomerAccountDtoSchema,
  ).catch((error: unknown) => {
    if (error instanceof ServerApiError && error.problem.status === 404)
      notFound();
    throw error;
  });
  const contacts = await loadConfigurationItems(
    apiRoutes.customers.contacts(customerId),
    CustomerContactDtoSchema,
  );
  return (
    <div className="grid gap-lg">
      <PageHeader
        title={customer.name}
        description={customer.accountCode}
        actions={
          <ButtonLink href="/customers" variant="secondary">
            All Customers
          </ButtonLink>
        }
      />
      <div className="flex flex-wrap gap-sm">
        {session.user.capabilities.includes("quotation.create") ? (
          <ButtonLink href={`/quotations/new?customerId=${customer.id}`}>
            Create Quotation
          </ButtonLink>
        ) : null}
        {session.user.capabilities.includes("customer.manage") ? (
          <ButtonLink
            href={`/settings/customers?view=contacts&customerId=${customer.id}`}
            variant="secondary"
          >
            Manage Contacts
          </ButtonLink>
        ) : null}
      </div>
      <Panel>
        <PanelBody>
          <div className="grid gap-sm">
            <p>Payment terms: {customer.paymentTermsDays} days</p>
            <p>
              Credit limit:{" "}
              {formatMoney(
                customer.creditLimit,
                customer.preferredCurrency,
                session.organization.locale,
              )}
            </p>
            <p>
              Overdue balance:{" "}
              {formatMoney(
                customer.overdueBalance,
                customer.preferredCurrency,
                session.organization.locale,
              )}
            </p>
          </div>
        </PanelBody>
      </Panel>
      <Panel>
        <PanelBody>
          <h2>Contacts</h2>
          {contacts.length ? (
            contacts.map((contact) => (
              <article
                className="border-b border-border py-sm"
                key={contact.id}
              >
                <strong>
                  {contact.firstName} {contact.lastName}
                </strong>
                <p>{contact.email}</p>
                <p>
                  {contact.portalEnabled
                    ? "Customer portal enabled"
                    : "Contact your account manager to enable portal access"}
                </p>
              </article>
            ))
          ) : (
            <EmptyState
              title="No contacts yet"
              description="Add a contact to enable customer portal access."
            />
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
