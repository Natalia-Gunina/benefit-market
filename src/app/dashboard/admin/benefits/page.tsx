"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Search, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

import type { Benefit, BenefitCategory } from "@/lib/types";

/* -------------------------------------------------------------------------- */

export default function BenefitsPage() {
  const [benefits, setBenefits] = useState<
    (Benefit & { category_name?: string })[]
  >([]);
  const [categories, setCategories] = useState<BenefitCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Benefit | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formActive, setFormActive] = useState(true);

  /* ----- Fetch categories ------------------------------------------------- */
  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((json) => setCategories(json.data ?? json))
      .catch(() => {});
  }, []);

  /* ----- Fetch benefits --------------------------------------------------- */
  const fetchBenefits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (search) params.set("search", search);
      if (categoryFilter && categoryFilter !== "all")
        params.set("category_id", categoryFilter);

      const res = await fetch(`/api/admin/benefits?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setBenefits(json.data ?? json);
      setTotal(json.total ?? (json.data ?? json).length);
    } catch {
      toast.error("Не удалось загрузить льготы");
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter]);

  useEffect(() => {
    fetchBenefits();
  }, [fetchBenefits]);

  /* ----- Toggle active ---------------------------------------------------- */
  async function toggleActive(benefit: Benefit) {
    try {
      const res = await fetch(`/api/admin/benefits/${benefit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !benefit.is_active }),
      });
      if (!res.ok) throw new Error();
      setBenefits((prev) =>
        prev.map((b) =>
          b.id === benefit.id ? { ...b, is_active: !b.is_active } : b
        )
      );
      toast.success(
        benefit.is_active ? "Льгота деактивирована" : "Льгота активирована"
      );
    } catch {
      toast.error("Не удалось обновить статус");
    }
  }

  /* ----- Dialog helpers --------------------------------------------------- */
  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormDescription("");
    setFormCategoryId(categories[0]?.id ?? "");
    setFormPrice("");
    setFormStock("");
    setFormActive(true);
    setDialogOpen(true);
  }

  function openEdit(b: Benefit) {
    setEditing(b);
    setFormName(b.name);
    setFormDescription(b.description ?? "");
    setFormCategoryId(b.category_id);
    setFormPrice(String(b.price_points));
    setFormStock(b.stock_limit != null ? String(b.stock_limit) : "");
    setFormActive(b.is_active);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: formName,
        description: formDescription,
        category_id: formCategoryId,
        price_points: Number(formPrice),
        stock_limit: formStock ? Number(formStock) : null,
        is_active: formActive,
      };

      const res = editing
        ? await fetch(`/api/admin/benefits/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/admin/benefits`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (!res.ok) throw new Error();
      toast.success(editing ? "Льгота обновлена" : "Льгота создана");
      setDialogOpen(false);
      fetchBenefits();
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  /* ----- Helpers ---------------------------------------------------------- */
  function categoryName(id: string) {
    return categories.find((c) => c.id === id)?.name ?? "—";
  }

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Каталог льгот</h1>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Добавить льготу
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
          value={categoryFilter}
          onValueChange={(v) => {
            setCategoryFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Все категории" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead className="text-right">Цена (баллов)</TableHead>
              <TableHead className="text-right">Лимит</TableHead>
              <TableHead className="text-center">Активна</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : benefits.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  Льготы не найдены
                </TableCell>
              </TableRow>
            ) : (
              benefits.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>
                    {b.category_name ?? categoryName(b.category_id)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.price_points.toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.stock_limit != null ? b.stock_limit : "\u221E"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={b.is_active}
                      onCheckedChange={() => toggleActive(b)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(b)}
                    >
                      <Pencil className="size-4" />
                    </Button>
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактировать льготу" : "Новая льгота"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="benefit-name">Название</Label>
              <Input
                id="benefit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="benefit-desc">Описание</Label>
              <Textarea
                id="benefit-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="benefit-price">Цена (баллов)</Label>
                <Input
                  id="benefit-price"
                  type="number"
                  min={0}
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="benefit-stock">Лимит (пусто = без лимита)</Label>
                <Input
                  id="benefit-stock"
                  type="number"
                  min={0}
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="benefit-active"
                checked={formActive}
                onCheckedChange={setFormActive}
              />
              <Label htmlFor="benefit-active">Активна</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
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
