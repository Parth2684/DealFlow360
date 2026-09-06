import { describe, expect, test } from "bun:test";
import {
  PositiveDecimalStringSchema,
  PercentageStringSchema,
  InventoryAdjustmentRequestSchema,
  SetIncomingStockRequestSchema,
  CreateRecommendationRuleRequestSchema,
} from "@repo/common";

describe("numeric form validation", () => {
  test("incomplete and malformed numbers produce validation errors without throwing", () => {
    for (const value of ["", " ", ".", "1.", "NaN", "1e3", "1.12345", "-2"]) {
      expect(PositiveDecimalStringSchema.safeParse(value).success).toBe(false);
      expect(PercentageStringSchema.safeParse(value).success).toBe(false);
      expect(
        InventoryAdjustmentRequestSchema.safeParse({
          productId: "00000000-0000-4000-8000-000000000001",
          quantity: value === "-2" ? "" : value,
          reason: "Stock count",
        }).success,
      ).toBe(false);
      expect(
        SetIncomingStockRequestSchema.safeParse({
          productId: "00000000-0000-4000-8000-000000000001",
          incomingQuantity: value,
          reason: "Purchase order",
        }).success,
      ).toBe(false);
      expect(
        CreateRecommendationRuleRequestSchema.safeParse({
          code: "DEFAULT",
          name: "Default",
          affinityWeight: value,
          effectiveFrom: "2026-09-01T00:00:00Z",
        }).success,
      ).toBe(false);
    }
  });
  test("valid numeric boundaries remain enforced", () => {
    expect(PositiveDecimalStringSchema.safeParse("0").success).toBe(false);
    expect(PositiveDecimalStringSchema.safeParse("0.0001").success).toBe(true);
    expect(PercentageStringSchema.safeParse("0").success).toBe(true);
    expect(PercentageStringSchema.safeParse("100").success).toBe(true);
    expect(PercentageStringSchema.safeParse("100.0001").success).toBe(false);
  });
});
