"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

import { DataTable, useTableState } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";
import type { BudgetPolicy, Tenant } from "@/lib/types";

/* -------------------------------------------------------------------------- */

export default function AdminPoliciesPage() {
  const { state, setState, resetFilters } = useTableState({ pageSize: 20 });

  const [policies, setPolicies] = useState<BudgetPolicy[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [formPoints, setFormPoints] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formTenantId, setFormTenantId] = useState("");

  /* ----- Fetch tenants ------------------------------------------------------ */
  useEffect(() => {
    fetch("/api/admin/tenants")
      .then((r) => r.json())
      .then((json) => setTenants(json.data ?? json))
      .catch(() => {});
  }, []);

  /* ----- Fetch ------------------------------------------------------------ */
  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(state.page));
      params.set("per_page", String(state.pageSize));

      Object.entries(state.filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });

      const res = await fetch(`/api/admin/policies?${params}`);
      if (!res.ok) throw new Error("Не удалось загрузить политики");
      const json = await res.json();
      setPolicies(json.data ?? []);
      setTotal(json.total ?? (json.data ?? []).length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка загрузки";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  /* ----- Toggle active ---------------------------------------------------- */
  async function toggleActive(policy: BudgetPolicy) {
    try {
      const res = await fetch(`/api/admin/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !policy.is_active }),
      });
      if (!res.ok) throw new Error();
      setPolicies((prev) =>
        prev.map((p) =>
          p.id === policy.id ? { ...p, is_active: !p.is_active } : p
        )
      );
      toast.success(
        policy.is_active
          ? "Политика деактивирована"
          : "Политика активирована"
      );
    } catch {
      toast.error("Не удалось обновить статус");
    }
  }

  /* ----- Dialog helpers --------------------------------------------------- */
  function openCreate() {
    setEditing(null);
    setFormPoints("");
    setFormActive(true);
    setFormTenantId(tenants[0]?.id ?? "");
    setDialogOpen(true);
  }

  function openEdit(p: BudgetPolicy) {
    setEditing(p);
    setFormPoints(String(p.points_amount));
    setFormActive(p.is_active);
    setFormTenantId(p.tenant_id);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        points_amount: Number(formPoints),
        is_active: formActive,
      };

      if (!editing) {
        body.tenant_id = formTenantId;
      }

      const res = editing
        ? await fetch(`/api/admin/policies/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/admin/policies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (!res.ok) throw new Error();
      toast.success(editing ? "Политика обновлена" : "Политика создана");
      setDialogOpen(false);
      fetchPolicies();
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  /* ----- Display helpers -------------------------------------------------- */
  function tenantName(id: string) {
    return tenants.find((t) => t.id === id)?.name ?? "—";
  }

  /* ----- Columns ---------------------------------------------------------- */
  const tenantOptions = tenants.map((t) => ({ value: t.id, label: t.name }));

  const columns: ColumnDef<BudgetPolicy>[] = [
    {
      key: "tenant_id",
      header: "Компания",
      filter: { type: "select", options: tenantOptions },
      filterKey: "tenant_id",
      cell: (row) => (
        <span className="font-medium">{tenantName(row.tenant_id)}</span>
      ),
    },
    {
      key: "points_amount",
      header: "Бюджет (баллов)",
      headerClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (row) => row.points_amount.toLocaleString("ru-RU"),
    },
    {
      key: "is_active",
      header: "Активна",
      headerClassName: "text-center",
      className: "text-center",
      cell: (row) => (
        <Switch
          checked={row.is_active}
          onCheckedChange={() => toggleActive(row)}
        />
      ),
    },
  ];

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-8 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Лимиты бюджета</h1>
          <p className="mt-1 text-sm text-muted-foreground">Бюджетные ограничения по компаниям-клиентам</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Добавить лимит
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={policies}
        total={total}
        loading={loading}
        error={error}
        state={state}
        onStateChange={setState}
        onReset={resetFilters}
        actions={(p) => [
          { label: "Редактировать", icon: Pencil, onClick: () => openEdit(p) },
        ]}
      />

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактировать лимит" : "Новый лимит бюджета"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tenant selector — only for create */}
            {!editing && (
              <div className="space-y-2">
                <Label>Компания</Label>
                <Select value={formTenantId} onValueChange={setFormTenantId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите компанию" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="policy-points">Бюджет (баллов)</Label>
              <Input
                id="policy-points"
                type="number"
                min={0}
                value={formPoints}
                onChange={(e) => setFormPoints(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="policy-active"
                checked={formActive}
                onCheckedChange={setFormActive}
              />
              <Label htmlFor="policy-active">Активна</Label>
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
