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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";

import type { BudgetPolicy, Tenant } from "@/lib/types";

/* -------------------------------------------------------------------------- */

export default function AdminPoliciesPage() {
  const [policies, setPolicies] = useState<BudgetPolicy[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterTenantId, setFilterTenantId] = useState<string>("all");
  const perPage = 20;

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
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (filterTenantId && filterTenantId !== "all")
        params.set("tenant_id", filterTenantId);

      const res = await fetch(`/api/admin/policies?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setPolicies(json.data ?? json);
      setTotal(json.total ?? (json.data ?? json).length);
    } catch {
      toast.error("Не удалось загрузить политики");
    } finally {
      setLoading(false);
    }
  }, [page, filterTenantId]);

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

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">
          Лимиты бюджета по компаниям
        </h1>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Добавить лимит
        </Button>
      </div>

      {/* Filter by company */}
      <div className="max-w-xs">
        <Select
          value={filterTenantId}
          onValueChange={(v) => {
            setFilterTenantId(v);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Все компании" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все компании</SelectItem>
            {tenants.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Компания</TableHead>
              <TableHead className="text-right">Бюджет (баллов)</TableHead>
              <TableHead className="text-center">Активна</TableHead>
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
            ) : policies.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-32 text-center text-muted-foreground"
                >
                  Политики не найдены
                </TableCell>
              </TableRow>
            ) : (
              policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {tenantName(p.tenant_id)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.points_amount.toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={p.is_active}
                      onCheckedChange={() => toggleActive(p)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(p)}
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
