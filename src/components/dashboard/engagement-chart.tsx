"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartColors } from "./use-chart-colors";

interface EngagementChartProps {
  data: Array<{
    department: string;
    total: number;
    active: number;
    participation_pct: number;
  }>;
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

  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs" style={{ color: p.color }}>
          {p.name}: <span className="font-bold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function EngagementChart({ data, title = "Вовлечённость по отделам" }: EngagementChartProps) {
  const c = useChartColors();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.border} />
              <XAxis
                dataKey="department"
                tick={{ fontSize: 11, fill: c.muted }}
              />
              <YAxis tick={{ fontSize: 12, fill: c.muted }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) => <span className="text-xs">{value}</span>}
              />
              <Bar dataKey="total" name="Всего" fill={c.border} radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="active" name="Активных" fill={c.chart2} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
