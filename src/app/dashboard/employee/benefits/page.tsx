"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  Package,
  CalendarDays,
  LayoutGrid,
  Rows3,
} from "lucide-react";
import { toast } from "sonner";

import type { OrderStatus } from "@/lib/types";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import {
  OrderItemReview,
  type MyReview,
} from "@/components/reviews/order-item-review";
import {
  DataTable,
  useLocalTableState,
  useClientFiltered,
  type ColumnDef,
} from "@/components/data-table";

interface OrderItemData {
  id: string;
  benefit_id: string | null;
  provider_offering_id: string | null;
  tenant_offering_id: string | null;
  quantity: number;
  price_points: number;
  benefit?: {
    id: string;
    name: string;
    price_points: number;
    description?: string;
  };
  offering?: {
    id: string;
    name: string;
    description: string | null;
    providers?: { name: string } | null;
  };
}

interface OrderData {
  id: string;
  status: OrderStatus;
  total_points: number;
  created_at: string;
  order_items: OrderItemData[];
}

interface MyBenefit {
  id: string;
  key: string;
  name: string;
  description: string | null;
  providerName: string | null;
  pricePoints: number;
  quantity: number;
  acquiredAt: string;
  providerOfferingId: string | null;
}

type ViewMode = "cards" | "table";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function flattenBenefits(orders: OrderData[]): MyBenefit[] {
  return orders
    .filter((o) => o.status === "paid")
    .flatMap((order) =>
      order.order_items.map<MyBenefit>((item) => ({
        id: item.id,
        key: item.id,
        name:
          item.offering?.name ??
          item.benefit?.name ??
          "Без названия",
        description:
          item.offering?.description ??
          item.benefit?.description ??
          null,
        providerName: item.offering?.providers?.name ?? null,
        pricePoints: item.price_points,
        quantity: item.quantity,
        acquiredAt: order.created_at,
        providerOfferingId: item.provider_offering_id,
      })),
    )
    .sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt));
}

function ViewToggle({ viewMode, onChange }: { viewMode: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <Tabs value={viewMode} onValueChange={(v) => onChange(v as ViewMode)}>
      <TabsList className="h-10 px-1">
        <TabsTrigger value="cards" className="gap-2 px-4 text-sm">
          <LayoutGrid className="size-4" />
          Карточки
        </TabsTrigger>
        <TabsTrigger value="table" className="gap-2 px-4 text-sm">
          <Rows3 className="size-4" />
          Таблица
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default function MyBenefitsPage() {
  const [benefits, setBenefits] = useState<MyBenefit[]>([]);
  const [reviewsByOffering, setReviewsByOffering] = useState<Map<string, MyReview>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const fetchReviews = useCallback(async (offeringIds: string[]) => {
    if (offeringIds.length === 0) {
      setReviewsByOffering(new Map());
      return;
    }
    try {
      const res = await fetch(
        `/api/reviews/mine?provider_offering_ids=${offeringIds.join(",")}`,
      );
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data ?? json;
      const list: MyReview[] = Array.isArray(data) ? data : (data?.data ?? []);
      setReviewsByOffering(new Map(list.map((r) => [r.provider_offering_id, r])));
    } catch {
      /* soft-fail */
    }
  }, []);

  const providerOptions = useMemo(
    () => [...new Set(benefits.map((b) => b.providerName).filter(Boolean) as string[])].sort().map((v) => ({ value: v, label: v })),
    [benefits],
  );

  const columns = useMemo<ColumnDef<MyBenefit>[]>(
    () => [
      {
        key: "name",
        header: "Льгота",
        sortable: true,
        filter: { type: "text" },
        cell: (row) => (
          <div>
            <span className="font-medium">{row.name}</span>
            {row.providerName && (
              <p className="text-xs text-muted-foreground">{row.providerName}</p>
            )}
          </div>
        ),
      },
      {
        key: "providerName",
        header: "Провайдер",
        sortable: true,
        filter: { type: "select", options: providerOptions },
        hidden: true,
      },
      {
        key: "acquiredAt",
        header: "Получено",
        sortable: true,
        cell: (row) => (
          <span className="text-muted-foreground">
            {formatDate(row.acquiredAt)}
          </span>
        ),
      },
      {
        key: "pricePoints",
        header: "Баллы",
        sortable: true,
        filter: { type: "number" },
        className: "text-right tabular-nums font-medium",
        headerClassName: "text-right",
        cell: (row) => (
          <>
            {(row.pricePoints * row.quantity).toLocaleString("ru-RU")} б.
            {row.quantity > 1 && (
              <span className="text-xs text-muted-foreground ml-1">×{row.quantity}</span>
            )}
          </>
        ),
      },
      {
        key: "_review",
        header: "Оценка",
        cell: (row) =>
          row.providerOfferingId ? (
            <OrderItemReview
              providerOfferingId={row.providerOfferingId}
              existingReview={
                reviewsByOffering.get(row.providerOfferingId) ?? null
              }
              onChanged={() => {
                if (row.providerOfferingId) {
                  fetchReviews([row.providerOfferingId]);
                }
              }}
              size="sm"
            />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    [reviewsByOffering, fetchReviews, providerOptions],
  );

  const { state: tableState, setState: setTableState, resetFilters } =
    useLocalTableState();

  const { filtered, total } = useClientFiltered(benefits, tableState, columns);

  const fetchBenefits = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/orders?status=paid&per_page=100");
      if (!res.ok) {
        toast.error("Не удалось загрузить льготы");
        return;
      }
      const json = await res.json();
      const list = flattenBenefits((json.data ?? []) as OrderData[]);
      setBenefits(list);

      const offeringIds = Array.from(
        new Set(
          list
            .map((b) => b.providerOfferingId)
            .filter((v): v is string => !!v),
        ),
      );
      await fetchReviews(offeringIds);
    } catch {
      toast.error("Ошибка сети при загрузке льгот");
    } finally {
      setIsLoading(false);
    }
  }, [fetchReviews]);

  useEffect(() => {
    fetchBenefits();
  }, [fetchBenefits]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasBenefits = benefits.length > 0;

  return (
    <div className="page-transition space-y-8 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Sparkles className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold">Мои льготы</h1>
            <p className="text-sm text-muted-foreground">
              Оформленные льготы — сертификаты направлены на email из профиля
            </p>
          </div>
        </div>
        {hasBenefits && <ViewToggle viewMode={viewMode} onChange={setViewMode} />}
      </div>

      {!hasBenefits ? (
        <EmptyState
          icon={Package}
          title="Пока нет активных льгот"
          description="Когда вы оформите и оплатите заказ, льготы появятся здесь."
          action={{ label: "Открыть каталог", href: "/dashboard/employee/catalog" }}
        />
      ) : viewMode === "cards" ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => {
            const existingReview = b.providerOfferingId
              ? reviewsByOffering.get(b.providerOfferingId)
              : undefined;
            return (
              <Card key={b.key} className="flex h-full flex-col">
                <CardContent className="flex-1 space-y-3 pt-5">
                  <div>
                    <h3 className="font-medium leading-snug">{b.name}</h3>
                    {b.providerName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {b.providerName}
                      </p>
                    )}
                  </div>

                  {b.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {b.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-lg font-semibold tabular-nums text-primary">
                      {(b.pricePoints * b.quantity).toLocaleString("ru-RU")} б.
                      {b.quantity > 1 && (
                        <span className="text-xs font-normal text-muted-foreground ml-1">×{b.quantity}</span>
                      )}
                    </span>
                    {b.providerOfferingId && (
                      <OrderItemReview
                        providerOfferingId={b.providerOfferingId}
                        existingReview={existingReview ?? null}
                        onChanged={() => {
                          if (b.providerOfferingId) {
                            fetchReviews([b.providerOfferingId]);
                          }
                        }}
                      />
                    )}
                  </div>
                </CardContent>

                <div className="border-t px-6 py-2.5">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3" />
                    Получено {formatDate(b.acquiredAt)}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          total={total}
          state={tableState}
          onStateChange={setTableState}
          onReset={resetFilters}
          searchable={{ placeholder: "Поиск по названию..." }}
          emptyState={{
            icon: Package,
            title: "Ничего не найдено",
            description: "Попробуйте изменить параметры поиска",
          }}
        />
      )}
    </div>
  );
}
