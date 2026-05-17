"use client";

import { useCallback, useMemo } from "react";
import { SearchX, AlertCircle } from "lucide-react";
import { Table } from "@/components/ui/table";
import { DataTableToolbar } from "./data-table-toolbar";
import { DataTableHeader } from "./data-table-header";
import { DataTableBody } from "./data-table-body";
import { DataTablePagination } from "./data-table-pagination";
import type { ColumnDef, ActionDef, SortState, TableState } from "./types";
import type { LucideIcon } from "lucide-react";

interface DataTableViewProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  total: number;
  loading?: boolean;
  error?: string | null;

  state: TableState;
  onStateChange: (patch: Partial<TableState>) => void;
  onReset: () => void;

  searchable?: { placeholder?: string; debounceMs?: number };

  onRowClick?: (row: T) => void;
  expandable?: (row: T) => React.ReactNode;
  actions?: (row: T) => ActionDef[];
  headerActions?: React.ReactNode;
  rowClassName?: (row: T) => string;
  emptyState?: { icon?: LucideIcon; title?: string; description?: string };
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  total,
  loading = false,
  error,
  state,
  onStateChange,
  onReset,
  searchable,
  onRowClick,
  expandable,
  actions,
  headerActions,
  rowClassName,
  emptyState,
}: DataTableViewProps<T>) {
  const activeFilterCount = Object.values(state.filters).filter(
    (v) => v && v !== "all" && v !== ""
  ).length;

  const hasActiveFilters =
    state.search !== "" || activeFilterCount > 0;

  const handleSearchChange = useCallback(
    (search: string) => onStateChange({ search }),
    [onStateChange]
  );

  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      if (key === "search") {
        onStateChange({ search: value });
      } else {
        onStateChange({ filters: { ...state.filters, [key]: value } });
      }
    },
    [onStateChange, state.filters]
  );

  const filterValuesForHeader = useMemo(() => {
    const values = { ...state.filters };
    if (state.search) values.search = state.search;
    return values;
  }, [state.filters, state.search]);

  const handleSortChange = useCallback(
    (sort: SortState | null) => onStateChange({ sort }),
    [onStateChange]
  );

  const handlePageChange = useCallback(
    (page: number) => onStateChange({ page }),
    [onStateChange]
  );

  const emptyContent = (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      {emptyState?.icon ? (
        <emptyState.icon className="size-10 text-muted-foreground mb-3" />
      ) : (
        <SearchX className="size-10 text-muted-foreground mb-3" />
      )}
      <p className="font-medium text-sm">
        {emptyState?.title ?? "Ничего не найдено"}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {emptyState?.description ?? "Попробуйте изменить параметры поиска"}
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      <DataTableToolbar
        searchable={searchable}
        searchValue={state.search}
        onSearchChange={handleSearchChange}
        onReset={onReset}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        headerActions={headerActions}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-lg border bg-card relative">
        <Table>
          <DataTableHeader
            columns={columns}
            sort={state.sort}
            onSortChange={handleSortChange}
            filterValues={filterValuesForHeader}
            onFilterChange={handleFilterChange}
            hasExpandable={!!expandable}
            hasActions={!!actions}
          />
          <DataTableBody
            columns={columns}
            data={data}
            loading={loading}
            pageSize={state.pageSize}
            onRowClick={onRowClick}
            expandable={expandable}
            actions={actions}
            rowClassName={rowClassName}
            emptyContent={emptyContent}
            hasActions={!!actions}
          />
        </Table>

        <DataTablePagination
          page={state.page}
          pageSize={state.pageSize}
          total={total}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
