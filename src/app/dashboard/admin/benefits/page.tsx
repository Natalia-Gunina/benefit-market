"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Search, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

import type { BenefitCategory } from "@/lib/types";

/* -------------------------------------------------------------------------- */

interface CatalogItem {
  id: string;
  source: "internal" | "provider";
  name: string;
  description: string;
  price_points: number;
  category_name: string;
  is_active: boolean;
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
  const [categories, setCategories] = useState<BenefitCategory[]>([]);
  const [globalCategories, setGlobalCategories] = useState<GlobalCategory[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogSource, setDialogSource] = useState<"internal" | "provider">("internal");

  // Internal form
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formActive, setFormActive] = useState(true);

  // Provider form
  const [formProviderId, setFormProviderId] = useState<string>("new");
  const [formNewProviderName, setFormNewProviderName] = useState("");
  const [formNewProviderSlug, setFormNewProviderSlug] = useState("");
  const [formNewProviderEmail, setFormNewProviderEmail] = useState("");
  const [formGlobalCategoryId, setFormGlobalCategoryId] = useState("");

  /* ----- Fetch reference data --------------------------------------------- */
  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((json) => setCategories(json.data ?? json))
      .catch(() => {});
    fetch("/api/admin/global-categories")
      .then((r) => r.json())
      .then((json) => setGlobalCategories(json.data ?? json))
      .catch(() => {});
    fetch("/api/admin/providers")
      .then((r) => r.json())
      .then((json) => setProviders(json.data ?? json))
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
      if (sourceFilter !== "all") params.set("source", sourceFilter);

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
  }, [page, search, sourceFilter]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  /* ----- Dialog helpers --------------------------------------------------- */
  function openCreate() {
    setEditing(null);
    setDialogSource("internal");
    setFormName("");
    setFormDescription("");
    setFormCategoryId(categories[0]?.id ?? "");
    setFormPrice("");
    setFormStock("");
    setFormActive(true);
    setFormProviderId("new");
    setFormNewProviderName("");
    setFormNewProviderSlug("");
    setFormNewProviderEmail("");
    setFormGlobalCategoryId(globalCategories[0]?.id ?? "");
    setDialogOpen(true);
  }

  function openEdit(item: CatalogItem) {
    setEditing(item);
    setDialogSource(item.source);
    setFormName(item.name);
    setFormDescription(item.description ?? "");
    setFormPrice(String(item.price_points));
    setFormStock("");
    setFormActive(item.is_active);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const updates: Record<string, unknown> = {
          source: editing.source,
          name: formName,
          description: formDescription,
        };
        if (editing.source === "internal") {
          updates.price_points = Number(formPrice);
          updates.is_active = formActive;
        } else {
          updates.base_price_points = Number(formPrice);
        }

        const res = await fetch(`/api/admin/catalog/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error();
        toast.success("Обновлено");
      } else if (dialogSource === "internal") {
        const res = await fetch("/api/admin/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "internal",
            name: formName,
            description: formDescription,
            category_id: formCategoryId,
            price_points: Number(formPrice),
            stock_limit: formStock ? Number(formStock) : null,
            is_active: formActive,
          }),
        });
        if (!res.ok) throw new Error();
        toast.success("Льгота создана");
      } else {
        const body: Record<string, unknown> = {
          source: "provider",
          name: formName,
          description: formDescription,
          global_category_id: formGlobalCategoryId || null,
          base_price_points: Number(formPrice),
          stock_limit: formStock ? Number(formStock) : null,
        };

        if (formProviderId === "new") {
          body.new_provider = {
            name: formNewProviderName,
            slug: formNewProviderSlug,
            contact_email: formNewProviderEmail,
          };
        } else {
          body.provider_id = formProviderId;
        }

        const res = await fetch("/api/admin/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
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
      const res = await fetch(`/api/admin/catalog/${item.id}?source=${item.source}`, {
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
        <Select
          value={sourceFilter}
          onValueChange={(v) => {
            setSourceFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Все источники" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все источники</SelectItem>
            <SelectItem value="internal">Внутренние</SelectItem>
            <SelectItem value="provider">Провайдерские</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Тип</TableHead>
              <TableHead>Провайдер</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead className="text-right">Цена</TableHead>
              <TableHead className="text-center">Статус</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Элементы не найдены
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={`${item.source}-${item.id}`}>
                  <TableCell>
                    <Badge variant={item.source === "internal" ? "secondary" : "outline"}>
                      {item.source === "internal" ? "Внутр." : "Провайдер"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.provider_name ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category_name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.price_points.toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.source === "internal" ? (
                      <Badge variant={item.is_active ? "default" : "secondary"}>
                        {item.is_active ? "Активна" : "Неактивна"}
                      </Badge>
                    ) : (
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
                    )}
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

          {!editing && (
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                variant={dialogSource === "internal" ? "default" : "outline"}
                size="sm"
                onClick={() => setDialogSource("internal")}
              >
                Внутренняя льгота
              </Button>
              <Button
                type="button"
                variant={dialogSource === "provider" ? "default" : "outline"}
                size="sm"
                onClick={() => setDialogSource("provider")}
              >
                Льгота провайдера
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Provider-specific fields */}
            {dialogSource === "provider" && !editing && (
              <>
                <div className="space-y-2">
                  <Label>Провайдер</Label>
                  <Select value={formProviderId} onValueChange={setFormProviderId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Выберите провайдера" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">+ Новый провайдер</SelectItem>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formProviderId === "new" && (
                  <div className="space-y-3 rounded-md border p-3">
                    <p className="text-sm font-medium text-muted-foreground">Новый провайдер</p>
                    <div className="space-y-2">
                      <Label>Название</Label>
                      <Input
                        value={formNewProviderName}
                        onChange={(e) => setFormNewProviderName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug</Label>
                      <Input
                        value={formNewProviderSlug}
                        onChange={(e) => setFormNewProviderSlug(e.target.value)}
                        placeholder="my-provider"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={formNewProviderEmail}
                        onChange={(e) => setFormNewProviderEmail(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </>
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

            {/* Category */}
            {dialogSource === "internal" && !editing && (
              <div className="space-y-2">
                <Label>Категория</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {dialogSource === "provider" && !editing && (
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

            {/* Active toggle (internal only) */}
            {dialogSource === "internal" && (
              <div className="flex items-center gap-3">
                <Switch
                  checked={formActive}
                  onCheckedChange={setFormActive}
                />
                <Label>Активна</Label>
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
