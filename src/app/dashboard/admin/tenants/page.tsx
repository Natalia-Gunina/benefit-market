"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Loader2 } from "lucide-react";

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

import { DataTable, useTableState } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";
import type { Tenant } from "@/lib/types";

/* -------------------------------------------------------------------------- */

const columns: ColumnDef<Tenant>[] = [
  {
    key: "name",
    header: "Название",
    sortable: true,
    cell: (row) => <span className="font-medium">{row.name}</span>,
  },
  {
    key: "domain",
    header: "Домен",
  },
  {
    key: "created_at",
    header: "Дата создания",
    className: "text-right",
    headerClassName: "text-right",
    cell: (row) => new Date(row.created_at).toLocaleDateString("ru-RU"),
  },
];

/* -------------------------------------------------------------------------- */

export default function TenantsPage() {
  const { state, setState, resetFilters } = useTableState({ pageSize: 20 });

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(state.page));
      params.set("per_page", String(state.pageSize));
      if (state.search) params.set("search", state.search);
      if (state.sort) {
        params.set("sort_by", state.sort.key);
        params.set("sort_dir", state.sort.direction);
      }

      Object.entries(state.filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });

      const res = await fetch(`/api/admin/tenants?${params}`);
      if (!res.ok) throw new Error("Ошибка загрузки");
      const json = await res.json();
      setTenants(json.data ?? []);
      setTotal(json.meta?.total ?? json.total ?? (json.data ?? []).length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка загрузки";
      setError(msg);
      toast.error("Не удалось загрузить список компаний-клиентов");
    } finally {
      setLoading(false);
    }
  }, [state]);

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
      toast.success(editing ? "Компания-клиент обновлена" : "Компания-клиент создана");
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
    <div className="page-transition space-y-8 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Компании-клиенты</h1>
          <p className="mt-1 text-sm text-muted-foreground">Организации, подключённые к платформе</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Добавить компанию
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={tenants}
        total={total}
        loading={loading}
        error={error}
        state={state}
        onStateChange={setState}
        onReset={resetFilters}
        searchable={{ placeholder: "Поиск по названию или домену..." }}
        actions={(t) => [
          { label: "Редактировать", icon: Pencil, onClick: () => openEdit(t) },
        ]}
      />

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактировать компанию-клиента" : "Новая компания-клиент"}
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
