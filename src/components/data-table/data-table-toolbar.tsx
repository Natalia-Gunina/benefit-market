"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface DataTableToolbarProps {
  searchable?: {
    placeholder?: string;
    debounceMs?: number;
  };
  searchValue: string;
  onSearchChange: (value: string) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  headerActions?: React.ReactNode;
}

function pluralFilters(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "фильтров";
  if (mod10 === 1) return "фильтр";
  if (mod10 >= 2 && mod10 <= 4) return "фильтра";
  return "фильтров";
}

export function DataTableToolbar({
  searchable,
  searchValue,
  onSearchChange,
  onReset,
  hasActiveFilters,
  activeFilterCount,
  headerActions,
}: DataTableToolbarProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const debounceMs = searchable?.debounceMs ?? 300;

  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  useEffect(() => {
    if (localSearch === searchValue) return;
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [localSearch, debounceMs, onSearchChange, searchValue]);

  function clearSearch() {
    setLocalSearch("");
    onSearchChange("");
  }

  if (!searchable && !headerActions && !hasActiveFilters) return null;

  return (
    <div className="flex items-center gap-3">
      {searchable && (
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={searchable.placeholder ?? "Поиск..."}
            className="pl-9 pr-8"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          {localSearch && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              onClick={clearSearch}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {activeFilterCount > 0 && (
        <button
          onClick={() => {
            setLocalSearch("");
            onReset();
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {activeFilterCount} {pluralFilters(activeFilterCount)}
          <X className="size-3" />
        </button>
      )}

      {headerActions && <div className="ml-auto">{headerActions}</div>}
    </div>
  );
}
