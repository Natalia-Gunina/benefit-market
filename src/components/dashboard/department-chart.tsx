"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartColors } from "./use-chart-colors";

interface DepartmentChartProps {
  data: Array<{
    department: string;
    utilization_pct: number;
    total_spent: number;
    employee_count: number;
  }>;
  title?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: DepartmentChartProps["data"][0] }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums">{d.utilization_pct}% утилизация</p>
      <p className="text-xs text-muted-foreground">
        {d.total_spent.toLocaleString("ru-RU")} баллов потрачено
      </p>
      <p className="text-xs text-muted-foreground">{d.employee_count} сотрудников</p>
    </div>
  );
}

export function DepartmentChart({ data, title = "Утилизация по отделам" }: DepartmentChartProps) {
  const c = useChartColors();
  const colors = [c.chart1, c.chart2, c.chart3, c.chart4, c.chart5, c.chart6];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke={c.border} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: c.muted }}
                tickFormatter={(v: number) => `${v}%`}
                domain={[0, 100]}
              />
              <YAxis
                type="category"
                dataKey="department"
                tick={{ fontSize: 12, fill: c.muted }}
                width={100}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="utilization_pct" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
