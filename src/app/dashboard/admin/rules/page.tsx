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
import { Badge } from "@/components/ui/badge";

import { DataTable, useTableState } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";
import type { EligibilityRule, Benefit } from "@/lib/types";

/* -------------------------------------------------------------------------- */

interface RuleWithBenefit extends EligibilityRule {
  benefit_name?: string;
}

export default function RulesPage() {
  const { state, setState, resetFilters } = useTableState({ pageSize: 20 });

  const [rules, setRules] = useState<RuleWithBenefit[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(state.page),
        per_page: String(state.pageSize),
      });
      const res = await fetch(`/api/admin/rules?${params}`);
      if (!res.ok) throw new Error("Не удалось загрузить правила");
      const json = await res.json();
      setRules(json.data ?? json);
      setTotal(json.total ?? (json.data ?? json).length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка загрузки";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

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

  /* ----- Columns ---------------------------------------------------------- */
  const columns: ColumnDef<RuleWithBenefit>[] = [
    {
      key: "benefit_name",
      header: "Льгота",
      cell: (r) => (
        <span className="font-medium">
          {r.benefit_name ?? (r.benefit_id ? benefitName(r.benefit_id) : "—")}
        </span>
      ),
    },
    {
      key: "conditions",
      header: "Условия",
      cell: (r) => formatConditions(r.conditions),
    },
    {
      key: "created_at",
      header: "Дата создания",
      headerClassName: "text-right",
      className: "text-right whitespace-nowrap",
      cell: (r) =>
        "created_at" in r && r.created_at
          ? new Date(r.created_at as string).toLocaleDateString("ru-RU")
          : "—",
    },
  ];

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

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-8 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Правила доступности</h1>
          <p className="mt-1 text-sm text-muted-foreground">Условия отображения льгот для сотрудников</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Добавить правило
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rules}
        total={total}
        loading={loading}
        error={error}
        state={state}
        onStateChange={setState}
        onReset={resetFilters}
        actions={(r) => [
          { label: "Редактировать", icon: Pencil, onClick: () => openEdit(r) },
          {
            label: "Удалить",
            icon: Trash2,
            onClick: () => handleDelete(r.id),
            variant: "destructive",
            confirm: "Удалить правило?",
          },
        ]}
      />

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
