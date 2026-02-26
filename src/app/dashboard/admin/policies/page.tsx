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
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/shared/data-table-pagination";

import type { BudgetPolicy, BudgetPeriod } from "@/lib/types";

/* -------------------------------------------------------------------------- */

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  monthly: "Ежемесячно",
  quarterly: "Ежеквартально",
  yearly: "Ежегодно",
};

export default function AdminPoliciesPage() {
  const [policies, setPolicies] = useState<BudgetPolicy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [formName, setFormName] = useState("");
  const [formPoints, setFormPoints] = useState("");
  const [formPeriod, setFormPeriod] = useState<BudgetPeriod>("monthly");
  const [formActive, setFormActive] = useState(true);
  const [formFilterGrade, setFormFilterGrade] = useState("");
  const [formFilterLocation, setFormFilterLocation] = useState("");
  const [formFilterEntity, setFormFilterEntity] = useState("");

  /* ----- Fetch ------------------------------------------------------------ */
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

  /* ----- Toggle active ---------------------------------------------------- */
  async function toggleActive(policy: BudgetPolicy) {
    try {
      const res = await fetch(`/api/admin/policies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: policy.id, is_active: !policy.is_active }),
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
    setFormName("");
    setFormPoints("");
    setFormPeriod("monthly");
    setFormActive(true);
    setFormFilterGrade("");
    setFormFilterLocation("");
    setFormFilterEntity("");
    setDialogOpen(true);
  }

  function openEdit(p: BudgetPolicy) {
    setEditing(p);
    setFormName(p.name);
    setFormPoints(String(p.points_amount));
    setFormPeriod(p.period);
    setFormActive(p.is_active);
    const f = p.target_filter as Record<string, unknown>;
    setFormFilterGrade(
      Array.isArray(f?.grade) ? (f.grade as string[]).join(", ") : ""
    );
    setFormFilterLocation(
      Array.isArray(f?.location) ? (f.location as string[]).join(", ") : ""
    );
    setFormFilterEntity(
      Array.isArray(f?.legal_entity)
        ? (f.legal_entity as string[]).join(", ")
        : ""
    );
    setDialogOpen(true);
  }

  function buildTargetFilter() {
    const filter: Record<string, string[]> = {};
    if (formFilterGrade.trim()) {
      filter.grade = formFilterGrade.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (formFilterLocation.trim()) {
      filter.location = formFilterLocation.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (formFilterEntity.trim()) {
      filter.legal_entity = formFilterEntity.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return filter;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: formName,
        points_amount: Number(formPoints),
        period: formPeriod,
        is_active: formActive,
        target_filter: buildTargetFilter(),
      };

      const res = editing
        ? await fetch(`/api/admin/policies`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editing.id, ...body }),
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

  /* ----- Display filter --------------------------------------------------- */
  function formatFilter(f: Record<string, unknown>) {
    const parts: string[] = [];
    if (Array.isArray(f?.grade) && f.grade.length)
      parts.push(`Грейд: ${(f.grade as string[]).join(", ")}`);
    if (Array.isArray(f?.location) && f.location.length)
      parts.push(`Локация: ${(f.location as string[]).join(", ")}`);
    if (Array.isArray(f?.legal_entity) && f.legal_entity.length)
      parts.push(`Юрлицо: ${(f.legal_entity as string[]).join(", ")}`);
    return parts.length ? parts.join(" | ") : "Все сотрудники";
  }

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Бюджетные политики</h1>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Добавить политику
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead className="text-right">Баллов</TableHead>
              <TableHead>Период</TableHead>
              <TableHead>Фильтр группы</TableHead>
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
              {editing ? "Редактировать политику" : "Новая политика"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="policy-name">Название</Label>
              <Input
                id="policy-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="policy-points">Баллов</Label>
                <Input
                  id="policy-points"
                  type="number"
                  min={0}
                  value={formPoints}
                  onChange={(e) => setFormPoints(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Период</Label>
                <Select
                  value={formPeriod}
                  onValueChange={(v) => setFormPeriod(v as BudgetPeriod)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Ежемесячно</SelectItem>
                    <SelectItem value="quarterly">Ежеквартально</SelectItem>
                    <SelectItem value="yearly">Ежегодно</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Фильтр целевой группы</p>
              <div className="space-y-2">
                <Label htmlFor="policy-grade">
                  Грейды (через запятую)
                </Label>
                <Input
                  id="policy-grade"
                  placeholder="A1, A2, B1"
                  value={formFilterGrade}
                  onChange={(e) => setFormFilterGrade(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="policy-location">
                  Локации (через запятую)
                </Label>
                <Input
                  id="policy-location"
                  placeholder="Москва, Санкт-Петербург"
                  value={formFilterLocation}
                  onChange={(e) => setFormFilterLocation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="policy-entity">
                  Юрлица (через запятую)
                </Label>
                <Input
                  id="policy-entity"
                  placeholder="ООО Ромашка, АО Василёк"
                  value={formFilterEntity}
                  onChange={(e) => setFormFilterEntity(e.target.value)}
                />
              </div>
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
