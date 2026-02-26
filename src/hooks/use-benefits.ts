"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Benefit, BenefitCategory } from "@/lib/types";

interface BenefitWithCategory extends Benefit {
  category: Pick<BenefitCategory, "name" | "icon"> | null;
}

interface BenefitsCatalogResponse {
  data: BenefitWithCategory[];
  meta: { page: number; per_page: number; total: number };
}

export function useBenefits(params?: { categoryId?: string; search?: string; page?: number; perPage?: number }) {
  const queryParams: Record<string, string> = {};
  if (params?.categoryId) queryParams.category_id = params.categoryId;
  if (params?.search) queryParams.search = params.search;
  if (params?.page) queryParams.page = String(params.page);
  if (params?.perPage) queryParams.per_page = String(params.perPage);

  return useQuery({
    queryKey: ["benefits", queryParams],
    queryFn: () => api.get<BenefitsCatalogResponse>("/api/benefits", queryParams),
  });
}

export function useBenefitDetail(id: string) {
  return useQuery({
    queryKey: ["benefits", id],
    queryFn: () => api.get<BenefitWithCategory & { isEligible: boolean }>(`/api/benefits/${id}`),
    enabled: !!id,
  });
}
