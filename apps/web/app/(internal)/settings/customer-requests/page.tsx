import {
  CustomerAccountDtoSchema,
  CustomerTierDtoSchema,
  apiRoutes,
} from "@repo/common";
import { requireAccess } from "../../../../features/shared/require-access";
import { loadConfigurationItems } from "../../../../features/configuration/server";
import { CustomerRequestsWorkspace } from "../../../../features/configuration/customer-requests-workspace";
export const metadata = { title: "Customer Account Requests" };
export default async function Page() {
  const session = await requireAccess("configuration.manage");
  const [customers, tiers] = await Promise.all([
    loadConfigurationItems(
      apiRoutes.customers.accounts,
      CustomerAccountDtoSchema,
    ),
    loadConfigurationItems(apiRoutes.customers.tiers, CustomerTierDtoSchema),
  ]);
  return (
    <CustomerRequestsWorkspace
      organizationSlug={session.organization.slug}
      customers={customers.filter((x) => x.status === "ACTIVE")}
      tiers={tiers.filter((x) => x.status === "ACTIVE")}
    />
  );
}
