"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartColors } from "./use-chart-colors";

const MONTH_LABELS: Record<string, string> = {
  "01": "Янв", "02": "Фев", "03": "Мар", "04": "Апр",
  "05": "Май", "06": "Июн", "07": "Июл", "08": "Авг",
  "09": "Сен", "10": "Окт", "11": "Ноя", "12": "Дек",
};

interface CategoryTrendChartProps {
  data: Array<Record<string, string | number>>;
  categories: string[];
  title?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const monthPart = label?.split("-")[1] || "";
  const monthLabel = MONTH_LABELS[monthPart] || label;

  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{monthLabel}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs" style={{ color: p.color }}>
          {p.name}: <span className="font-bold tabular-nums">{p.value.toLocaleString("ru-RU")}</span>
        </p>
      ))}
    </div>
  );
}

export function CategoryTrendChart({ data, categories, title = "Динамика по категориям" }: CategoryTrendChartProps) {
  const c = useChartColors();
  const colors = [c.chart1, c.chart2, c.chart3, c.chart4, c.chart5, c.chart6];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.border} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: c.muted }}
                tickFormatter={(v: string) => MONTH_LABELS[v.split("-")[1]] || v}
              />
              <YAxis
                tick={{ fontSize: 12, fill: c.muted }}
                tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}к` : String(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) => <span className="text-xs">{value}</span>}
              />
              {categories.map((cat, i) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stackId="1"
                  stroke={colors[i % colors.length]}
                  fill={colors[i % colors.length]}
                  fillOpacity={0.4}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
