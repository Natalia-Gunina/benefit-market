"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable, useTableState } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";

/* -------------------------------------------------------------------------- */

type OfferingFormat = "online" | "offline";
type OfferingStatus = "draft" | "pending_review" | "published" | "archived";

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  price_points: number;
  category_name: string;
  is_active: boolean;
  is_stackable: boolean;
  format: OfferingFormat;
  cities: string[];
  provider_id?: string;
  provider_name?: string;
  provider_status?: string;
  offering_status?: OfferingStatus;
  created_at: string;
}

interface ProviderOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS: { value: OfferingStatus; label: string }[] = [
  { value: "pending_review", label: "На согласовании" },
  { value: "published", label: "Активна" },
  { value: "archived", label: "В архиве" },
];

const FORMAT_OPTIONS = [
  { value: "online", label: "Онлайн" },
  { value: "offline", label: "Офлайн" },
];

const statusBadgeVariant: Record<
  OfferingStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  pending_review: "outline",
  published: "default",
  archived: "destructive",
};

/* -------------------------------------------------------------------------- */

function StatusBadge({
  item,
  onStatusChange,
}: {
  item: CatalogItem;
  onStatusChange: (item: CatalogItem, status: OfferingStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentStatus = item.offering_status ?? "pending_review";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <Badge
            variant={statusBadgeVariant[currentStatus]}
            className="text-xs hover:ring-2 hover:ring-ring/20 transition-shadow"
          >
            {STATUS_OPTIONS.find((s) => s.value === currentStatus)?.label ?? "Черновик"}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-40 p-1"
        align="center"
        onClick={(e) => e.stopPropagation()}
      >
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={cn(
              "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-muted",
              opt.value === currentStatus && "bg-primary/10 font-medium"
            )}
            onClick={() => {
              onStatusChange(item, opt.value);
              setOpen(false);
            }}
          >
            <Badge variant={statusBadgeVariant[opt.value]} className="text-xs">
              {opt.label}
            </Badge>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */

export default function CatalogPage() {
  const { state, setState, resetFilters } = useTableState({
    pageSize: 20,
    defaultSort: { key: "created_at", direction: "desc" },
  });

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [providers, setProviders] = useState<ProviderOption[]>([]);

  // Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formIsStackable, setFormIsStackable] = useState(false);
  const [formFormat, setFormFormat] = useState<OfferingFormat>("online");
  const [formCities, setFormCities] = useState<string[]>([]);
  const [formCityInput, setFormCityInput] = useState("");

  /* ----- Fetch catalog --------------------------------------------------- */
  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(state.page));
      params.set("per_page", String(state.pageSize));
      if (state.search) params.set("search", state.search);

      if (state.sort) {
        const sortMap: Record<string, string> = {
          "created_at.desc": "newest",
          "created_at.asc": "oldest",
          "price_points.asc": "price_asc",
          "price_points.desc": "price_desc",
          "name.asc": "name_asc",
          "name.desc": "name_desc",
        };
        params.set("sort", sortMap[`${state.sort.key}.${state.sort.direction}`] ?? "newest");
      }

      Object.entries(state.filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });

      const res = await fetch(`/api/admin/catalog?${params}`);
      if (!res.ok) throw new Error("Не удалось загрузить каталог");
      const json = await res.json();
      setItems(json.data?.data ?? []);
      setTotal(json.data?.meta?.total ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка загрузки";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  /* ----- Fetch providers ------------------------------------------------- */
  useEffect(() => {
    fetch("/api/admin/providers?per_page=100")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json) return;
        const arr: ProviderOption[] = json.data?.data ?? json.data ?? [];
        if (Array.isArray(arr)) setProviders(arr);
      })
      .catch(() => {});
  }, []);

  /* ----- Table columns with per-column filters --------------------------- */
  const columns: ColumnDef<CatalogItem>[] = [
    {
      key: "provider_name",
      header: "Провайдер",
      filterKey: "provider_id",
      filter: {
        type: "select",
        options: providers.map((p) => ({ value: p.id, label: p.name })),
      },
      cell: (row) => (
        <span className="text-muted-foreground">{row.provider_name ?? "—"}</span>
      ),
    },
    {
      key: "name",
      header: "Название",
      sortable: true,
      filterKey: "search",
      filter: { type: "text" },
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "category_name",
      header: "Категория",
      filterKey: "category",
      filter: { type: "auto", field: "catalog.category" },
    },
    {
      key: "price_points",
      header: "Цена",
      sortable: true,
      filter: { type: "number" },
      headerClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (row) => row.price_points.toLocaleString("ru-RU"),
    },
    {
      key: "format",
      header: "Формат",
      filter: { type: "select", options: FORMAT_OPTIONS },
      headerClassName: "text-center",
      className: "text-center",
      cell: (row) =>
        row.format === "offline" && row.cities?.length > 0 ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">
                  <Badge variant="outline" className="text-xs">Офлайн</Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {row.cities.join(", ")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : row.format === "offline" ? (
          <Badge variant="outline" className="text-xs">Офлайн</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">Онлайн</Badge>
        ),
    },
    {
      key: "is_stackable",
      header: "Множ.",
      headerClassName: "text-center",
      className: "text-center",
      cell: (row) =>
        row.is_stackable ? (
          <Badge variant="outline" className="text-xs">Можно увеличивать</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">1 шт.</span>
        ),
    },
    {
      key: "offering_status",
      header: "Статус",
      filterKey: "status",
      filter: {
        type: "select",
        options: STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
      },
      headerClassName: "text-center",
      className: "text-center",
      cell: (row) => <StatusBadge item={row} onStatusChange={handleStatusChange} />,
    },
  ];

  /* ----- Actions --------------------------------------------------------- */
  async function handleStatusChange(item: CatalogItem, next: OfferingStatus) {
    if (item.offering_status === next) return;
    try {
      const res = await fetch(`/api/admin/catalog/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error?.message ?? "Не удалось обновить статус");
        return;
      }
      toast.success("Статус обновлён");
      fetchCatalog();
    } catch {
      toast.error("Ошибка сети");
    }
  }

  async function handleDelete(item: CatalogItem) {
    try {
      const res = await fetch(`/api/admin/catalog/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Удалено");
      fetchCatalog();
    } catch {
      toast.error("Не удалось удалить");
    }
  }

  function openEdit(item: CatalogItem) {
    setEditing(item);
    setFormName(item.name);
    setFormDescription(item.description ?? "");
    setFormPrice(String(item.price_points));
    setFormIsStackable(item.is_stackable);
    setFormFormat(item.format ?? "online");
    setFormCities(item.cities ?? []);
    setFormCityInput("");
    setDialogOpen(true);
  }

  function addCity() {
    const v = formCityInput.trim();
    if (!v || formCities.includes(v)) {
      setFormCityInput("");
      return;
    }
    setFormCities([...formCities, v]);
    setFormCityInput("");
  }

  function removeCity(city: string) {
    setFormCities(formCities.filter((c) => c !== city));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;

    if (formFormat === "offline" && formCities.length === 0) {
      toast.error("Укажите хотя бы один город для офлайн-льготы");
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        name: formName,
        description: formDescription,
        base_price_points: Number(formPrice),
        is_stackable: formIsStackable,
        format: formFormat,
        cities: formFormat === "offline" ? formCities : [],
      };

      const res = await fetch(`/api/admin/catalog/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
      toast.success("Обновлено");
      setDialogOpen(false);
      fetchCatalog();
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Каталог льгот</h1>
        <p className="mt-1 text-sm text-muted-foreground">Все льготы, доступные в системе</p>
      </div>

      <DataTable
        columns={columns}
        data={items}
        total={total}
        loading={loading}
        error={error}
        state={state}
        onStateChange={setState}
        onReset={resetFilters}
        searchable={{ placeholder: "Поиск по всем полям..." }}
        actions={(item) => [
          { label: "Редактировать", icon: Pencil, onClick: () => openEdit(item) },
          {
            label: "Удалить",
            icon: Trash2,
            onClick: () => handleDelete(item),
            variant: "destructive",
            confirm: "Удалить эту льготу?",
          },
        ]}
      />

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать льготу</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Цена (баллов)</Label>
              <Input
                type="number"
                min={0}
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-stackable">Множественный выбор</Label>
              <Switch
                id="is-stackable"
                checked={formIsStackable}
                onCheckedChange={setFormIsStackable}
              />
            </div>

            <div className="space-y-2">
              <Label>Формат льготы</Label>
              <Select
                value={formFormat}
                onValueChange={(v) => setFormFormat(v as OfferingFormat)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Онлайн</SelectItem>
                  <SelectItem value="offline">Офлайн</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formFormat === "offline" && (
              <div className="space-y-2">
                <Label>Города доступности</Label>
                <div className="flex gap-2">
                  <Input
                    value={formCityInput}
                    onChange={(e) => setFormCityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCity();
                      }
                    }}
                    placeholder="Например, Москва"
                  />
                  <Button type="button" variant="outline" onClick={addCity}>
                    Добавить
                  </Button>
                </div>
                {formCities.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {formCities.map((city) => (
                      <Badge key={city} variant="secondary" className="gap-1 pr-1">
                        {city}
                        <button
                          type="button"
                          onClick={() => removeCity(city)}
                          className="rounded-full p-0.5 hover:bg-muted"
                          aria-label={`Удалить ${city}`}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
