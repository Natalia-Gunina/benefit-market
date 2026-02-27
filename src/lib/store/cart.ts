"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CartBenefit {
  id: string;
  name: string;
  price_points: number;
  stock_limit?: number | null;
  category_name?: string;
  category_icon?: string;
  /** If set, this is a marketplace item */
  tenant_offering_id?: string;
  provider_name?: string;
  provider_logo_url?: string;
  avg_rating?: number;
}

export interface CartItem {
  benefit: CartBenefit;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (benefit: CartBenefit) => void;
  removeItem: (benefitId: string) => void;
  updateQuantity: (benefitId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalPoints: () => number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (benefit: CartBenefit) => {
        set((state) => {
          const existing = state.items.find(
            (item) => item.benefit.id === benefit.id,
          );
          if (existing) {
            const newQty = existing.quantity + 1;
            if (benefit.stock_limit != null && newQty > benefit.stock_limit) {
              return state; // stock_limit exceeded
            }
            return {
              items: state.items.map((item) =>
                item.benefit.id === benefit.id
                  ? { ...item, quantity: newQty }
                  : item,
              ),
            };
          }
          if (benefit.stock_limit != null && benefit.stock_limit <= 0) {
            return state; // out of stock
          }
          return {
            items: [...state.items, { benefit, quantity: 1 }],
          };
        });
      },

      removeItem: (benefitId: string) => {
        set((state) => ({
          items: state.items.filter((item) => item.benefit.id !== benefitId),
        }));
      },

      updateQuantity: (benefitId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(benefitId);
          return;
        }
        set((state) => ({
          items: state.items.map((item) => {
            if (item.benefit.id !== benefitId) return item;
            const limit = item.benefit.stock_limit;
            const capped = limit != null ? Math.min(quantity, limit) : quantity;
            return { ...item, quantity: capped };
          }),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      getTotalPoints: () => {
        return get().items.reduce(
          (total, item) => total + item.benefit.price_points * item.quantity,
          0,
        );
      },
    }),
    {
      name: "benefit-market-cart",
    },
  ),
);
