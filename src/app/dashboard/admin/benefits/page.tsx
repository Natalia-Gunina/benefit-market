"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Search, Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";

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

type SortKey =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc";

const STATUS_OPTIONS: { value: OfferingStatus; label: string }[] = [
  { value: "pending_review", label: "На согласовании" },
  { value: "published", label: "Активна" },
  { value: "archived", label: "В архиве" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
  { value: "price_asc", label: "Цена: по возрастанию" },
  { value: "price_desc", label: "Цена: по убыванию" },
  { value: "name_asc", label: "Название А–Я" },
  { value: "name_desc", label: "Название Я–А" },
];

const statusBadgeVariant: Record<OfferingStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  pending_review: "outline",
  published: "default",
  archived: "destructive",
};

/* -------------------------------------------------------------------------- */

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [providers, setProviders] = useState<ProviderOption[]>([]);

  // Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields (edit-only)
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
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        sort,
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (formatFilter !== "all") params.set("format", formatFilter);
      if (providerFilter !== "all") params.set("provider_id", providerFilter);

      const res = await fetch(`/api/admin/catalog?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(json.data?.data ?? []);
      setTotal(json.data?.meta?.total ?? 0);
    } catch {
      toast.error("Не удалось загрузить каталог");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, formatFilter, providerFilter, sort]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  /* ----- Fetch providers for filter dropdown ----------------------------- */
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

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setFormatFilter("all");
    setProviderFilter("all");
    setSort("newest");
    setPage(1);
  }

  const filtersActive =
    search !== "" ||
    statusFilter !== "all" ||
    formatFilter !== "all" ||
    providerFilter !== "all" ||
    sort !== "newest";

  /* ----- Dialog helpers --------------------------------------------------- */
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
    if (!v) return;
    if (formCities.includes(v)) {
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
    if (!confirm("Удалить эту льготу?")) return;
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

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Каталог льгот</h1>
      </div>

      {/* Filters + sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]" aria-label="Статус">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={formatFilter}
          onValueChange={(v) => {
            setFormatFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]" aria-label="Формат">
            <SelectValue placeholder="Формат" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все форматы</SelectItem>
            <SelectItem value="online">Онлайн</SelectItem>
            <SelectItem value="offline">Офлайн</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={providerFilter}
          onValueChange={(v) => {
            setProviderFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]" aria-label="Провайдер">
            <SelectValue placeholder="Провайдер" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все провайдеры</SelectItem>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v as SortKey);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[210px]" aria-label="Сортировка">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Сбросить
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Провайдер</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead className="text-right">Цена</TableHead>
              <TableHead className="text-center">Формат</TableHead>
              <TableHead className="text-center">Множественный выбор</TableHead>
              <TableHead className="text-center">Статус</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  Льготы не найдены
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const currentStatus = item.offering_status ?? "pending_review";
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">
                      {item.provider_name ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category_name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.price_points.toLocaleString("ru-RU")}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.format === "offline" ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <Badge variant="outline" className="text-xs">Офлайн</Badge>
                          {item.cities && item.cities.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {item.cities.join(", ")}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Онлайн</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.is_stackable ? (
                        <Badge variant="outline" className="text-xs">Можно увеличивать</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">1 шт.</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={currentStatus}
                        onValueChange={(v) =>
                          handleStatusChange(item, v as OfferingStatus)
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-[160px] mx-auto"
                          aria-label="Статус"
                        >
                          <SelectValue>
                            <Badge
                              variant={statusBadgeVariant[currentStatus]}
                              className="text-xs"
                            >
                              {STATUS_OPTIONS.find((s) => s.value === currentStatus)?.label ??
                                "Черновик"}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => openEdit(item)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(item)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {!loading && total > perPage && (
          <DataTablePagination
            page={page}
            per_page={perPage}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>

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
                      <Badge
                        key={city}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
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
