import {
  QuoteSummaryDtoSchema,
  apiRoutes,
  createCursorPageSchema,
  formatEnumLabel,
  formatMoney,
} from "@repo/common";
import {
  Badge,
  ButtonLink,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from "@repo/ui";
import { getInternalSessionState } from "../../../lib/auth/session";
import { serverApiRequest } from "../../../lib/api/server";
import { navigationForCapabilities } from "../../../lib/navigation";
export const metadata = { title: "Workspace" };
export default async function Page() {
  const state = await getInternalSessionState();
  if (state.status !== "authenticated") return null;
  const { session } = state;
  const groups = navigationForCapabilities(session.user.capabilities);
  const quotes = session.user.capabilities.includes("quotation.read")
    ? await serverApiRequest(
        `${apiRoutes.quotes.list}?limit=5&sort=updatedAt&direction=desc`,
        createCursorPageSchema(QuoteSummaryDtoSchema),
      )
    : null;
  return (
    <div className="grid gap-lg">
      <PageHeader
        title={`Welcome, ${session.user.firstName}`}
        description={`${session.organization.name} · Follow your deals from quotation to delivery and payment.`}
        actions={
          session.user.capabilities.includes("quotation.create") ? (
            <ButtonLink href="/quotations/new">New Quotation</ButtonLink>
          ) : undefined
        }
      />
      <div className="grid gap-md lg:grid-cols-2">
        {groups.map((group) => (
          <Panel key={group.label}>
            <PanelHeader>
              <PanelTitle>{group.label}</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <div className="flex flex-wrap gap-sm">
                {group.items
                  .filter((item) => item.href !== "/workspace")
                  .map((item) => (
                    <ButtonLink
                      key={item.href}
                      href={item.href}
                      variant="secondary"
                    >
                      {item.label}
                    </ButtonLink>
                  ))}
              </div>
            </PanelBody>
          </Panel>
        ))}
      </div>
      {quotes ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>Recently Updated Quotations</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <div className="grid gap-sm">
              {quotes.items.length ? (
                quotes.items.map((quote) => (
                  <article
                    key={quote.id}
                    className="flex flex-wrap items-center justify-between gap-sm border-b border-border py-sm"
                  >
                    <div>
                      <ButtonLink
                        href={`/quotations/${quote.id}`}
                        variant="quiet"
                      >
                        {quote.quoteNumber}
                      </ButtonLink>
                      <p className="m-0 text-body-sm">{quote.customerName}</p>
                    </div>
                    <div className="flex gap-sm">
                      <span>
                        {formatMoney(
                          quote.total,
                          quote.currency,
                          session.organization.locale,
                        )}
                      </span>
                      <Badge>{formatEnumLabel(quote.stage)}</Badge>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  title="Start your first quotation"
                  description="Add a customer and products, then prepare a quotation for review."
                />
              )}
            </div>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
