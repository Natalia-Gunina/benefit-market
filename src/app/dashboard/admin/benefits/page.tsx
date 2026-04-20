"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Search, Loader2, Trash2, X } from "lucide-react";

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
  provider_name?: string;
  provider_status?: string;
  offering_status?: string;
  created_at: string;
}

interface ProviderOption {
  id: string;
  name: string;
  status: string;
}

interface GlobalCategory {
  id: string;
  name: string;
}

/* -------------------------------------------------------------------------- */

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [globalCategories, setGlobalCategories] = useState<GlobalCategory[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("");

  // Provider form
  const [formProviderId, setFormProviderId] = useState<string>("");
  const [formGlobalCategoryId, setFormGlobalCategoryId] = useState("");
  const [formIsStackable, setFormIsStackable] = useState(false);
  const [formFormat, setFormFormat] = useState<OfferingFormat>("online");
  const [formCities, setFormCities] = useState<string[]>([]);
  const [formCityInput, setFormCityInput] = useState("");

  /* ----- Fetch reference data --------------------------------------------- */
  useEffect(() => {
    fetch("/api/admin/global-categories")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => {
        const arr = json.data ?? json;
        if (Array.isArray(arr)) setGlobalCategories(arr);
      })
      .catch(() => {});
    fetch("/api/admin/providers")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => {
        const arr = json.data ?? json;
        if (Array.isArray(arr)) setProviders(arr);
      })
      .catch(() => {});
  }, []);

  /* ----- Fetch catalog --------------------------------------------------- */
  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (search) params.set("search", search);

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
  }, [page, search]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  /* ----- Dialog helpers --------------------------------------------------- */
  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormDescription("");
    setFormPrice("");
    setFormStock("");
    setFormProviderId(providers[0]?.id ?? "");
    setFormGlobalCategoryId(globalCategories[0]?.id ?? "");
    setFormIsStackable(false);
    setFormFormat("online");
    setFormCities([]);
    setFormCityInput("");
    setDialogOpen(true);
  }

  function openEdit(item: CatalogItem) {
    setEditing(item);
    setFormName(item.name);
    setFormDescription(item.description ?? "");
    setFormPrice(String(item.price_points));
    setFormStock("");
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

    if (formFormat === "offline" && formCities.length === 0) {
      toast.error("Укажите хотя бы один город для офлайн-льготы");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
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
      } else {
        if (!formProviderId) {
          toast.error("Выберите провайдера");
          return;
        }

        const body: Record<string, unknown> = {
          provider_id: formProviderId,
          name: formName,
          description: formDescription,
          global_category_id: formGlobalCategoryId || null,
          base_price_points: Number(formPrice),
          stock_limit: formStock ? Number(formStock) : null,
          is_stackable: formIsStackable,
          format: formFormat,
          cities: formFormat === "offline" ? formCities : [],
        };

        const res = await fetch("/api/admin/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error?.message ?? "Не удалось создать");
          return;
        }
        toast.success("Предложение провайдера создано");
      }

      setDialogOpen(false);
      fetchCatalog();
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: CatalogItem) {
    if (!confirm("Удалить этот элемент?")) return;
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
        <h1 className="text-2xl font-heading font-bold">Каталог</h1>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Добавить
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
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
                  Элементы не найдены
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
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
                    <Badge
                      variant={
                        item.offering_status === "published"
                          ? "default"
                          : item.offering_status === "pending_review"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {item.offering_status === "published"
                        ? "Опубликовано"
                        : item.offering_status === "pending_review"
                          ? "На модерации"
                          : item.offering_status === "draft"
                            ? "Черновик"
                            : "Архив"}
                    </Badge>
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
              ))
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактировать" : "Новый элемент каталога"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Provider selector (create only) */}
            {!editing && (
              <div className="space-y-2">
                <Label>Провайдер</Label>
                {providers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Нет доступных провайдеров. Создайте провайдера на вкладке «Провайдеры».
                  </p>
                ) : (
                  <Select value={formProviderId} onValueChange={setFormProviderId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Выберите провайдера" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Common fields */}
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

            {/* Global category (create only) */}
            {!editing && (
              <div className="space-y-2">
                <Label>Глобальная категория</Label>
                <Select value={formGlobalCategoryId} onValueChange={setFormGlobalCategoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {globalCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Price + Stock */}
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label>Лимит (пусто = без лимита)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                />
              </div>
            </div>

            {/* Stackable toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="is-stackable">Множественный выбор</Label>
              <Switch
                id="is-stackable"
                checked={formIsStackable}
                onCheckedChange={setFormIsStackable}
              />
            </div>

            {/* Format */}
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

            {/* Cities (offline only) */}
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
                <p className="text-xs text-muted-foreground">
                  Добавьте все города, в которых льгота доступна офлайн.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
