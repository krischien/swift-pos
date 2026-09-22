import test from "node:test";
import assert from "node:assert/strict";
import { computeCylinderDeposit, cartHasOutstandingCylinder } from "../src/lib/cylinderCheckout";
import { isInactiveSuki, rankReliableCustomers, rankSukiCandidates } from "../src/lib/customerInsights";
import type { CustomerDetail, Product } from "../src/types/pos";

const product: Product = {
  id: "p1",
  name: "11kg LPG",
  categoryId: "c1",
  itemCode: "LPG-11",
  hasVariants: false,
  price: 900,
  stock: 10,
  lowStockThreshold: 2,
  status: "active",
  tracksCylinder: true,
  depositAmount: 500,
};

const customer = (
  id: string,
  frequency180d: number,
  monetary180d: number,
  lastPurchaseAt: string | null,
  overrides: Partial<CustomerDetail["evidence"]> = {},
): CustomerDetail => ({
  id,
  storeId: "store",
  name: id,
  normalizedName: id,
  qrToken: `token-${id}`,
  isSuki: false,
  archived: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  evidence: {
    lastPurchaseAt,
    frequency180d,
    monetary180d,
    completedOutcomes: 0,
    reliableQualification: false,
    returnRate: null,
    avgReturnDays: null,
    openQuantity: 0,
    ...overrides,
  },
});

test("deposit applies only to canisters not covered by an empty exchange", () => {
  const cart = [{
    id: "line",
    productId: "p1",
    name: product.name,
    price: 900,
    quantity: 3,
    subtotal: 2700,
    broughtEmptyQuantity: 2,
  }];
  assert.equal(computeCylinderDeposit(cart, [product], { enabled: true, collectDeposits: true }), 500);
  assert.equal(cartHasOutstandingCylinder(cart, [product], true), true);
  assert.equal(
    cartHasOutstandingCylinder([{ ...cart[0], broughtEmptyQuantity: 3 }], [product], true),
    false,
  );
});

test("Suki candidates are ranked with store-relative RFM evidence", () => {
  const now = Date.now();
  const rows = rankSukiCandidates([
    customer("frequent", 12, 12_000, new Date(now - 2 * 86_400_000).toISOString()),
    customer("middle", 6, 6_000, new Date(now - 30 * 86_400_000).toISOString()),
    customer("old", 1, 500, new Date(now - 120 * 86_400_000).toISOString()),
  ]);
  assert.equal(rows[0].id, "frequent");
  assert.equal(rows[0].insightScore, 9);
  assert.ok(rows[0].insightScore > rows[2].insightScore);
});

test("reliable ranking requires three completed outcomes and favors returns", () => {
  const rows = rankReliableCustomers([
    customer("insufficient", 10, 10_000, new Date().toISOString(), {
      completedOutcomes: 2,
      returnRate: 1,
      avgReturnDays: 1,
    }),
    customer("reliable", 5, 5_000, new Date().toISOString(), {
      completedOutcomes: 4,
      reliableQualification: true,
      returnRate: 1,
      avgReturnDays: 5,
    }),
    customer("losses", 8, 8_000, new Date().toISOString(), {
      completedOutcomes: 5,
      reliableQualification: true,
      returnRate: 0.6,
      avgReturnDays: 3,
      writeoffs: 2,
    }),
  ]);
  assert.deepEqual(rows.map((row) => row.id), ["reliable", "losses"]);
});

test("manual Suki status is flagged inactive after 90 days without purchase", () => {
  const now = Date.now();
  const active = {
    ...customer("active", 3, 3_000, new Date(now - 89 * 86_400_000).toISOString()),
    isSuki: true,
  };
  const inactive = {
    ...customer("inactive", 3, 3_000, new Date(now - 90 * 86_400_000).toISOString()),
    isSuki: true,
  };
  assert.equal(isInactiveSuki(active, now), false);
  assert.equal(isInactiveSuki(inactive, now), true);
});

