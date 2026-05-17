"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { FolderOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { DataTable, useLocalTableState, useClientFiltered } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";
import { getCategoryIcon } from "@/lib/category-icons";

interface GlobalCategory {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export default function AdminGlobalCategoriesPage() {
  const [categories, setCategories] = useState<GlobalCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const table = useLocalTableState();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GlobalCategory | null>(null);
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    fetch("/api/admin/global-categories")
      .then((r) => r.json())
      .then((json) => setCategories(json.data ?? []))
      .catch(() => toast.error("Ошибка загрузки данных"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormIcon("");
    setDialogOpen(true);
  }

  function openEdit(cat: GlobalCategory) {
    setEditing(cat);
    setFormName(cat.name);
    setFormIcon(cat.icon);
    setDialogOpen(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setIsSaving(true);
    try {
      const url = editing
        ? `/api/admin/global-categories/${editing.id}`
        : "/api/admin/global-categories";
      const method = editing ? "PATCH" : "POST";
      const body = editing
        ? { name: formName, icon: formIcon }
        : { name: formName, icon: formIcon, sort_order: categories.length + 1 };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(editing ? "Категория обновлена" : "Категория создана");
        setDialogOpen(false);
        load();
      } else {
        const err = await res.json();
        toast.error(err.error?.message ?? "Ошибка");
      }
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить эту категорию?")) return;
    try {
      const res = await fetch(`/api/admin/global-categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Категория удалена");
        load();
      } else {
        const err = await res.json();
        toast.error(err.error?.message ?? "Ошибка удаления");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  const columns: ColumnDef<GlobalCategory>[] = useMemo(() => [
    {
      key: "icon",
      header: "",
      className: "w-12 text-center",
      cell: (row) => {
        const Icon = getCategoryIcon(row.icon);
        return <Icon className="size-5 text-muted-foreground mx-auto" />;
      },
    },
    {
      key: "name",
      header: "Название",
      sortable: true,
      filter: { type: "text" },
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "sort_order",
      header: "Порядок",
      sortable: true,
      className: "text-right tabular-nums text-muted-foreground",
      headerClassName: "text-right",
      cell: (row) => `#${row.sort_order}`,
    },
  ], []);

  const filtered = useClientFiltered(categories, table.state, columns);

  return (
    <div className="page-transition space-y-8 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Категории</h1>
          <p className="mt-1 text-sm text-muted-foreground">Глобальные категории льгот для каталога</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Добавить категорию
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered.filtered}
        total={filtered.total}
        loading={isLoading}
        state={table.state}
        onStateChange={table.setState}
        onReset={table.resetFilters}
        searchable={{ placeholder: "Поиск по названию..." }}
        actions={(c) => [
          { label: "Редактировать", icon: Pencil, onClick: () => openEdit(c) },
          { label: "Удалить", icon: Trash2, onClick: () => handleDelete(c.id), variant: "destructive" as const },
        ]}
        emptyState={{
          icon: FolderOpen,
          title: "Нет категорий",
          description: "Добавьте первую категорию для каталога",
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать категорию" : "Новая категория"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Название</Label>
              <Input
                id="cat-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Например: Спорт и фитнес"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-icon">Иконка (имя lucide)</Label>
              <Input
                id="cat-icon"
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                placeholder="Например: dumbbell"
                className="w-48"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
