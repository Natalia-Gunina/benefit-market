"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Archive, Check, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { DataTable, useLocalTableState, useClientFiltered } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";

interface Offering {
  id: string;
  name: string;
  status: string;
  base_price_points: number;
  providers?: { id: string; name: string; status: string } | null;
  global_categories?: { name: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Черновик", variant: "secondary" },
  pending_review: { label: "На модерации", variant: "outline" },
  published: { label: "Опубликовано", variant: "default" },
  archived: { label: "Архив", variant: "destructive" },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));

export default function AdminOfferingsPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const table = useLocalTableState();

  const load = useCallback(() => {
    setIsLoading(true);
    fetch("/api/admin/offerings")
      .then((r) => r.json())
      .then((json) => setOfferings(json.data?.data ?? json.data ?? []))
      .catch(() => toast.error("Ошибка загрузки данных"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/offerings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(`Статус обновлён: ${STATUS_CONFIG[status]?.label ?? status}`);
        load();
      } else {
        toast.error("Ошибка обновления");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  const columns: ColumnDef<Offering>[] = useMemo(() => [
    {
      key: "name",
      header: "Название",
      sortable: true,
      filter: { type: "text" },
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "providers",
      header: "Провайдер",
      sortable: true,
      filter: { type: "auto", field: "offerings.provider" },
      filterKey: "providers",
      cell: (row) => row.providers?.name ?? "—",
    },
    {
      key: "global_categories",
      header: "Категория",
      sortable: true,
      filter: { type: "auto", field: "offerings.category" },
      filterKey: "global_categories",
      cell: (row) => row.global_categories?.name ?? "—",
    },
    {
      key: "base_price_points",
      header: "Цена",
      sortable: true,
      filter: { type: "number" },
      className: "text-right tabular-nums",
      headerClassName: "text-right",
      cell: (row) => row.base_price_points.toLocaleString("ru-RU"),
    },
    {
      key: "status",
      header: "Статус",
      filter: { type: "select", options: STATUS_OPTIONS },
      cell: (row) => {
        const st = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.draft;
        return <Badge variant={st.variant}>{st.label}</Badge>;
      },
    },
  ], []);

  const filtered = useClientFiltered(offerings, table.state, columns);

  return (
    <div className="page-transition space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Модерация предложений</h1>
        <p className="mt-1 text-sm text-muted-foreground">Проверка и утверждение предложений от провайдеров</p>
      </div>

      <DataTable
        columns={columns}
        data={filtered.filtered}
        total={filtered.total}
        loading={isLoading}
        state={table.state}
        onStateChange={table.setState}
        onReset={table.resetFilters}
        searchable={{ placeholder: "Поиск по названию или провайдеру..." }}
        actions={(o) => [
          ...(o.status === "pending_review"
            ? [
                { label: "Одобрить", icon: Check, onClick: () => updateStatus(o.id, "published") },
                { label: "Отклонить", icon: X, onClick: () => updateStatus(o.id, "draft"), variant: "destructive" as const },
              ]
            : []),
          ...(o.status === "published"
            ? [{ label: "Архивировать", icon: Archive, onClick: () => updateStatus(o.id, "archived") }]
            : []),
        ]}
        emptyState={{
          icon: ShieldAlert,
          title: "Нет предложений",
          description: "Предложения от провайдеров появятся здесь",
        }}
      />
    </div>
  );
}
