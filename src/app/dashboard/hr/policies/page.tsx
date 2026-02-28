"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTablePagination } from "@/components/shared/data-table-pagination";

import type { BudgetPolicy, BudgetPeriod } from "@/lib/types";

/* -------------------------------------------------------------------------- */

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  monthly: "Ежемесячно",
  quarterly: "Ежеквартально",
  yearly: "Ежегодно",
};

function formatFilter(f: Record<string, unknown>) {
  const parts: string[] = [];
  if (Array.isArray(f?.grade) && f.grade.length)
    parts.push(`Грейд: ${(f.grade as string[]).join(", ")}`);
  if (Array.isArray(f?.grades) && f.grades.length)
    parts.push(`Грейд: ${(f.grades as string[]).join(", ")}`);
  if (Array.isArray(f?.location) && f.location.length)
    parts.push(`Локация: ${(f.location as string[]).join(", ")}`);
  if (Array.isArray(f?.legal_entity) && f.legal_entity.length)
    parts.push(`Юрлицо: ${(f.legal_entity as string[]).join(", ")}`);
  return parts.length ? parts.join(" | ") : "Все сотрудники";
}

/* -------------------------------------------------------------------------- */
/* Edit form state                                                            */
/* -------------------------------------------------------------------------- */

interface PolicyFormData {
  name: string;
  points_amount: number;
  period: BudgetPeriod;
  is_active: boolean;
  filter_grades: string;
  filter_locations: string;
  filter_legal_entities: string;
}

function policyToForm(p: BudgetPolicy): PolicyFormData {
  const f = (p.target_filter ?? {}) as Record<string, unknown>;
  const grades = (f.grade ?? f.grades ?? []) as string[];
  const locations = (f.location ?? []) as string[];
  const entities = (f.legal_entity ?? []) as string[];
  return {
    name: p.name,
    points_amount: p.points_amount,
    period: p.period,
    is_active: p.is_active,
    filter_grades: grades.join(", "),
    filter_locations: locations.join(", "),
    filter_legal_entities: entities.join(", "),
  };
}

function formToPayload(form: PolicyFormData) {
  const split = (s: string) =>
    s
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

  const target_filter: Record<string, string[]> = {};
  const grades = split(form.filter_grades);
  if (grades.length) target_filter.grade = grades;
  const locs = split(form.filter_locations);
  if (locs.length) target_filter.location = locs;
  const ents = split(form.filter_legal_entities);
  if (ents.length) target_filter.legal_entity = ents;

  return {
    name: form.name,
    points_amount: form.points_amount,
    period: form.period,
    is_active: form.is_active,
    target_filter,
  };
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function HrPoliciesPage() {
  const [policies, setPolicies] = useState<BudgetPolicy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Edit dialog state
  const [editingPolicy, setEditingPolicy] = useState<BudgetPolicy | null>(null);
  const [form, setForm] = useState<PolicyFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
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
  }, [page]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  function openEditDialog(policy: BudgetPolicy) {
    setEditingPolicy(policy);
    setForm(policyToForm(policy));
  }

  function closeEditDialog() {
    setEditingPolicy(null);
    setForm(null);
  }

  async function handleSave() {
    if (!editingPolicy || !form) return;

    if (!form.name.trim()) {
      toast.error("Название не может быть пустым");
      return;
    }
    if (form.points_amount < 0) {
      toast.error("Сумма баллов не может быть отрицательной");
      return;
    }

    setIsSaving(true);
    try {
      const payload = formToPayload(form);
      const res = await fetch(`/api/admin/policies/${editingPolicy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error?.message ?? "Не удалось сохранить изменения");
        return;
      }

      toast.success("Политика обновлена");
      closeEditDialog();
      await fetchPolicies();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Бюджетные политики</h1>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead className="text-right">Баллов</TableHead>
              <TableHead>Период</TableHead>
              <TableHead>Фильтр группы</TableHead>
              <TableHead className="text-center">Статус</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : policies.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  Политики не найдены
                </TableCell>
              </TableRow>
            ) : (
              policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.points_amount.toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {PERIOD_LABELS[p.period] ?? p.period}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                    {formatFilter(p.target_filter)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Активна" : "Неактивна"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => openEditDialog(p)}
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

      {/* ---- Edit Policy Dialog ---- */}
      <Dialog open={!!editingPolicy} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактировать политику</DialogTitle>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="policy-name">Название</Label>
                <Input
                  id="policy-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Points amount */}
              <div className="space-y-2">
                <Label htmlFor="policy-points">Сумма баллов</Label>
                <Input
                  id="policy-points"
                  type="number"
                  min={0}
                  value={form.points_amount}
                  onChange={(e) =>
                    setForm({ ...form, points_amount: Number(e.target.value) || 0 })
                  }
                />
              </div>

              {/* Period */}
              <div className="space-y-2">
                <Label>Период</Label>
                <Select
                  value={form.period}
                  onValueChange={(v) => setForm({ ...form, period: v as BudgetPeriod })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Ежемесячно</SelectItem>
                    <SelectItem value="quarterly">Ежеквартально</SelectItem>
                    <SelectItem value="yearly">Ежегодно</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filters */}
              <div className="space-y-2">
                <Label htmlFor="policy-grades">Грейды (через запятую)</Label>
                <Input
                  id="policy-grades"
                  placeholder="Junior, Middle, Senior"
                  value={form.filter_grades}
                  onChange={(e) => setForm({ ...form, filter_grades: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="policy-locations">Локации (через запятую)</Label>
                <Input
                  id="policy-locations"
                  placeholder="Москва, Санкт-Петербург"
                  value={form.filter_locations}
                  onChange={(e) =>
                    setForm({ ...form, filter_locations: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="policy-entities">Юрлица (через запятую)</Label>
                <Input
                  id="policy-entities"
                  placeholder="ООО Рога, ООО Копыта"
                  value={form.filter_legal_entities}
                  onChange={(e) =>
                    setForm({ ...form, filter_legal_entities: e.target.value })
                  }
                />
              </div>

              {/* Active switch */}
              <div className="flex items-center justify-between">
                <Label htmlFor="policy-active">Активна</Label>
                <Switch
                  id="policy-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, is_active: checked })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={isSaving}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Сохраняем...
                </>
              ) : (
                "Сохранить"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
