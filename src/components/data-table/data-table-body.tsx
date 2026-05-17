"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ActionDef, ColumnDef } from "./types";

interface DataTableBodyProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading: boolean;
  pageSize: number;
  onRowClick?: (row: T) => void;
  expandable?: (row: T) => React.ReactNode;
  actions?: (row: T) => ActionDef[];
  rowClassName?: (row: T) => string;
  emptyContent: React.ReactNode;
  hasActions: boolean;
}

export function DataTableBody<T extends { id?: string | number }>({
  columns,
  data,
  loading,
  pageSize,
  onRowClick,
  expandable,
  actions,
  rowClassName,
  emptyContent,
  hasActions,
}: DataTableBodyProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());
  const visibleColumns = columns.filter((col) => !col.hidden);
  const totalCols = visibleColumns.length + (expandable ? 1 : 0) + (hasActions ? 1 : 0);

  if (loading && data.length === 0) {
    return (
      <TableBody>
        {Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
          <TableRow key={i}>
            {expandable && (
              <TableCell className="w-8">
                <Skeleton className="size-4" />
              </TableCell>
            )}
            {visibleColumns.map((col) => (
              <TableCell key={col.key}>
                <Skeleton className="h-4 w-3/4" />
              </TableCell>
            ))}
            {hasActions && (
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    );
  }

  if (!loading && data.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={totalCols} className="h-32">
            {emptyContent}
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  function toggleExpand(id: string | number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <TableBody>
      {data.map((row, rowIndex) => {
        const rowId = (row as Record<string, unknown>).id as string | number ?? rowIndex;
        const isExpanded = expandedRows.has(rowId);
        const rowActions = actions?.(row);

        return (
          <Fragment key={rowId}>
            <TableRow
              className={cn(
                onRowClick && "cursor-pointer",
                rowClassName?.(row)
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {expandable && (
                <TableCell className="w-8">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(rowId);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </Button>
                </TableCell>
              )}
              {visibleColumns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.cell
                    ? col.cell(row)
                    : String((row as Record<string, unknown>)[col.key] ?? "")}
                </TableCell>
              ))}
              {hasActions && (
                <TableCell className="text-right">
                  {rowActions && rowActions.length > 0 && (
                    <RowActions actions={rowActions} />
                  )}
                </TableCell>
              )}
            </TableRow>
            {expandable && isExpanded && (
              <TableRow>
                <TableCell colSpan={totalCols} className="bg-muted/30 p-4">
                  {expandable(row)}
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        );
      })}
    </TableBody>
  );
}

function RowActions({ actions }: { actions: ActionDef[] }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center justify-end gap-0.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Tooltip key={action.label}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={cn(action.variant === "destructive" && "text-destructive hover:text-destructive")}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (action.confirm) {
                      if (window.confirm(action.confirm)) action.onClick();
                    } else {
                      action.onClick();
                    }
                  }}
                >
                  {Icon && <Icon className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{action.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
