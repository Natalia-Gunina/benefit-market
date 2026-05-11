"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  Info,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTablePagination } from "@/components/shared/data-table-pagination";

import type {
  BudgetPolicy,
  BudgetPeriod,
  IndividualAccrual,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Shared constants                                                           */
/* -------------------------------------------------------------------------- */

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  monthly: "Ежемесячно",
  quarterly: "Ежеквартально",
  semiannual: "Раз в полгода",
  yearly: "Ежегодно",
};

const PERIOD_NEXT_LABEL: Record<BudgetPeriod, string> = {
  monthly: "месяц",
  quarterly: "квартал",
  semiannual: "полгода",
  yearly: "год",
};

// Tenure is stored in months in the DB but the rule builder talks about full
// years to match how HR phrases policies. `multiplier` converts years → months
// when serialising and the reverse when loading existing rules.
const RULE_FIELDS = [
  { value: "grade_numeric", label: "Грейд", type: "number" as const, min: 10, max: 18, multiplier: 1 },
  { value: "tenure_months", label: "Стаж (лет)", type: "number" as const, min: 0, max: 50, multiplier: 12 },
  { value: "location", label: "Город", type: "text" as const, multiplier: 1 },
] as const;

type RuleFieldValue = (typeof RULE_FIELDS)[number]["value"];

const NUMERIC_OPERATORS = [
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "eq", label: "=" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
] as const;

const TEXT_OPERATORS = [{ value: "eq", label: "=" }] as const;

type Operator = "gt" | "lt" | "eq" | "gte" | "lte" | "in";

interface RuleRow {
  id: string;
  field: RuleFieldValue;
  operator: Operator;
  value: string;
  points_amount: string;
}

function newRuleRow(): RuleRow {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    field: "grade_numeric",
    operator: "gte",
    value: "",
    points_amount: "",
  };
}

function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDateRu(date: string | null | undefined): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

/* -------------------------------------------------------------------------- */
/* Rule helpers — convert RuleRow[] <-> target_filter JSON                    */
/* -------------------------------------------------------------------------- */

interface RuleGroup {
  field: string;
  operator: Operator;
  value: number | string;
  points_amount: number;
}

interface MatchCondition {
  field: string;
  operator: Operator;
  value: number | string;
}

function rulesToFilter(rules: RuleRow[]): { rule_groups: RuleGroup[] } {
  const rule_groups: RuleGroup[] = [];
  for (const r of rules) {
    if (!r.value.trim()) continue;
    const fieldDef = RULE_FIELDS.find((f) => f.value === r.field);
    const isNumber = fieldDef?.type === "number";
    const multiplier = fieldDef?.multiplier ?? 1;
    let value: number | string;
    if (isNumber) {
      const n = Number(r.value);
      if (Number.isNaN(n)) continue;
      value = n * multiplier;
    } else {
      value = r.value.trim();
    }
    const pts = Number(r.points_amount);
    rule_groups.push({
      field: r.field,
      operator: r.operator,
      value,
      points_amount: Number.isNaN(pts) ? 0 : pts,
    });
  }
  return { rule_groups };
}

function ruleRowFromCondition(
  c: { field: string; operator: Operator; value: number | string },
  idx: number,
  points: string,
): RuleRow | null {
  const fieldDef = RULE_FIELDS.find((rf) => rf.value === c.field);
  if (!fieldDef) return null;
  const multiplier = fieldDef.multiplier ?? 1;
  let displayValue: string;
  if (fieldDef.type === "number" && typeof c.value === "number") {
    displayValue = String(c.value / multiplier);
  } else {
    displayValue = String(c.value ?? "");
  }
  return {
    id: `rule-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    field: c.field as RuleFieldValue,
    operator: c.operator,
    value: displayValue,
    points_amount: points,
  };
}

function filterToRules(filter: unknown): RuleRow[] {
  const f = (filter ?? {}) as {
    rule_groups?: Array<RuleGroup>;
    match_all?: Array<MatchCondition>;
  };

  if (Array.isArray(f.rule_groups) && f.rule_groups.length > 0) {
    const rows: RuleRow[] = [];
    f.rule_groups.forEach((c, idx) => {
      const row = ruleRowFromCondition(c, idx, String(c.points_amount ?? ""));
      if (row) rows.push(row);
    });
    return rows;
  }

  if (Array.isArray(f.match_all) && f.match_all.length > 0) {
    const rows: RuleRow[] = [];
    f.match_all.forEach((c, idx) => {
      const row = ruleRowFromCondition(c, idx, "");
      if (row) rows.push(row);
    });
    return rows;
  }
  return [];
}

function formatFilterHuman(filter: unknown): string {
  const rules = filterToRules(filter);
  if (rules.length === 0) return "Все сотрудники";
  return rules
    .map((r) => {
      const label = RULE_FIELDS.find((f) => f.value === r.field)?.label ?? r.field;
      const op = [...NUMERIC_OPERATORS, ...TEXT_OPERATORS].find(
        (o) => o.value === r.operator,
      )?.label ?? r.operator;
      const pts = r.points_amount
        ? ` → ${Number(r.points_amount).toLocaleString("ru-RU")} б.`
        : "";
      return `${label} ${op} ${r.value}${pts}`;
    })
    .join("; ");
}

/* -------------------------------------------------------------------------- */
/* Restrictions item type                                                     */
/* -------------------------------------------------------------------------- */

interface RestrictionItem {
  id: string;
  name: string;
  description: string;
  price_points: number;
  category_name: string;
  provider_name: string;
  is_restricted: boolean;
}

/* -------------------------------------------------------------------------- */
/* Employee lookup (for individual accruals)                                  */
/* -------------------------------------------------------------------------- */

interface EmployeeOption {
  id: string;
  name: string;
  email: string;
}

/* -------------------------------------------------------------------------- */
/* Form state                                                                 */
/* -------------------------------------------------------------------------- */

interface PolicyForm {
  name: string;
  period: BudgetPeriod;
  first_accrual_date: string;
  is_active: boolean;
  rules: RuleRow[];
}

interface IndividualForm {
  user_id: string;
  mode: "addition" | "replacement";
  points_amount: string;
  period: BudgetPeriod;
  first_accrual_date: string;
  description: string;
  is_active: boolean;
}

function policyToForm(p: BudgetPolicy): PolicyForm {
  return {
    name: p.name,
    period: p.period,
    first_accrual_date:
      p.first_accrual_date ?? p.next_accrual_date ?? todayIso(),
    is_active: p.is_active,
    rules: filterToRules(p.target_filter),
  };
}

function emptyPolicyForm(): PolicyForm {
  return {
    name: "",
    period: "monthly",
    first_accrual_date: todayIso(),
    is_active: true,
    rules: [newRuleRow()],
  };
}

function individualToForm(a: IndividualAccrual): IndividualForm {
  return {
    user_id: a.user_id,
    mode: a.mode,
    points_amount: String(a.points_amount ?? ""),
    period: a.period,
    first_accrual_date:
      a.first_accrual_date ?? a.next_accrual_date ?? todayIso(),
    description: a.description ?? "",
    is_active: a.is_active,
  };
}

function emptyIndividualForm(): IndividualForm {
  return {
    user_id: "",
    mode: "addition",
    points_amount: "",
    period: "monthly",
    first_accrual_date: todayIso(),
    description: "",
    is_active: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function HrPoliciesPage() {
  // === Policies ===
  const [policies, setPolicies] = useState<BudgetPolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [editingPolicy, setEditingPolicy] = useState<BudgetPolicy | null>(null);
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState<PolicyForm | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // === Individual accruals ===
  const [individuals, setIndividuals] = useState<IndividualAccrual[]>([]);
  const [individualsLoading, setIndividualsLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  const [editingIndividual, setEditingIndividual] =
    useState<IndividualAccrual | null>(null);
  const [individualDialogOpen, setIndividualDialogOpen] = useState(false);
  const [individualForm, setIndividualForm] = useState<IndividualForm | null>(null);
  const [savingIndividual, setSavingIndividual] = useState(false);

  // === Restrictions ===
  const [restrictions, setRestrictions] = useState<RestrictionItem[]>([]);
  const [restrictionsLoading, setRestrictionsLoading] = useState(false);
  const [restrictionSearch, setRestrictionSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* -------------------- Fetchers -------------------- */

  const fetchPolicies = useCallback(async () => {
    setPoliciesLoading(true);
    try {
      const res = await fetch("/api/admin/policies");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setPolicies(json.data ?? json);
    } catch {
      toast.error("Не удалось загрузить политики");
    } finally {
      setPoliciesLoading(false);
    }
  }, []);

  const fetchIndividuals = useCallback(async () => {
    setIndividualsLoading(true);
    try {
      const res = await fetch("/api/hr/individual-accruals");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setIndividuals(json.data ?? json);
    } catch {
      toast.error("Не удалось загрузить индивидуальные начисления");
    } finally {
      setIndividualsLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/hr/employees?per_page=100");
      if (!res.ok) return;
      const json = await res.json();
      const list = (json.data ?? []) as Array<{
        id: string;
        name: string;
        email: string;
      }>;
      setEmployees(list.map((e) => ({ id: e.id, name: e.name, email: e.email })));
    } catch {
      // ignore
    }
  }, []);

  const fetchRestrictions = useCallback(async () => {
    setRestrictionsLoading(true);
    try {
      const res = await fetch("/api/hr/restrictions");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRestrictions(json.data ?? []);
    } catch {
      toast.error("Не удалось загрузить ограничения");
    } finally {
      setRestrictionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
    fetchIndividuals();
    fetchEmployees();
    fetchRestrictions();
  }, [fetchPolicies, fetchIndividuals, fetchEmployees, fetchRestrictions]);

  /* -------------------- Policy dialog handlers -------------------- */

  function openCreatePolicy() {
    setEditingPolicy(null);
    setPolicyForm(emptyPolicyForm());
    setPolicyDialogOpen(true);
  }

  function openEditPolicy(p: BudgetPolicy) {
    setEditingPolicy(p);
    setPolicyForm(policyToForm(p));
    setPolicyDialogOpen(true);
  }

  function closePolicyDialog() {
    setEditingPolicy(null);
    setPolicyForm(null);
    setPolicyDialogOpen(false);
  }

  async function savePolicy() {
    if (!policyForm) return;
    if (!policyForm.name.trim()) {
      toast.error("Название не может быть пустым");
      return;
    }
    if (policyForm.rules.length === 0) {
      toast.error("Добавьте хотя бы одно правило начисления");
      return;
    }
    for (const r of policyForm.rules) {
      if (!r.value.trim()) {
        toast.error("Заполните значение для каждого правила");
        return;
      }
      const pts = Number(r.points_amount);
      if (!r.points_amount.trim() || Number.isNaN(pts) || pts <= 0) {
        toast.error("Укажите количество баллов > 0 для каждого правила");
        return;
      }
    }
    if (!policyForm.first_accrual_date) {
      toast.error("Укажите дату первого начисления");
      return;
    }
    if (policyForm.first_accrual_date < todayIso()) {
      toast.error("Дата первого начисления должна быть сегодня или в будущем");
      return;
    }

    setSavingPolicy(true);
    try {
      const totalPoints = policyForm.rules.reduce(
        (s, r) => s + (Number(r.points_amount) || 0),
        0,
      );
      const payload = {
        name: policyForm.name,
        points_amount: totalPoints,
        period: policyForm.period,
        first_accrual_date: policyForm.first_accrual_date,
        target_filter: rulesToFilter(policyForm.rules),
        is_active: policyForm.is_active,
      };

      const url = editingPolicy
        ? `/api/admin/policies/${editingPolicy.id}`
        : "/api/admin/policies";
      const method = editingPolicy ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error?.message ?? "Не удалось сохранить");
        return;
      }

      toast.success(editingPolicy ? "Политика обновлена" : "Политика создана");
      closePolicyDialog();
      await fetchPolicies();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSavingPolicy(false);
    }
  }

  async function deletePolicy(p: BudgetPolicy) {
    if (!confirm(`Деактивировать политику «${p.name}»?`)) return;
    try {
      const res = await fetch(`/api/admin/policies/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Политика деактивирована");
      await fetchPolicies();
    } catch {
      toast.error("Не удалось деактивировать политику");
    }
  }

  /* -------------------- Individual accrual handlers -------------------- */

  function openCreateIndividual() {
    setEditingIndividual(null);
    setIndividualForm(emptyIndividualForm());
    setIndividualDialogOpen(true);
  }

  function openEditIndividual(a: IndividualAccrual) {
    setEditingIndividual(a);
    setIndividualForm(individualToForm(a));
    setIndividualDialogOpen(true);
  }

  function closeIndividualDialog() {
    setEditingIndividual(null);
    setIndividualForm(null);
    setIndividualDialogOpen(false);
  }

  async function saveIndividual() {
    if (!individualForm) return;
    if (!individualForm.user_id) {
      toast.error("Выберите сотрудника");
      return;
    }
    const pts = Number(individualForm.points_amount);
    if (
      !individualForm.points_amount.trim() ||
      Number.isNaN(pts) ||
      pts <= 0
    ) {
      toast.error("Сумма баллов должна быть больше нуля");
      return;
    }
    if (!individualForm.first_accrual_date) {
      toast.error("Укажите дату первого начисления");
      return;
    }
    if (individualForm.first_accrual_date < todayIso()) {
      toast.error("Дата первого начисления должна быть сегодня или в будущем");
      return;
    }

    setSavingIndividual(true);
    try {
      const payload = {
        user_id: individualForm.user_id,
        mode: individualForm.mode,
        points_amount: pts,
        period: individualForm.period,
        first_accrual_date: individualForm.first_accrual_date,
        description: individualForm.description,
        is_active: individualForm.is_active,
      };

      const url = editingIndividual
        ? `/api/hr/individual-accruals/${editingIndividual.id}`
        : "/api/hr/individual-accruals";
      const method = editingIndividual ? "PATCH" : "POST";

      // user_id is locked on PATCH
      const finalPayload = editingIndividual
        ? (() => {
            const { user_id, ...rest } = payload;
            void user_id;
            return rest;
          })()
        : payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error?.message ?? "Не удалось сохранить");
        return;
      }

      toast.success(
        editingIndividual
          ? "Начисление обновлено"
          : "Индивидуальное начисление создано",
      );
      closeIndividualDialog();
      await fetchIndividuals();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSavingIndividual(false);
    }
  }

  async function deleteIndividual(a: IndividualAccrual) {
    if (!confirm("Деактивировать это индивидуальное начисление?")) return;
    try {
      const res = await fetch(`/api/hr/individual-accruals/${a.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Начисление деактивировано");
      await fetchIndividuals();
    } catch {
      toast.error("Не удалось деактивировать");
    }
  }

  /* -------------------- Restrictions handlers -------------------- */

  async function toggleRestriction(item: RestrictionItem) {
    setTogglingId(item.id);
    try {
      const res = await fetch("/api/hr/restrictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_offering_id: item.id,
          restricted: !item.is_restricted,
        }),
      });
      if (!res.ok) throw new Error();
      setRestrictions((prev) =>
        prev.map((r) =>
          r.id === item.id ? { ...r, is_restricted: !r.is_restricted } : r,
        ),
      );
      toast.success(item.is_restricted ? "Ограничение снято" : "Льгота ограничена");
    } catch {
      toast.error("Не удалось обновить ограничение");
    } finally {
      setTogglingId(null);
    }
  }

  const filteredRestrictions = restrictions.filter((r) => {
    if (!restrictionSearch.trim()) return true;
    const q = restrictionSearch.trim().toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.category_name.toLowerCase().includes(q) ||
      r.provider_name.toLowerCase().includes(q)
    );
  });

  const employeeNameById = useMemo(() => {
    const m = new Map<string, EmployeeOption>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  /* -------------------- Render -------------------- */

  const total = policies.length;
  const paged = policies.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Начисления и политики</h1>

      <Tabs defaultValue="policies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="policies">Политики начисления</TabsTrigger>
          <TabsTrigger value="individuals">
            Индивидуальные начисления
          </TabsTrigger>
          <TabsTrigger value="restrictions">
            <ShieldOff className="mr-1.5 size-4" />
            Ограничение льгот
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* Tab 1: Policies                                                */}
        {/* ============================================================ */}
        <TabsContent value="policies" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Политики автоматически начисляют баллы сотрудникам, чьи параметры
              соответствуют правилам.
            </p>
            <Button onClick={openCreatePolicy}>
              <Plus className="size-4" />
              Создать политику начисления баллов
            </Button>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead className="text-right">Баллов</TableHead>
                  <TableHead>Частота</TableHead>
                  <TableHead>Правила</TableHead>
                  <TableHead>Следующее начисление</TableHead>
                  <TableHead className="text-center">Статус</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {policiesLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Политики не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((p) => (
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
                        {formatFilterHuman(p.target_filter)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <CalendarClock className="size-3.5" />
                          {p.is_active
                            ? formatDateRu(p.next_accrual_date)
                            : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={p.is_active ? "default" : "secondary"}>
                          {p.is_active ? "Активна" : "Неактивна"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openEditPolicy(p)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          {p.is_active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={() => deletePolicy(p)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {!policiesLoading && total > perPage && (
              <DataTablePagination
                page={page}
                per_page={perPage}
                total={total}
                onPageChange={setPage}
              />
            )}
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* Tab 2: Individual accruals                                     */}
        {/* ============================================================ */}
        <TabsContent value="individuals" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Индивидуальное начисление баллов — исключение из политик для
              отдельного сотрудника: можно <b>дополнить</b> сумму политики или
              полностью <b>заменить</b> её для конкретного человека.
            </p>
            <Button onClick={openCreateIndividual}>
              <Plus className="size-4" />
              Создать индивидуальное начисление
            </Button>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-right">Баллов</TableHead>
                  <TableHead>Частота</TableHead>
                  <TableHead>Следующее начисление</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead className="text-center">Статус</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {individualsLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : individuals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Индивидуальных начислений нет
                    </TableCell>
                  </TableRow>
                ) : (
                  individuals.map((a) => {
                    const emp = employeeNameById.get(a.user_id);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {emp?.name ?? a.user_id}
                          {emp?.email && (
                            <p className="text-xs text-muted-foreground">
                              {emp.email}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              a.mode === "replacement" ? "destructive" : "default"
                            }
                          >
                            {a.mode === "replacement" ? "Замена" : "Дополнение"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.points_amount.toLocaleString("ru-RU")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {PERIOD_LABELS[a.period] ?? a.period}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.is_active ? formatDateRu(a.next_accrual_date) : "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {a.description || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={a.is_active ? "default" : "secondary"}>
                            {a.is_active ? "Активно" : "Неактивно"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEditIndividual(a)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {a.is_active && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                onClick={() => deleteIndividual(a)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* Tab 3: Restrictions                                           */}
        {/* ============================================================ */}
        <TabsContent value="restrictions" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ограниченные льготы не отображаются в каталоге сотрудников. Включите
            переключатель, чтобы ограничить льготу.
          </p>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию..."
              className="pl-9"
              value={restrictionSearch}
              onChange={(e) => setRestrictionSearch(e.target.value)}
            />
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Провайдер</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead className="text-right">Цена</TableHead>
                  <TableHead className="text-center">Ограничена</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restrictionsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredRestrictions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Льготы не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRestrictions.map((item) => (
                    <TableRow
                      key={item.id}
                      className={item.is_restricted ? "opacity-60" : ""}
                    >
                      <TableCell className="text-muted-foreground">
                        {item.provider_name}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.category_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.price_points.toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={item.is_restricted}
                          disabled={togglingId === item.id}
                          onCheckedChange={() => toggleRestriction(item)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* Policy create/edit dialog                                     */}
      {/* ============================================================ */}
      <Dialog
        open={policyDialogOpen}
        onOpenChange={(open) => !open && closePolicyDialog()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy
                ? "Редактировать политику"
                : "Создать политику начисления баллов"}
            </DialogTitle>
          </DialogHeader>

          {policyForm && (
            <div className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="policy-name">Название политики</Label>
                <Input
                  id="policy-name"
                  value={policyForm.name}
                  onChange={(e) =>
                    setPolicyForm({ ...policyForm, name: e.target.value })
                  }
                  placeholder="Например: Стандартный бюджет"
                />
              </div>

              {/* Rules builder — each rule has its own points amount */}
              <div className="space-y-2">
                <Label>Правила начисления</Label>
                <p className="text-xs text-muted-foreground">
                  Каждое правило задаёт свою сумму баллов. Сотрудник, удовлетворяющий
                  правилу, получит указанные за него баллы; при попадании в несколько
                  правил — суммируются.
                </p>
                <div className="space-y-2">
                  {policyForm.rules.length === 0 && (
                    <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                      Добавьте хотя бы одно правило
                    </p>
                  )}
                  {policyForm.rules.map((rule, idx) => {
                    const fieldDef = RULE_FIELDS.find(
                      (f) => f.value === rule.field,
                    );
                    const operators =
                      fieldDef?.type === "number"
                        ? NUMERIC_OPERATORS
                        : TEXT_OPERATORS;
                    return (
                      <div
                        key={rule.id}
                        className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2"
                      >
                        <Select
                          value={rule.field}
                          onValueChange={(v) => {
                            const f = RULE_FIELDS.find((rf) => rf.value === v);
                            const nextOp =
                              f?.type === "text"
                                ? "eq"
                                : (rule.operator as Operator);
                            const next = [...policyForm.rules];
                            next[idx] = {
                              ...rule,
                              field: v as RuleFieldValue,
                              operator: nextOp,
                              value: "",
                            };
                            setPolicyForm({ ...policyForm, rules: next });
                          }}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RULE_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={rule.operator}
                          onValueChange={(v) => {
                            const next = [...policyForm.rules];
                            next[idx] = { ...rule, operator: v as Operator };
                            setPolicyForm({ ...policyForm, rules: next });
                          }}
                        >
                          <SelectTrigger className="w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {operators.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          className="min-w-[100px] flex-1"
                          type={fieldDef?.type === "number" ? "number" : "text"}
                          min={fieldDef?.type === "number" ? fieldDef.min : undefined}
                          max={fieldDef?.type === "number" ? fieldDef.max : undefined}
                          placeholder={
                            fieldDef?.type === "number"
                              ? `${fieldDef.min}–${fieldDef.max}`
                              : "Например: Москва"
                          }
                          value={rule.value}
                          onChange={(e) => {
                            const next = [...policyForm.rules];
                            next[idx] = { ...rule, value: e.target.value };
                            setPolicyForm({ ...policyForm, rules: next });
                          }}
                        />

                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-muted-foreground">→</span>
                          <Input
                            className="w-[120px]"
                            type="number"
                            min={0}
                            placeholder="Баллы"
                            value={rule.points_amount}
                            onChange={(e) => {
                              const next = [...policyForm.rules];
                              next[idx] = {
                                ...rule,
                                points_amount: e.target.value,
                              };
                              setPolicyForm({ ...policyForm, rules: next });
                            }}
                          />
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={() => {
                            const next = policyForm.rules.filter(
                              (r) => r.id !== rule.id,
                            );
                            setPolicyForm({ ...policyForm, rules: next });
                          }}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPolicyForm({
                      ...policyForm,
                      rules: [...policyForm.rules, newRuleRow()],
                    })
                  }
                >
                  <Plus className="size-4" />
                  Добавить правило
                </Button>
              </div>

              {/* Period */}
              <div className="space-y-2">
                <Label>Частота начисления</Label>
                <Select
                  value={policyForm.period}
                  onValueChange={(v) =>
                    setPolicyForm({ ...policyForm, period: v as BudgetPeriod })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Ежемесячно</SelectItem>
                    <SelectItem value="quarterly">Ежеквартально</SelectItem>
                    <SelectItem value="semiannual">Раз в полгода</SelectItem>
                    <SelectItem value="yearly">Ежегодно</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* First accrual date */}
              <div className="space-y-2">
                <Label htmlFor="policy-first-date">
                  Укажите дату первого начисления
                </Label>
                <Input
                  id="policy-first-date"
                  type="date"
                  min={todayIso()}
                  value={policyForm.first_accrual_date}
                  onChange={(e) =>
                    setPolicyForm({
                      ...policyForm,
                      first_accrual_date: e.target.value,
                    })
                  }
                />
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Если выбрана сегодняшняя дата — баллы будут начислены сразу
                  после сохранения. Далее начисления будут происходить
                  автоматически раз в {PERIOD_NEXT_LABEL[policyForm.period]}.
                </p>
              </div>

              {/* Active */}
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="policy-active" className="cursor-pointer">
                  Активна
                </Label>
                <Switch
                  id="policy-active"
                  checked={policyForm.is_active}
                  onCheckedChange={(checked) =>
                    setPolicyForm({ ...policyForm, is_active: checked })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closePolicyDialog}
              disabled={savingPolicy}
            >
              Отмена
            </Button>
            <Button onClick={savePolicy} disabled={savingPolicy}>
              {savingPolicy ? (
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

      {/* ============================================================ */}
      {/* Individual accrual dialog                                     */}
      {/* ============================================================ */}
      <Dialog
        open={individualDialogOpen}
        onOpenChange={(open) => !open && closeIndividualDialog()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingIndividual
                ? "Редактировать индивидуальное начисление"
                : "Создать индивидуальное начисление баллов"}
            </DialogTitle>
          </DialogHeader>

          {individualForm && (
            <div className="space-y-5">
              {/* Employee picker */}
              <div className="space-y-2">
                <Label>Сотрудник (ФИО)</Label>
                <Select
                  value={individualForm.user_id}
                  onValueChange={(v) =>
                    setIndividualForm({ ...individualForm, user_id: v })
                  }
                  disabled={!!editingIndividual}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите сотрудника..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        Сотрудники не найдены
                      </div>
                    )}
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} ({e.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingIndividual && (
                  <p className="text-xs text-muted-foreground">
                    Сотрудника нельзя изменить после создания. Деактивируйте и
                    создайте новое начисление, если нужно.
                  </p>
                )}
              </div>

              {/* Mode */}
              <div className="space-y-2">
                <Label>Тип начисления</Label>
                <Select
                  value={individualForm.mode}
                  onValueChange={(v) =>
                    setIndividualForm({
                      ...individualForm,
                      mode: v as "addition" | "replacement",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="addition">
                      Дополнение — начисляется поверх политик
                    </SelectItem>
                    <SelectItem value="replacement">
                      Замена — вместо политик для этого сотрудника
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  {individualForm.mode === "replacement"
                    ? "Сотрудник не будет получать баллы по общим политикам — только по этому начислению."
                    : "Сотрудник получит баллы по политикам И дополнительно по этому начислению."}
                </p>
              </div>

              {/* Points */}
              <div className="space-y-2">
                <Label htmlFor="ind-points">Количество баллов за период</Label>
                <Input
                  id="ind-points"
                  type="number"
                  min={0}
                  placeholder="Например: 10000"
                  value={individualForm.points_amount}
                  onChange={(e) =>
                    setIndividualForm({
                      ...individualForm,
                      points_amount: e.target.value,
                    })
                  }
                />
              </div>

              {/* Period */}
              <div className="space-y-2">
                <Label>Частота начисления</Label>
                <Select
                  value={individualForm.period}
                  onValueChange={(v) =>
                    setIndividualForm({
                      ...individualForm,
                      period: v as BudgetPeriod,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Ежемесячно</SelectItem>
                    <SelectItem value="quarterly">Ежеквартально</SelectItem>
                    <SelectItem value="semiannual">Раз в полгода</SelectItem>
                    <SelectItem value="yearly">Ежегодно</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* First date */}
              <div className="space-y-2">
                <Label htmlFor="ind-first-date">
                  Укажите дату первого начисления
                </Label>
                <Input
                  id="ind-first-date"
                  type="date"
                  min={todayIso()}
                  value={individualForm.first_accrual_date}
                  onChange={(e) =>
                    setIndividualForm({
                      ...individualForm,
                      first_accrual_date: e.target.value,
                    })
                  }
                />
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Если выбрана сегодняшняя дата — баллы будут начислены сразу
                  после сохранения.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="ind-desc">Комментарий (необязательно)</Label>
                <Textarea
                  id="ind-desc"
                  rows={3}
                  placeholder="Например: бонус за успешный проект"
                  value={individualForm.description}
                  onChange={(e) =>
                    setIndividualForm({
                      ...individualForm,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              {/* Active */}
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="ind-active" className="cursor-pointer">
                  Активно
                </Label>
                <Switch
                  id="ind-active"
                  checked={individualForm.is_active}
                  onCheckedChange={(c) =>
                    setIndividualForm({ ...individualForm, is_active: c })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeIndividualDialog}
              disabled={savingIndividual}
            >
              Отмена
            </Button>
            <Button onClick={saveIndividual} disabled={savingIndividual}>
              {savingIndividual ? (
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
