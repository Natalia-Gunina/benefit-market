"use client";

import { useRef, useState } from "react";
import type { BenefitCategory } from "@/lib/types";
import {
  X,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getCategoryIcon } from "@/lib/category-icons";

interface CategoryFilterProps {
  categories: BenefitCategory[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

export function CategoryFilter({
  categories,
  selectedIds,
  onChange,
}: CategoryFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  const filtered = query.trim()
    ? sorted.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : sorted;

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
    setQuery("");
  };

  const removeTag = (id: string) => {
    const next = new Set(selectedIds);
    next.delete(id);
    onChange(next);
  };

  const selectedCategories = sorted.filter((c) => selectedIds.has(c.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex min-h-[36px] w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setTimeout(() => inputRef.current?.focus(), 0)}
        >
          {selectedCategories.length > 0 ? (
            <div className="flex flex-1 items-center gap-1 overflow-hidden">
              {selectedCategories.slice(0, 2).map((cat) => {
                const Icon = getCategoryIcon(cat.icon);
                return (
                  <Badge
                    key={cat.id}
                    variant="secondary"
                    className="gap-1 pr-1 text-xs shrink-0"
                  >
                    <Icon className="size-3" />
                    {cat.name}
                    <span
                      role="button"
                      className="ml-0.5 rounded-sm p-0.5 hover:bg-muted-foreground/20 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTag(cat.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          removeTag(cat.id);
                        }
                      }}
                    >
                      <X className="size-2.5" />
                    </span>
                  </Badge>
                );
              })}
              {selectedCategories.length > 2 && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  +{selectedCategories.length - 2}
                </Badge>
              )}
            </div>
          ) : (
            <span className="flex-1 text-left text-muted-foreground">
              Фильтр по категории...
            </span>
          )}
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-0">
        <div className="border-b px-3 py-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск категории..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Ничего не найдено
            </p>
          ) : (
            filtered.map((cat) => {
              const Icon = getCategoryIcon(cat.icon);
              const selected = selectedIds.has(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggle(cat.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  <div
                    className={`flex size-4 items-center justify-center rounded-sm border transition-colors ${
                      selected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-input"
                    }`}
                  >
                    {selected && <Check className="size-3" />}
                  </div>
                  <Icon className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 text-left">{cat.name}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
