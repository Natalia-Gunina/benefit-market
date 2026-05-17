"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable, useTableState } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";

/* -------------------------------------------------------------------------- */

interface ReviewItem {
  id: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  created_at: string;
  provider_offerings?: { name: string } | null;
  users?: { email: string } | null;
}

interface OfferingOption {
  id: string;
  name: string;
}

const statusLabels: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  visible: { label: "Опубликован", variant: "default" },
  hidden: { label: "Скрыт", variant: "secondary" },
  flagged: { label: "Жалоба", variant: "destructive" },
};

/* -------------------------------------------------------------------------- */

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export default function ProviderReviewsPage() {
  const { state, setState, resetFilters } = useTableState({ pageSize: 20 });

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [offerings, setOfferings] = useState<OfferingOption[]>([]);

  /* ----- Fetch offerings for filter -------------------------------------- */
  useEffect(() => {
    fetch("/api/provider/offerings?per_page=100")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data?.data ?? json.data ?? [];
        setOfferings(
          data.map((o: { id: string; name: string }) => ({
            id: o.id,
            name: o.name,
          })),
        );
      })
      .catch(() => {});
  }, []);

  /* ----- Fetch reviews --------------------------------------------------- */
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(state.page));
      params.set("per_page", String(state.pageSize));

      Object.entries(state.filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });

      const res = await fetch(`/api/provider/reviews?${params}`);
      if (!res.ok) throw new Error("Не удалось загрузить отзывы");
      const json = await res.json();
      setReviews(json.data?.data ?? []);
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
    fetchReviews();
  }, [fetchReviews]);

  /* ----- Table columns --------------------------------------------------- */
  const STATUS_OPTIONS = [
    { value: "visible", label: "Опубликован" },
    { value: "hidden", label: "Скрыт" },
    { value: "flagged", label: "Жалоба" },
  ];

  const columns: ColumnDef<ReviewItem>[] = useMemo(() => [
    {
      key: "offering",
      header: "Предложение",
      filterKey: "offering_id",
      filter: {
        type: "select",
        options: offerings.map((o) => ({ value: o.id, label: o.name })),
      },
      cell: (row) => (
        <span className="font-medium">
          {row.provider_offerings?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "rating",
      header: "Оценка",
      sortable: true,
      filter: {
        type: "select",
        options: [5, 4, 3, 2, 1].map((r) => ({
          value: String(r),
          label: `${r} звёзд`,
        })),
      },
      cell: (row) => <StarRating rating={row.rating} />,
    },
    {
      key: "title",
      header: "Заголовок",
      filter: { type: "text" },
      cell: (row) => row.title || "—",
    },
    {
      key: "body",
      header: "Текст",
      className: "max-w-[300px] truncate text-muted-foreground",
      cell: (row) => row.body || "—",
    },
    {
      key: "status",
      header: "Статус",
      headerClassName: "text-center",
      className: "text-center",
      filter: { type: "select", options: STATUS_OPTIONS },
      cell: (row) => {
        const st = statusLabels[row.status] ?? statusLabels.visible;
        return <Badge variant={st.variant}>{st.label}</Badge>;
      },
    },
    {
      key: "created_at",
      header: "Дата",
      sortable: true,
      cell: (row) => (
        <span className="text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString("ru")}
        </span>
      ),
    },
  ], [offerings]);

  /* ----- Render ---------------------------------------------------------- */
  return (
    <div className="page-transition space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Отзывы</h1>
        <p className="mt-1 text-sm text-muted-foreground">Отзывы сотрудников о ваших услугах</p>
      </div>

      <DataTable
        columns={columns}
        data={reviews}
        total={total}
        loading={loading}
        error={error}
        state={state}
        onStateChange={setState}
        onReset={resetFilters}
        emptyState={{
          icon: MessageSquare,
          title: "Отзывов пока нет",
          description: "Отзывы от сотрудников появятся здесь",
        }}
      />
    </div>
  );
}
