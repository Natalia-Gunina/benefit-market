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
  category_name?: string;
  category_icon?: string;
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
            return {
              items: state.items.map((item) =>
                item.benefit.id === benefit.id
                  ? { ...item, quantity: item.quantity + 1 }
                  : item,
              ),
            };
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
          items: state.items.map((item) =>
            item.benefit.id === benefitId ? { ...item, quantity } : item,
          ),
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
