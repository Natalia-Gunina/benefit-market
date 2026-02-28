"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

import type { EligibilityRule, Benefit } from "@/lib/types";

/* -------------------------------------------------------------------------- */

interface RuleWithBenefit extends EligibilityRule {
  benefit_name?: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<RuleWithBenefit[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RuleWithBenefit | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [formBenefitId, setFormBenefitId] = useState("");
  const [formGrade, setFormGrade] = useState("");
  const [formMinTenure, setFormMinTenure] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formEntity, setFormEntity] = useState("");

  /* ----- Fetch benefits --------------------------------------------------- */
  useEffect(() => {
    fetch("/api/admin/benefits?per_page=500")
      .then((r) => r.json())
      .then((json) => setBenefits(json.data ?? json))
      .catch(() => {});
  }, []);

  /* ----- Fetch rules ------------------------------------------------------ */
  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      const res = await fetch(`/api/admin/rules?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRules(json.data ?? json);
      setTotal(json.total ?? (json.data ?? json).length);
    } catch {
      toast.error("Не удалось загрузить правила");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  /* ----- Dialog helpers --------------------------------------------------- */
  function openCreate() {
    setEditing(null);
    setFormBenefitId(benefits[0]?.id ?? "");
    setFormGrade("");
    setFormMinTenure("");
    setFormLocation("");
    setFormEntity("");
    setDialogOpen(true);
  }

  function openEdit(rule: RuleWithBenefit) {
    setEditing(rule);
    setFormBenefitId(rule.benefit_id ?? "");
    const c = rule.conditions as Record<string, unknown>;
    setFormGrade(
      Array.isArray(c?.grade) ? (c.grade as string[]).join(", ") : ""
    );
    setFormMinTenure(
      c?.min_tenure != null ? String(c.min_tenure) : ""
    );
    setFormLocation(
      Array.isArray(c?.location) ? (c.location as string[]).join(", ") : ""
    );
    setFormEntity(
      Array.isArray(c?.legal_entity)
        ? (c.legal_entity as string[]).join(", ")
        : ""
    );
    setDialogOpen(true);
  }

  function buildConditions(): Record<string, unknown> {
    const conditions: Record<string, unknown> = {};
    if (formGrade.trim()) {
      conditions.grade = formGrade.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (formMinTenure.trim()) {
      conditions.min_tenure = Number(formMinTenure);
    }
    if (formLocation.trim()) {
      conditions.location = formLocation.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (formEntity.trim()) {
      conditions.legal_entity = formEntity.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return conditions;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const conditions = buildConditions();

      const res = editing
        ? await fetch(`/api/admin/rules/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conditions }),
          })
        : await fetch(`/api/admin/rules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              benefit_id: formBenefitId,
              conditions,
            }),
          });

      if (!res.ok) throw new Error();
      toast.success(editing ? "Правило обновлено" : "Правило создано");
      setDialogOpen(false);
      fetchRules();
    } catch {
      toast.error("Не удалось сохранить правило");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ruleId: string) {
    try {
      const res = await fetch(`/api/admin/rules/${ruleId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Правило удалено");
      fetchRules();
    } catch {
      toast.error("Не удалось удалить правило");
    }
  }

  /* ----- Display helpers -------------------------------------------------- */
  function benefitName(id: string) {
    return benefits.find((b) => b.id === id)?.name ?? id;
  }

  function formatConditions(c: Record<string, unknown>) {
    const parts: React.ReactNode[] = [];

    if (Array.isArray(c?.grade) && c.grade.length) {
      parts.push(
        <span key="grade" className="inline-flex items-center gap-1">
          <span className="text-muted-foreground">Грейд:</span>{" "}
          {(c.grade as string[]).map((g) => (
            <Badge key={g} variant="outline" className="text-xs">
              {g}
            </Badge>
          ))}
        </span>
      );
    }

    if (c?.min_tenure != null) {
      parts.push(
        <span key="tenure" className="inline-flex items-center gap-1">
          <span className="text-muted-foreground">Стаж &ge;</span>{" "}
          <Badge variant="outline" className="text-xs">
            {String(c.min_tenure)} мес.
          </Badge>
        </span>
      );
    }

    if (Array.isArray(c?.location) && c.location.length) {
      parts.push(
        <span key="location" className="inline-flex items-center gap-1">
          <span className="text-muted-foreground">Локация:</span>{" "}
          {(c.location as string[]).map((l) => (
            <Badge key={l} variant="outline" className="text-xs">
              {l}
            </Badge>
          ))}
        </span>
      );
    }

    if (Array.isArray(c?.legal_entity) && c.legal_entity.length) {
      parts.push(
        <span key="entity" className="inline-flex items-center gap-1">
          <span className="text-muted-foreground">Юрлицо:</span>{" "}
          {(c.legal_entity as string[]).map((e) => (
            <Badge key={e} variant="outline" className="text-xs">
              {e}
            </Badge>
          ))}
        </span>
      );
    }

    if (parts.length === 0) {
      return <span className="text-muted-foreground">Нет условий</span>;
    }

    return <div className="flex flex-wrap gap-3">{parts}</div>;
  }

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">
          Правила доступности
        </h1>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Добавить правило
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Льгота</TableHead>
              <TableHead>Условия</TableHead>
              <TableHead className="text-right">Дата создания</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-32 text-center text-muted-foreground"
                >
                  Правила не найдены
                </TableCell>
              </TableRow>
            ) : (
              rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.benefit_name ?? (r.benefit_id ? benefitName(r.benefit_id) : "—")}
                  </TableCell>
                  <TableCell>{formatConditions(r.conditions)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {"created_at" in r && r.created_at
                      ? new Date(r.created_at as string).toLocaleDateString(
                          "ru-RU"
                        )
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-xs">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить правило?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Это действие нельзя отменить. Правило будет удалено
                              безвозвратно.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(r.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Удалить
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редактировать правило" : "Новое правило"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Benefit selector — only for create mode */}
            {!editing ? (
              <div className="space-y-2">
                <Label>Льгота</Label>
                <Select value={formBenefitId} onValueChange={setFormBenefitId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите льготу" />
                  </SelectTrigger>
                  <SelectContent>
                    {benefits.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Льгота</Label>
                <Input
                  value={editing.benefit_name ?? benefitName(editing.benefit_id ?? "")}
                  disabled
                />
              </div>
            )}

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Условия доступности</p>

              <div className="space-y-2">
                <Label htmlFor="rule-grade">Грейды (через запятую)</Label>
                <Input
                  id="rule-grade"
                  placeholder="A1, A2, B1"
                  value={formGrade}
                  onChange={(e) => setFormGrade(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-tenure">Минимальный стаж (мес.)</Label>
                <Input
                  id="rule-tenure"
                  type="number"
                  min={0}
                  placeholder="6"
                  value={formMinTenure}
                  onChange={(e) => setFormMinTenure(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-location">
                  Локации (через запятую)
                </Label>
                <Input
                  id="rule-location"
                  placeholder="Москва, Санкт-Петербург"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-entity">
                  Юрлица (через запятую)
                </Label>
                <Input
                  id="rule-entity"
                  placeholder="ООО Ромашка, АО Василёк"
                  value={formEntity}
                  onChange={(e) => setFormEntity(e.target.value)}
                />
              </div>
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
