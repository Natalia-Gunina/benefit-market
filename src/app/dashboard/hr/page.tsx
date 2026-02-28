"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Users,
  UserX,
  TrendingUp,
  Coins,
  Percent,
  ShoppingCart,
  Download,
} from "lucide-react";
import Papa from "papaparse";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/metric-card";
import type { AnalyticsData } from "@/lib/services/analytics.service";

// ---------------------------------------------------------------------------
// Lazy-loaded chart components
// ---------------------------------------------------------------------------

function ChartSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <Skeleton className="mb-4 h-5 w-48" />
      <Skeleton className="h-[300px] w-full rounded-md" />
    </div>
  );
}

const TrendChart = dynamic(
  () =>
    import("@/components/dashboard/trend-chart").then((m) => ({
      default: m.TrendChart,
    })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const DepartmentChart = dynamic(
  () =>
    import("@/components/dashboard/department-chart").then((m) => ({
      default: m.DepartmentChart,
    })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const EngagementChart = dynamic(
  () =>
    import("@/components/dashboard/engagement-chart").then((m) => ({
      default: m.EngagementChart,
    })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const CategoryTrendChart = dynamic(
  () =>
    import("@/components/dashboard/category-trend-chart").then((m) => ({
      default: m.CategoryTrendChart,
    })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const CategoryChart = dynamic(
  () =>
    import("@/components/dashboard/category-chart").then((m) => ({
      default: m.CategoryChart,
    })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const PopularTable = dynamic(
  () =>
    import("@/components/dashboard/popular-table").then((m) => ({
      default: m.PopularTable,
    })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function MetricSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="size-10 rounded-lg" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types for the dashboard trend (fetched separately)
// ---------------------------------------------------------------------------

interface MonthlyTrend {
  month: string;
  accrued: number;
  spent: number;
}

interface DashboardData {
  monthly_trend: MonthlyTrend[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HrAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [trend, setTrend] = useState<MonthlyTrend[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [analyticsRes, dashboardRes] = await Promise.all([
          fetch("/api/hr/analytics"),
          fetch("/api/reports/dashboard"),
        ]);

        if (!analyticsRes.ok) {
          const body = await analyticsRes.json().catch(() => ({}));
          throw new Error(body?.error?.message || `HTTP ${analyticsRes.status}`);
        }
        const analyticsJson = await analyticsRes.json();
        setData(analyticsJson.data);

        if (dashboardRes.ok) {
          const dashboardJson = await dashboardRes.json();
          const d = dashboardJson.data as DashboardData | undefined;
          if (d?.monthly_trend) setTrend(d.monthly_trend);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

  function handleExportCsv() {
    if (!data) return;

    const rows = [
      ...data.popular.map((b) => ({
        Раздел: "Популярные льготы",
        Название: b.name,
        Категория: b.category,
        Заказов: b.order_count,
        Баллов: b.total_points,
        "Уник. пользователей": b.unique_users,
      })),
      ...data.utilization.by_department.map((d) => ({
        Раздел: "Использование по отделам",
        Название: d.department,
        Категория: "",
        Заказов: d.employee_count,
        Баллов: d.total_spent,
        "Уник. пользователей": d.utilization_pct,
      })),
    ];

    const csv = Papa.unparse(rows);
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hr-analytics-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-transition space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Аналитика</h1>
          <p className="text-sm text-muted-foreground">
            Анализ использования льгот и вовлечённости сотрудников
          </p>
        </div>
        <Button variant="outline" disabled={!data} onClick={handleExportCsv}>
          <Download className="size-4" />
          Экспорт
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-error-light px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ============ Budget Utilization Section ============ */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-heading font-semibold">
          <TrendingUp className="size-5 text-primary" />
          Использование бюджета
        </h2>

        {/* Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
            </>
          ) : data ? (
            <>
              <MetricCard
                title="Общий бюджет"
                value={data.utilization.overall.total_budget}
                suffix="баллов"
                icon={Coins}
              />
              <MetricCard
                title="Потрачено"
                value={data.utilization.overall.total_spent}
                suffix="баллов"
                icon={ShoppingCart}
              />
              <MetricCard
                title="Использование бюджета"
                value={data.utilization.overall.utilization_pct}
                suffix="%"
                subtitle={`${data.utilization.overall.total_spent.toLocaleString("ru-RU")} / ${data.utilization.overall.total_budget.toLocaleString("ru-RU")} б.`}
                icon={Percent}
              />
              <MetricCard
                title="Остаток"
                value={data.utilization.overall.total_remaining}
                suffix="баллов"
                icon={BarChart3}
              />
            </>
          ) : null}
        </div>

        {/* Trend Chart (accrued vs spent over time) */}
        <div>
          {loading ? (
            <ChartSkeleton />
          ) : trend ? (
            <TrendChart data={trend} />
          ) : null}
        </div>

        {/* Charts: Department utilization + Grade utilization */}
        <div className="grid gap-4 lg:grid-cols-2">
          {loading ? (
            <>
              <ChartSkeleton />
              <ChartSkeleton />
            </>
          ) : data ? (
            <>
              <DepartmentChart data={data.utilization.by_department} />
              <DepartmentChart
                data={data.utilization.by_grade.map((g) => ({
                  department: g.grade,
                  utilization_pct: g.utilization_pct,
                  total_spent: g.total_spent,
                  employee_count: g.employee_count,
                }))}
                title="Использование по грейдам"
              />
            </>
          ) : null}
        </div>
      </section>

      {/* ============ Engagement Section ============ */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-heading font-semibold">
          <Users className="size-5 text-primary" />
          Вовлечённость
        </h2>

        {/* Engagement metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
            </>
          ) : data ? (
            <>
              <MetricCard
                title="Сотрудников"
                value={data.engagement.overall.total_employees}
                subtitle={`Активных: ${data.engagement.overall.active_employees.toLocaleString("ru-RU")} из ${data.engagement.overall.total_employees.toLocaleString("ru-RU")}`}
                icon={Users}
              />
              <MetricCard
                title="Не используют"
                value={data.engagement.overall.inactive_employees}
                icon={UserX}
              />
              <MetricCard
                title="Участие"
                value={data.engagement.overall.participation_pct}
                suffix="%"
                subtitle={`${data.engagement.overall.active_employees.toLocaleString("ru-RU")} / ${data.engagement.overall.total_employees.toLocaleString("ru-RU")} сотр.`}
                icon={Percent}
              />
            </>
          ) : null}
        </div>

        {/* Engagement by department chart */}
        <div className="grid gap-4 lg:grid-cols-2">
          {loading ? (
            <>
              <ChartSkeleton />
              <ChartSkeleton />
            </>
          ) : data ? (
            <>
              <EngagementChart data={data.engagement.by_department} />
              <EngagementChart
                data={data.engagement.by_grade.map((g) => ({
                  department: g.grade,
                  total: g.total,
                  active: g.active,
                  participation_pct: g.participation_pct,
                }))}
                title="Вовлечённость по грейдам"
              />
            </>
          ) : null}
        </div>
      </section>

      {/* ============ Categories Section ============ */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-heading font-semibold">
          <BarChart3 className="size-5 text-primary" />
          Категории
        </h2>

        <div className="grid gap-4 lg:grid-cols-2">
          {loading ? (
            <>
              <ChartSkeleton />
              <ChartSkeleton />
            </>
          ) : data ? (
            <>
              <CategoryChart
                data={data.categories.distribution.map((c) => ({
                  name: c.name,
                  value: c.total_points,
                }))}
              />
              <CategoryTrendChart
                data={data.categories.trend}
                categories={data.categories.distribution.map((c) => c.name)}
              />
            </>
          ) : null}
        </div>
      </section>

      {/* ============ Popular Benefits Section ============ */}
      <section className="space-y-4">
        {loading ? (
          <ChartSkeleton />
        ) : data ? (
          <PopularTable data={data.popular} />
        ) : null}
      </section>
    </div>
  );
}
