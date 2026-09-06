import { ApprovalPolicyDtoSchema, planApiRoutes } from "@repo/common";
import type { Metadata } from "next";

import { ConfigurationWorkspace } from "../../../../features/configuration/configuration-workspace";
import {
  firstSearchValue,
  loadConfigurationItems,
  requireConfigurationAccess,
} from "../../../../features/configuration/server";

export const metadata: Metadata = { title: "Approval Chain Configuration" };

export default async function ApprovalChainSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireConfigurationAccess("/settings/approval-chains");
  const parameters = await searchParams;
  const items = await loadConfigurationItems(
    planApiRoutes.configuration.approvalPolicies,
    ApprovalPolicyDtoSchema,
  );

  return (
    <ConfigurationWorkspace
      canManage
      items={items}
      kind="approval-chains"
      search={firstSearchValue(parameters.search)}
      timeZone={session.organization.timezone}
    />
  );
}
