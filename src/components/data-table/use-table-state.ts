"use client";

import { useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { TableState, SortState } from "./types";

const RESERVED_KEYS = new Set(["page", "search", "sort", "pageSize", "per_page", "sort_by", "sort_dir"]);

interface UseTableStateOptions {
  pageSize?: number;
  defaultSort?: SortState;
}

export function useTableState(options: UseTableStateOptions = {}) {
  const { pageSize = 20 } = options;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const defaultSortRef = useRef(options.defaultSort ?? null);
  const defaultSort = defaultSortRef.current;

  const state: TableState = useMemo(() => {
    const page = Number(searchParams.get("page")) || 1;
    const search = searchParams.get("search") ?? "";
    const sortRaw = searchParams.get("sort");

    let sort: SortState | null = defaultSort;
    if (sortRaw) {
      const [key, dir] = sortRaw.split(".");
      if (key && (dir === "asc" || dir === "desc")) {
        sort = { key, direction: dir };
      }
    }

    const filters: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (!RESERVED_KEYS.has(key)) {
        filters[key] = value;
      }
    });

    return { page, pageSize, search, sort, filters };
  }, [searchParams, pageSize, defaultSort]);

  const buildParams = useCallback(
    (next: TableState): URLSearchParams => {
      const params = new URLSearchParams();

      if (next.page > 1) params.set("page", String(next.page));
      if (next.search) params.set("search", next.search);

      if (next.sort) {
        const isDefault =
          defaultSort &&
          next.sort.key === defaultSort.key &&
          next.sort.direction === defaultSort.direction;
        if (!isDefault) {
          params.set("sort", `${next.sort.key}.${next.sort.direction}`);
        }
      }

      Object.entries(next.filters).forEach(([k, v]) => {
        if (v && v !== "all" && v !== "") params.set(k, v);
      });

      return params;
    },
    [defaultSort]
  );

  const setState = useCallback(
    (patch: Partial<TableState>) => {
      const next = { ...state, ...patch };

      const filtersChanged =
        patch.search !== undefined ||
        patch.filters !== undefined ||
        patch.sort !== undefined;
      if (filtersChanged && patch.page === undefined) {
        next.page = 1;
      }

      const params = buildParams(next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [state, buildParams, router, pathname]
  );

  const resetFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  return { state, setState, resetFilters };
}
