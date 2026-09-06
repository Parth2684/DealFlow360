import { ProductDtoSchema, WarehouseDtoSchema, apiRoutes } from "@repo/common";
import { InventoryWorkspace } from "../../../features/fulfillment/inventory-workspace";
import { requireAccess } from "../../../features/shared/require-access";
import { loadConfigurationItems } from "../../../features/configuration/server";
export const metadata = { title: "Inventory" };
export default async function Page() {
  const session = await requireAccess("inventory.read");
  const [warehouses, products] = await Promise.all([
    loadConfigurationItems(apiRoutes.inventory.warehouses, WarehouseDtoSchema),
    loadConfigurationItems(apiRoutes.catalog.products, ProductDtoSchema),
  ]);
  return (
    <InventoryWorkspace
      warehouses={warehouses.filter((item) => item.status === "ACTIVE")}
      products={products.filter(
        (item) => item.status === "ACTIVE" && item.type === "HARDWARE",
      )}
      canAdjust={session.user.capabilities.includes("inventory.adjust")}
    />
  );
}
