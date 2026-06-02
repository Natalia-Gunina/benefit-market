"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Package, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { DataTable, useTableState } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";

interface Offering {
  id: string;
  name: string;
  description: string;
  base_price_points: number;
  status: string;
  format: "online" | "offline";
  cities: string[] | null;
  avg_rating: number;
  review_count: number;
  created_at: string;
  global_categories?: { name: string; icon: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "warning" | "archived" }> = {
  draft: { label: "Черновик", variant: "secondary" },
  pending_review: { label: "На согласовании", variant: "warning" },
  published: { label: "Активна", variant: "default" },
  archived: { label: "В архиве", variant: "archived" },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));

const FORMAT_OPTIONS = [
  { value: "online", label: "Онлайн" },
  { value: "offline", label: "Офлайн" },
];

export default function ProviderOfferingsPage() {
  const { state, setState, resetFilters } = useTableState({ pageSize: 20 });
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOfferings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(state.page),
        per_page: String(state.pageSize),
      });
      if (state.search) params.set("search", state.search);
      if (state.sort) {
        params.set("sort_by", state.sort.key);
        params.set("sort_dir", state.sort.direction);
      }

      Object.entries(state.filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });

      const res = await fetch(`/api/provider/offerings?${params}`);
      if (!res.ok) throw new Error("Не удалось загрузить льготы");
      const json = await res.json();
      setOfferings(json.data?.data ?? json.data ?? []);
      setTotal(json.data?.meta?.total ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка загрузки";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    fetchOfferings();
  }, [fetchOfferings]);

  const columns: ColumnDef<Offering>[] = useMemo(() => [
    {
      key: "name",
      header: "Название",
      sortable: true,
      filter: { type: "text" },
      filterKey: "search",
      cell: (row) => (
        <Link
          href={`/dashboard/provider/offerings/${row.id}`}
          className="font-medium hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "global_categories",
      header: "Категория",
      filter: { type: "auto", field: "offerings.category" },
      filterKey: "category",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.global_categories?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "base_price_points",
      header: "Цена",
      sortable: true,
      filter: { type: "number" },
      headerClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (row) => row.base_price_points.toLocaleString("ru-RU"),
    },
    {
      key: "format",
      header: "Формат",
      filter: { type: "select", options: FORMAT_OPTIONS },
      headerClassName: "text-center",
      className: "text-center",
      cell: (row) => {
        const cities = Array.isArray(row.cities) ? row.cities : [];
        if (row.format === "offline" && cities.length > 0) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default">
                    <Badge variant="outline" className="text-xs">Офлайн</Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">{cities.join(", ")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return row.format === "offline"
          ? <Badge variant="outline" className="text-xs">Офлайн</Badge>
          : <Badge variant="secondary" className="text-xs">Онлайн</Badge>;
      },
    },
    {
      key: "status",
      header: "Статус",
      filter: { type: "select", options: STATUS_OPTIONS },
      headerClassName: "text-center",
      className: "text-center",
      cell: (row) => {
        const st = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.draft;
        return <Badge variant={st.variant}>{st.label}</Badge>;
      },
    },
  ], []);

  return (
    <div className="page-transition space-y-8 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Льготы</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ваши льготы на платформе</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/provider/offerings/new">
            <Plus className="size-4" />
            Добавить льготу
          </Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={offerings}
        total={total}
        loading={loading}
        error={error}
        state={state}
        onStateChange={setState}
        onReset={resetFilters}
        searchable={{ placeholder: "Поиск по названию..." }}
        actions={(o) => [
          { label: "Редактировать", icon: Pencil, onClick: () => { window.location.href = `/dashboard/provider/offerings/${o.id}`; } },
        ]}
        emptyState={{
          icon: Package,
          title: "Нет льгот",
          description: "Добавьте первую льготу для сотрудников",
        }}
      />
    </div>
  );
}
