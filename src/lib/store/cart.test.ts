import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "@/lib/store/cart";
import type { CartBenefit } from "@/lib/store/cart";

const benefit: CartBenefit = {
  id: "b1",
  name: "Test Benefit",
  price_points: 1000,
  stock_limit: null,
};

const limitedBenefit: CartBenefit = {
  id: "b2",
  name: "Limited Benefit",
  price_points: 500,
  stock_limit: 3,
};

describe("cart store", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  it("adds item to cart", () => {
    useCartStore.getState().addItem(benefit);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it("increments quantity on duplicate add", () => {
    useCartStore.getState().addItem(benefit);
    useCartStore.getState().addItem(benefit);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(2);
  });

  it("removes item", () => {
    useCartStore.getState().addItem(benefit);
    useCartStore.getState().removeItem("b1");
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("updates quantity", () => {
    useCartStore.getState().addItem(benefit);
    useCartStore.getState().updateQuantity("b1", 5);
    expect(useCartStore.getState().items[0].quantity).toBe(5);
  });

  it("removes item when quantity set to 0", () => {
    useCartStore.getState().addItem(benefit);
    useCartStore.getState().updateQuantity("b1", 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("calculates total points", () => {
    useCartStore.getState().addItem(benefit);
    useCartStore.getState().addItem(benefit);
    expect(useCartStore.getState().getTotalPoints()).toBe(2000);
  });

  it("clears cart", () => {
    useCartStore.getState().addItem(benefit);
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("respects stock_limit on add", () => {
    useCartStore.getState().addItem(limitedBenefit);
    useCartStore.getState().addItem(limitedBenefit);
    useCartStore.getState().addItem(limitedBenefit);
    // 4th add should be rejected
    useCartStore.getState().addItem(limitedBenefit);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });

  it("caps quantity on updateQuantity with stock_limit", () => {
    useCartStore.getState().addItem(limitedBenefit);
    useCartStore.getState().updateQuantity("b2", 10);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });

  it("rejects out-of-stock items", () => {
    const outOfStock: CartBenefit = { ...benefit, id: "b3", stock_limit: 0 };
    useCartStore.getState().addItem(outOfStock);
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
