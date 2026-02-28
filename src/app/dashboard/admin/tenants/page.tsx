"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Search, Loader2 } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";

import type { Tenant } from "@/lib/types";

/* -------------------------------------------------------------------------- */

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDomain, setFormDomain] = useState("");

  /* ----- Fetch ------------------------------------------------------------ */
  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/tenants?${params}`);
      if (!res.ok) throw new Error("Ошибка загрузки");
      const json = await res.json();
      setTenants(json.data ?? json);
      setTotal(json.total ?? (json.data ?? json).length);
    } catch {
      toast.error("Не удалось загрузить список компаний");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  /* ----- Dialog helpers --------------------------------------------------- */
  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormDomain("");
    setDialogOpen(true);
  }

  function openEdit(tenant: Tenant) {
    setEditing(tenant);
    setFormName(tenant.name);
    setFormDomain(tenant.domain);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name: formName, domain: formDomain };
      const res = editing
        ? await fetch(`/api/admin/tenants/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/admin/tenants`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (!res.ok) throw new Error();
      toast.success(editing ? "Компания обновлена" : "Компания создана");
      setDialogOpen(false);
      fetchTenants();
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Управление компаниями</h1>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Добавить компанию
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию или домену..."
          className="pl-9"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Домен</TableHead>
              <TableHead className="text-right">Дата создания</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : tenants.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-32 text-center text-muted-foreground"
                >
                  Компании не найдены
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.domain}</TableCell>
                  <TableCell className="text-right">
                    {new Date(t.created_at).toLocaleDateString("ru-RU")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(t)}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактировать компанию" : "Новая компания"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Название</Label>
              <Input
                id="tenant-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-domain">Домен</Label>
              <Input
                id="tenant-domain"
                value={formDomain}
                onChange={(e) => setFormDomain(e.target.value)}
                placeholder="example.com"
                required
              />
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
