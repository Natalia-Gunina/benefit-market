"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetricCardProps {
  title: string;
  value: number;
  suffix?: string;
  /** Secondary label shown below the main value */
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetricCard({
  title,
  value,
  suffix,
  subtitle,
  icon: Icon,
  trend,
}: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums">
              {value.toLocaleString("ru-RU")}
            </span>
            {suffix && (
              <span className="text-sm text-muted-foreground">{suffix}</span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div
              className={`flex items-center gap-0.5 text-xs font-medium ${
                trend.positive ? "text-success" : "text-destructive"
              }`}
            >
              {trend.positive ? (
                <ArrowUp className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )}
              <span>{trend.value}%</span>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-gradient-to-br from-primary/12 to-primary/4 p-2.5 ring-1 ring-primary/8">
          <Icon className="size-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}
