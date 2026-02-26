"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Order, OrderItem, Benefit } from "@/lib/types";

interface OrderItemWithBenefit extends OrderItem {
  benefit?: Pick<Benefit, "id" | "name" | "price_points" | "description">;
}

interface OrderWithItems extends Order {
  order_items: OrderItemWithBenefit[];
}

interface OrdersResponse {
  data: OrderWithItems[];
  meta: { page: number; per_page: number; total: number };
}

export function useOrders(params?: { status?: string; page?: number; perPage?: number }) {
  const queryParams: Record<string, string> = {};
  if (params?.status) queryParams.status = params.status;
  if (params?.page) queryParams.page = String(params.page);
  if (params?.perPage) queryParams.per_page = String(params.perPage);

  return useQuery({
    queryKey: ["orders", queryParams],
    queryFn: () => api.get<OrdersResponse>("/api/orders", queryParams),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<{ benefit_id: string; quantity: number }>) =>
      api.post<OrderWithItems>("/api/orders", { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useConfirmOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      api.post<Order>(`/api/orders/${orderId}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      api.post<Order>(`/api/orders/${orderId}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}
