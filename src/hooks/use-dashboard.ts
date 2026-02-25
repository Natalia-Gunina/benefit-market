"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

interface DashboardData {
  summary: {
    total_employees: number;
    active_employees: number;
    total_accrued: number;
    total_spent: number;
    utilization_pct: number;
  };
  popular_benefits: Array<{ name: string; order_count: number; total_points: number }>;
  category_distribution: Array<{ name: string; total_points: number; pct: number }>;
  monthly_trend: Array<{ month: string; accrued: number; spent: number }>;
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/api/reports/dashboard"),
  });
}
