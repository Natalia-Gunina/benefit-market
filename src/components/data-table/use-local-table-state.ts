"use client";

import { useCallback, useState } from "react";
import type { TableState, SortState } from "./types";

interface UseLocalTableStateOptions {
  pageSize?: number;
  defaultSort?: SortState;
}

export function useLocalTableState(options: UseLocalTableStateOptions = {}) {
  const { pageSize = 20 } = options;

  const [state, setRaw] = useState<TableState>({
    page: 1,
    pageSize,
    search: "",
    sort: options.defaultSort ?? null,
    filters: {},
  });

  const setState = useCallback((patch: Partial<TableState>) => {
    setRaw((prev) => {
      const next = { ...prev, ...patch };
      const filtersChanged =
        patch.search !== undefined ||
        patch.filters !== undefined ||
        patch.sort !== undefined;
      if (filtersChanged && patch.page === undefined) {
        next.page = 1;
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setRaw((prev) => ({
      page: 1,
      pageSize: prev.pageSize,
      search: "",
      sort: options.defaultSort ?? null,
      filters: {},
    }));
  }, [options.defaultSort]);

  return { state, setState, resetFilters };
}
