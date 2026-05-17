"use client";

import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ColumnHeader } from "./column-header";
import type { ColumnDef, SortState } from "./types";

interface DataTableHeaderProps<T> {
  columns: ColumnDef<T>[];
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  filterValues: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  hasExpandable: boolean;
  hasActions: boolean;
}

export function DataTableHeader<T>({
  columns,
  sort,
  onSortChange,
  filterValues,
  onFilterChange,
  hasExpandable,
  hasActions,
}: DataTableHeaderProps<T>) {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        {hasExpandable && <TableHead className="w-8" />}
        {columns
          .filter((col) => !col.hidden)
          .map((col) => (
            <TableHead
              key={col.key}
              className={cn(col.headerClassName)}
              style={col.width ? { minWidth: col.width } : undefined}
            >
              <ColumnHeader
                column={col}
                sort={sort}
                onSortChange={onSortChange}
                filterValue={filterValues[col.filterKey ?? col.key] ?? ""}
                onFilterChange={(v) => onFilterChange(col.filterKey ?? col.key, v)}
              />
            </TableHead>
          ))}
        {hasActions && <TableHead className="w-auto text-right" />}
      </TableRow>
    </TableHeader>
  );
}
