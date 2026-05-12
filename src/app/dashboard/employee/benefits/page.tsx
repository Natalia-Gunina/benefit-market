"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  Building2,
  Loader2,
  Package,
  CalendarDays,
  Mail,
  LayoutGrid,
  Rows3,
} from "lucide-react";
import { toast } from "sonner";

import type { OrderStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import {
  OrderItemReview,
  type MyReview,
} from "@/components/reviews/order-item-review";

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
    <div className="page-transition space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Sparkles className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold">Мои льготы</h1>
          <p className="text-sm text-muted-foreground">
            Льготы, которые вы оформили и активировали
          </p>
        </div>
      </div>

      {hasBenefits && (
        <div className="flex items-start gap-3 rounded-lg border border-info/30 bg-info-light/50 p-3 text-sm">
          <Mail className="size-4 shrink-0 text-info mt-0.5" />
          <p>
            Сертификат на пользование льготой направлен на электронную почту,
            указанную в вашем профиле. Если письма нет — проверьте папку
            «Спам» или обратитесь в HR.
          </p>
        </div>
      )}

      {hasBenefits && (
        <div className="flex justify-end">
          <Tabs
            value={viewMode}
            onValueChange={(v) => setViewMode(v as ViewMode)}
          >
            <TabsList>
              <TabsTrigger value="cards" className="gap-1.5">
                <LayoutGrid className="size-4" />
                Карточки
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-1.5">
                <Rows3 className="size-4" />
                Таблица
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {!hasBenefits ? (
        <EmptyState
          icon={Package}
          title="Пока нет активных льгот"
          description="Когда вы оформите и оплатите заказ, льготы появятся здесь."
          action={{ label: "Открыть каталог", href: "/dashboard/employee/catalog" }}
        />
      ) : viewMode === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => {
            const existingReview = b.providerOfferingId
              ? reviewsByOffering.get(b.providerOfferingId)
              : undefined;
            return (
              <Card key={b.key} className="flex h-full flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">
                      {b.name}
                    </CardTitle>
                    <Badge variant="outline" className="shrink-0 tabular-nums">
                      {(b.pricePoints * b.quantity).toLocaleString("ru-RU")} б.
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {b.providerName && (
                      <Badge variant="secondary" className="w-fit text-xs gap-0.5">
                        <Building2 className="size-3" />
                        {b.providerName}
                      </Badge>
                    )}
                    {b.quantity > 1 && (
                      <Badge variant="outline" className="w-fit text-xs">
                        × {b.quantity}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-2">
                  {b.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {b.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    Получено {formatDate(b.acquiredAt)}
                  </div>
                </CardContent>

                {b.providerOfferingId && (
                  <CardFooter className="border-t pt-3">
                    <OrderItemReview
                      providerOfferingId={b.providerOfferingId}
                      existingReview={existingReview ?? null}
                      onChanged={() => {
                        if (b.providerOfferingId) {
                          fetchReviews([b.providerOfferingId]);
                        }
                      }}
                    />
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Льгота</TableHead>
                  <TableHead>Провайдер</TableHead>
                  <TableHead>Получено</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                  <TableHead className="text-right">Баллы</TableHead>
                  <TableHead>Оценка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {benefits.map((b) => {
                  const existingReview = b.providerOfferingId
                    ? reviewsByOffering.get(b.providerOfferingId)
                    : undefined;
                  return (
                    <TableRow key={b.key}>
                      <TableCell>
                        <div className="font-medium">{b.name}</div>
                        {b.description && (
                          <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            {b.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {b.providerName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(b.acquiredAt)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {(b.pricePoints * b.quantity).toLocaleString("ru-RU")} б.
                      </TableCell>
                      <TableCell>
                        {b.providerOfferingId ? (
                          <OrderItemReview
                            providerOfferingId={b.providerOfferingId}
                            existingReview={existingReview ?? null}
                            onChanged={() => {
                              if (b.providerOfferingId) {
                                fetchReviews([b.providerOfferingId]);
                              }
                            }}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
