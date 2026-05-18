"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, CalendarIcon, Coins, Star } from "lucide-react";
import { startOfMonth, endOfDay, format, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DataTable, useTableState } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";

/* -------------------------------------------------------------------------- */

interface ReviewData {
  rating: number;
  title: string;
  body: string;
}

interface OrderItem {
  id: string;
  order_id: string;
  quantity: number;
  price_points: number;
  provider_offerings?: { name: string } | null;
  orders?: {
    id: string;
    status: string;
    total_points: number;
    created_at: string;
    tenant_id: string;
  } | null;
  review?: ReviewData | null;
}

const statusBadge: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending: { label: "Ожидает", variant: "outline" },
  reserved: { label: "Резерв", variant: "secondary" },
  paid: { label: "Оплачен", variant: "default" },
  cancelled: { label: "Отменён", variant: "destructive" },
  expired: { label: "Истёк", variant: "destructive" },
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Ожидает" },
  { value: "reserved", label: "Резерв" },
  { value: "paid", label: "Оплачен" },
  { value: "cancelled", label: "Отменён" },
  { value: "expired", label: "Истёк" },
];

/* ----- Period presets ---------------------------------------------------- */

type PresetKey = "this_month" | "last_month" | "three_months" | "all" | "custom";

interface Preset {
  key: PresetKey;
  label: string;
  range: () => DateRange;
}

const PRESETS: Preset[] = [
  {
    key: "this_month",
    label: "Этот месяц",
    range: () => ({ from: startOfMonth(new Date()), to: new Date() }),
  },
  {
    key: "last_month",
    label: "Прошлый месяц",
    range: () => {
      const prev = subMonths(new Date(), 1);
      return {
        from: startOfMonth(prev),
        to: new Date(prev.getFullYear(), prev.getMonth() + 1, 0),
      };
    },
  },
  {
    key: "three_months",
    label: "3 месяца",
    range: () => ({ from: subMonths(new Date(), 3), to: new Date() }),
  },
  {
    key: "all",
    label: "Всё время",
    range: () => ({ from: new Date(2020, 0, 1), to: new Date() }),
  },
];

/* -------------------------------------------------------------------------- */

export default function ProviderOrdersPage() {
  const { state, setState, resetFilters } = useTableState({ pageSize: 20 });

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaidPoints, setTotalPaidPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activePreset, setActivePreset] = useState<PresetKey>("this_month");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    PRESETS[0].range()
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>();
  const pickClicksRef = useRef(0);

  const abortRef = useRef<AbortController | null>(null);

  const handlePreset = (preset: Preset) => {
    if (activePreset === preset.key) return;
    setActivePreset(preset.key);
    setDateRange(preset.range());
  };

  const handleCalendarOpen = (open: boolean) => {
    setCalendarOpen(open);
    if (open) {
      setCalendarRange(dateRange);
      pickClicksRef.current = 0;
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    pickClicksRef.current += 1;
    setCalendarRange(range);
    if (pickClicksRef.current >= 2 && range?.from && range?.to) {
      setDateRange(range);
      setActivePreset("custom");
      setCalendarOpen(false);
    }
  };

  /* ----- Fetch ------------------------------------------------------------ */
  const fetchOrders = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(state.page));
      params.set("per_page", String(state.pageSize));
      if (state.search) params.set("search", state.search);
      if (state.filters.status) params.set("status", state.filters.status);
      if (dateRange?.from)
        params.set("date_from", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange?.to)
        params.set(
          "date_to",
          format(endOfDay(dateRange.to), "yyyy-MM-dd'T'23:59:59")
        );

      const res = await fetch(`/api/provider/orders?${params}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Не удалось загрузить заказы");
      const json = await res.json();
      setOrders(json.data?.data ?? []);
      setTotal(json.data?.meta?.total ?? 0);
      setTotalPaidPoints(json.data?.aggregates?.total_paid_points ?? 0);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Ошибка загрузки данных";
      setError(msg);
      toast.error(msg);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [state, dateRange]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /* ----- Columns ---------------------------------------------------------- */
  const columns: ColumnDef<OrderItem>[] = useMemo(
    () => [
      {
        key: "order_id",
        header: "ID заказа",
        cell: (row) => {
          const orderId = row.orders?.id ?? row.order_id;
          return (
            <span className="font-mono text-sm text-muted-foreground">
              {orderId ? orderId.slice(0, 8) : "—"}
            </span>
          );
        },
      },
      {
        key: "offering",
        header: "Предложение",
        filter: { type: "text" },
        filterKey: "search",
        cell: (row) => (
          <span className="font-medium">
            {row.provider_offerings?.name ?? "—"}
          </span>
        ),
      },
      {
        key: "quantity",
        header: "Кол-во",
        sortable: true,
        headerClassName: "text-right",
        className: "text-right tabular-nums",
        cell: (row) => row.quantity,
      },
      {
        key: "price_points",
        header: "Баллы",
        sortable: true,
        filter: { type: "number" },
        headerClassName: "text-right",
        className: "text-right tabular-nums",
        cell: (row) => row.price_points.toLocaleString("ru-RU"),
      },
      {
        key: "status",
        header: "Статус",
        headerClassName: "text-center",
        className: "text-center",
        filter: { type: "select", options: STATUS_OPTIONS },
        cell: (row) => {
          const st =
            statusBadge[row.orders?.status ?? "pending"] ?? statusBadge.pending;
          return <Badge variant={st.variant}>{st.label}</Badge>;
        },
      },
      {
        key: "review",
        header: "Отзыв",
        headerClassName: "text-center",
        className: "text-center",
        cell: (row) => {
          if (!row.review) {
            return <span className="text-muted-foreground/40">—</span>;
          }
          return (
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-0.5 hover:opacity-80 transition-opacity">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`size-3.5 ${i < row.review!.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-80">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`size-4 ${i < row.review!.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                  <p className="font-medium text-sm">{row.review.title}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {row.review.body}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          );
        },
      },
      {
        key: "created_at",
        header: "Дата",
        sortable: true,
        cell: (row) => (
          <span className="text-muted-foreground">
            {row.orders?.created_at
              ? new Date(row.orders.created_at).toLocaleDateString("ru")
              : "—"}
          </span>
        ),
      },
    ],
    []
  );

  /* ----- Render ----------------------------------------------------------- */

  const dateLabel =
    dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, "d MMM", { locale: ru })} – ${format(dateRange.to, "d MMM yyyy", { locale: ru })}`
      : "Период";

  return (
    <div className="page-transition space-y-6 p-6">
      {/* Header block */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-heading font-bold">Заказы</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Заказы от сотрудников на ваши льготы
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePreset(preset)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    activePreset === preset.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              <Popover open={calendarOpen} onOpenChange={handleCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                      activePreset === "custom"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CalendarIcon className="size-3.5" />
                    {activePreset === "custom" ? dateLabel : "Свой"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={calendarRange}
                    onSelect={handleCalendarSelect}
                    numberOfMonths={2}
                  />
                  <div className="border-t px-3 py-2 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      {calendarRange?.from && !calendarRange?.to
                        ? "Выберите конец периода"
                        : calendarRange?.from && calendarRange?.to
                          ? `${format(calendarRange.from, "d MMM", { locale: ru })} – ${format(calendarRange.to, "d MMM", { locale: ru })}`
                          : "Выберите начало периода"}
                    </span>
                    <button
                      onClick={() => {
                        setCalendarRange(undefined);
                        setDateRange(PRESETS[0].range());
                        setActivePreset("this_month");
                        setCalendarOpen(false);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Сбросить
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="shrink-0 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 px-5 py-3 text-right">
            <div className="flex items-center justify-end gap-2">
              <Coins className="size-5 text-primary" />
              <span className="text-4xl font-bold tabular-nums tracking-tight">
                {totalPaidPoints.toLocaleString("ru-RU")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">оплаченные заказы</p>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        total={total}
        loading={loading}
        error={error}
        state={state}
        onStateChange={setState}
        onReset={resetFilters}
        emptyState={{
          icon: ClipboardList,
          title: "Заказов пока нет",
          description: "Заказы от сотрудников появятся здесь",
        }}
      />
    </div>
  );
}
