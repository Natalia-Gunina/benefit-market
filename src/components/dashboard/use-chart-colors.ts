"use client";

import { useEffect, useState } from "react";

/** Resolved chart theme colors for recharts (which can't resolve CSS vars in SVG). */
export interface ChartColors {
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chart6: string;
  border: string;
  muted: string;
  card: string;
}

const FALLBACK: ChartColors = {
  chart1: "#C8623A",
  chart2: "#458C6E",
  chart3: "#0090FF",
  chart4: "#F59F0A",
  chart5: "#9933CC",
  chart6: "#D94073",
  border: "#D9D1C4",
  muted: "#6B7A99",
  card: "#FFFFFF",
};

function resolve(style: CSSStyleDeclaration, prop: string): string {
  return style.getPropertyValue(prop).trim() || "";
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    setColors({
      chart1: resolve(style, "--chart-1") || FALLBACK.chart1,
      chart2: resolve(style, "--chart-2") || FALLBACK.chart2,
      chart3: resolve(style, "--chart-3") || FALLBACK.chart3,
      chart4: resolve(style, "--chart-4") || FALLBACK.chart4,
      chart5: resolve(style, "--chart-5") || FALLBACK.chart5,
      chart6: resolve(style, "--chart-6") || FALLBACK.chart6,
      border: resolve(style, "--border") || FALLBACK.border,
      muted: resolve(style, "--muted-foreground") || FALLBACK.muted,
      card: resolve(style, "--card") || FALLBACK.card,
    });
  }, []);

  return colors;
}
