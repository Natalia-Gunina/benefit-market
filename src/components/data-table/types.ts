import type { LucideIcon } from "lucide-react";

export type ColumnFilter =
  | { type: "text" }
  | { type: "select"; options: { value: string; label: string }[] }
  | { type: "auto"; field: string }
  | { type: "number" }
  | { type: "date-range" };

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  filter?: ColumnFilter;
  filterKey?: string;
  cell?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  hidden?: boolean;
  width?: string;
}

export interface SortState {
  key: string;
  direction: "asc" | "desc";
}

export interface TableState {
  page: number;
  pageSize: number;
  search: string;
  sort: SortState | null;
  filters: Record<string, string>;
}

export interface ActionDef {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive";
  confirm?: string;
}
