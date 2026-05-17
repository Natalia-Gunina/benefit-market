"use client";

import { useMemo } from "react";
import type { ColumnDef, TableState } from "./types";

export function useClientFiltered<T>(
  data: T[],
  state: TableState,
  columns: ColumnDef<T>[],
): { filtered: T[]; total: number } {
  return useMemo(() => {
    let items = [...data];

    if (state.search) {
      const q = state.search.toLowerCase();
      items = items.filter((row) =>
        columns.some((col) => {
          const raw = (row as Record<string, unknown>)[col.key];
          const val = raw != null && typeof raw === "object" && "name" in (raw as Record<string, unknown>)
            ? (raw as Record<string, string>).name
            : raw;
          return val != null && String(val).toLowerCase().includes(q);
        }),
      );
    }

    for (const [filterKey, filterValue] of Object.entries(state.filters)) {
      if (!filterValue) continue;
      const col = columns.find((c) => (c.filterKey ?? c.key) === filterKey);
      if (!col) continue;
      const dataKey = col.key;

      if (col.filter?.type === "text") {
        const q = filterValue.toLowerCase();
        items = items.filter((row) => {
          const val = (row as Record<string, unknown>)[dataKey];
          return val != null && String(val).toLowerCase().includes(q);
        });
      } else if (col.filter?.type === "select" || col.filter?.type === "auto") {
        const allowed = new Set(filterValue.split(","));
        items = items.filter((row) => {
          const raw = (row as Record<string, unknown>)[dataKey];
          const val = raw != null && typeof raw === "object" && "name" in (raw as Record<string, unknown>)
            ? (raw as Record<string, string>).name
            : raw;
          return val != null && allowed.has(String(val));
        });
      } else if (col.filter?.type === "number") {
        const [minStr, maxStr] = filterValue.split("~");
        const min = minStr ? Number(minStr) : null;
        const max = maxStr ? Number(maxStr) : null;
        items = items.filter((row) => {
          const val = Number((row as Record<string, unknown>)[dataKey] ?? 0);
          if (min !== null && !isNaN(min) && val < min) return false;
          if (max !== null && !isNaN(max) && val > max) return false;
          return true;
        });
      }
    }

    if (state.sort) {
      const { key, direction } = state.sort;
      const dir = direction === "desc" ? -1 : 1;
      items.sort((a, b) => {
        const av = (a as Record<string, unknown>)[key];
        const bv = (b as Record<string, unknown>)[key];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "number" && typeof bv === "number") {
          return (av - bv) * dir;
        }
        return String(av).localeCompare(String(bv), "ru") * dir;
      });
    }

    const total = items.length;
    const offset = (state.page - 1) * state.pageSize;
    const paginated = items.slice(offset, offset + state.pageSize);

    return { filtered: paginated, total };
  }, [data, state, columns]);
}
