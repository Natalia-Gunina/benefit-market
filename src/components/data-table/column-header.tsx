"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ColumnDef, ColumnFilter, SortState } from "./types";

interface ColumnHeaderProps<T> {
  column: ColumnDef<T>;
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  filterValue: string;
  onFilterChange: (value: string) => void;
}

export function ColumnHeader<T>({
  column,
  sort,
  onSortChange,
  filterValue,
  onFilterChange,
}: ColumnHeaderProps<T>) {
  const [open, setOpen] = useState(false);

  const hasInteraction = column.sortable || column.filter;
  const isSorted = sort?.key === column.key;
  const isFiltered = filterValue !== "" && filterValue !== undefined;

  if (!hasInteraction) {
    return <span>{column.header}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 -mx-1 px-1 py-0.5 rounded-sm transition-colors",
            "hover:bg-muted/80 group"
          )}
        >
          <span className={cn((isFiltered || isSorted) && "text-primary")}>
            {column.header}
          </span>
          <StatusIndicator isSorted={isSorted} isFiltered={isFiltered} sortDir={sort?.direction} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-52 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {column.sortable && (
          <div className="p-1">
            <MenuItem
              icon={<ChevronUp className="size-4" />}
              label="По возрастанию"
              active={isSorted && sort?.direction === "asc"}
              onClick={() => {
                onSortChange({ key: column.key, direction: "asc" });
                if (!column.filter) setOpen(false);
              }}
            />
            <MenuItem
              icon={<ChevronDown className="size-4" />}
              label="По убыванию"
              active={isSorted && sort?.direction === "desc"}
              onClick={() => {
                onSortChange({ key: column.key, direction: "desc" });
                if (!column.filter) setOpen(false);
              }}
            />
          </div>
        )}

        {column.filter && column.sortable && <Separator />}

        {column.filter && (
          <div className="px-2 py-3">
            <FilterSection
              filter={column.filter}
              value={filterValue}
              onChange={(v) => {
                onFilterChange(v);
                setOpen(false);
              }}
              onReset={() => {
                onFilterChange("");
                setOpen(false);
              }}
            />
          </div>
        )}

        {(isSorted || isFiltered) && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs w-full text-muted-foreground"
              onClick={() => {
                if (isSorted) onSortChange(null);
                if (isFiltered) onFilterChange("");
                setOpen(false);
              }}
            >
              Сбросить
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function StatusIndicator({
  isSorted,
  isFiltered,
  sortDir,
}: {
  isSorted: boolean;
  isFiltered: boolean;
  sortDir?: "asc" | "desc";
}) {
  const Icon = isSorted && sortDir === "asc" ? ChevronUp : ChevronDown;
  const isActive = isSorted || isFiltered;

  return (
    <Icon
      className={cn(
        "size-3.5",
        isActive
          ? "text-primary"
          : "text-muted-foreground/40 group-hover:text-muted-foreground"
      )}
    />
  );
}

function MenuItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm transition-colors",
        "hover:bg-muted",
        active && "bg-primary/10 text-primary font-medium"
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterSection({
  filter,
  value,
  onChange,
  onReset,
}: {
  filter: ColumnFilter;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  if (filter.type === "text") {
    return <TextFilter value={value} onChange={onChange} onReset={onReset} />;
  }
  if (filter.type === "select") {
    return (
      <SelectFilter
        options={filter.options}
        value={value}
        onChange={onChange}
        onReset={onReset}
      />
    );
  }
  if (filter.type === "auto") {
    return (
      <AutoFilter
        field={filter.field}
        value={value}
        onChange={onChange}
        onReset={onReset}
      />
    );
  }
  if (filter.type === "number") {
    return <NumberFilter value={value} onChange={onChange} onReset={onReset} />;
  }
  if (filter.type === "date-range") {
    return <DateRangeFilter value={value} onChange={onChange} onReset={onReset} />;
  }
  return null;
}

/* ---------- Text filter ---------- */

function TextFilter({
  value,
  onChange,
  onReset,
}: {
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const [local, setLocal] = useState(value);

  return (
    <div className="space-y-2">
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Содержит..."
        className="h-8 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") onChange(local);
        }}
        autoFocus
      />
      <FilterActions
        hasValue={!!local}
        onApply={() => onChange(local)}
        onReset={() => {
          setLocal("");
          onReset();
        }}
      />
    </div>
  );
}

/* ---------- Select filter (static options) ---------- */

function SelectFilter({
  options,
  value,
  onChange,
  onReset,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const selected = useMemo(() => new Set(value ? value.split(",") : []), [value]);
  const [localSelected, setLocalSelected] = useState(selected);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  function toggle(val: string) {
    const next = new Set(localSelected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setLocalSelected(next);
  }

  return (
    <div className="space-y-2">
      {options.length > 6 && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Найти..."
          className="h-7 text-xs"
          autoFocus
        />
      )}
      <CheckboxList
        items={filtered}
        selected={localSelected}
        onToggle={toggle}
      />
      <FilterActions
        hasValue={localSelected.size > 0}
        onApply={() => onChange(Array.from(localSelected).join(","))}
        onReset={() => {
          setLocalSelected(new Set());
          onReset();
        }}
      />
    </div>
  );
}

/* ---------- Auto filter (loads distinct from API) ---------- */

function AutoFilter({
  field,
  value,
  onChange,
  onReset,
}: {
  field: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/admin/distinct?field=${encodeURIComponent(field)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data?.values) setOptions(json.data.values);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [field]);

  const selected = useMemo(() => new Set(value ? value.split(",") : []), [value]);
  const [localSelected, setLocalSelected] = useState(selected);

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  function toggle(val: string) {
    const next = new Set(localSelected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setLocalSelected(next);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {options.length > 6 && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Найти..."
          className="h-7 text-xs"
          autoFocus
        />
      )}
      <CheckboxList
        items={filtered.map((v) => ({ value: v, label: v }))}
        selected={localSelected}
        onToggle={toggle}
      />
      <FilterActions
        hasValue={localSelected.size > 0}
        onApply={() => onChange(Array.from(localSelected).join(","))}
        onReset={() => {
          setLocalSelected(new Set());
          onReset();
        }}
      />
    </div>
  );
}

/* ---------- Number filter ---------- */

function NumberFilter({
  value,
  onChange,
  onReset,
}: {
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const [from, to] = useMemo(() => {
    if (!value) return ["", ""];
    const parts = value.split("~");
    return [parts[0] ?? "", parts[1] ?? ""];
  }, [value]);

  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  function apply() {
    if (!localFrom && !localTo) onChange("");
    else onChange(`${localFrom}~${localTo}`);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          value={localFrom}
          onChange={(e) => setLocalFrom(e.target.value)}
          placeholder="От"
          className="h-8 text-sm"
          autoFocus
        />
        <Input
          type="number"
          value={localTo}
          onChange={(e) => setLocalTo(e.target.value)}
          placeholder="До"
          className="h-8 text-sm"
          onKeyDown={(e) => e.key === "Enter" && apply()}
        />
      </div>
      <FilterActions
        hasValue={!!localFrom || !!localTo}
        onApply={apply}
        onReset={() => {
          setLocalFrom("");
          setLocalTo("");
          onReset();
        }}
      />
    </div>
  );
}

/* ---------- Date range filter ---------- */

function DateRangeFilter({
  value,
  onChange,
  onReset,
}: {
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const [from, to] = useMemo(() => {
    if (!value) return ["", ""];
    const parts = value.split("~");
    return [parts[0] ?? "", parts[1] ?? ""];
  }, [value]);

  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  function apply() {
    if (!localFrom && !localTo) onChange("");
    else onChange(`${localFrom}~${localTo}`);
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <Input
          type="date"
          value={localFrom}
          onChange={(e) => setLocalFrom(e.target.value)}
          className="h-8 text-sm"
          autoFocus
        />
        <Input
          type="date"
          value={localTo}
          onChange={(e) => setLocalTo(e.target.value)}
          className="h-8 text-sm"
          onKeyDown={(e) => e.key === "Enter" && apply()}
        />
      </div>
      <FilterActions
        hasValue={!!localFrom || !!localTo}
        onApply={apply}
        onReset={() => {
          setLocalFrom("");
          setLocalTo("");
          onReset();
        }}
      />
    </div>
  );
}

/* ---------- Shared ---------- */

function CheckboxList({
  items,
  selected,
  onToggle,
}: {
  items: { value: string; label: string }[];
  selected: Set<string>;
  onToggle: (val: string) => void;
}) {
  return (
    <div className="max-h-48 overflow-y-auto space-y-0.5">
      {items.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
        >
          <Checkbox
            checked={selected.has(opt.value)}
            onCheckedChange={() => onToggle(opt.value)}
          />
          <span className="truncate">{opt.label}</span>
        </label>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground py-2 text-center">Нет данных</p>
      )}
    </div>
  );
}

function FilterActions({ onApply }: { onApply: () => void; hasValue?: boolean; onReset?: () => void }) {
  return (
    <div className="pt-1">
      <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={onApply}>
        Применить
      </Button>
    </div>
  );
}
