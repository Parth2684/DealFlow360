import { WarehouseDtoSchema, apiRoutes } from "@repo/common";
import type { Metadata } from "next";

import { ConfigurationWorkspace } from "../../../../features/configuration/configuration-workspace";
import {
  firstSearchValue,
  loadConfigurationItems,
  requireConfigurationAccess,
} from "../../../../features/configuration/server";

export const metadata: Metadata = { title: "Warehouse Configuration" };

export default async function WarehouseSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireConfigurationAccess("/settings/warehouses");
  const parameters = await searchParams;
  const items = await loadConfigurationItems(
    apiRoutes.inventory.warehouses,
    WarehouseDtoSchema,
  );

  return (
    <ConfigurationWorkspace
      canManage
      items={items}
      kind="warehouses"
      search={firstSearchValue(parameters.search)}
    />
  );
}
