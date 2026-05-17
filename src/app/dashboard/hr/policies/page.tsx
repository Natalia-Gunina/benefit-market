"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  CalendarClock,
  Info,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DataTable, useLocalTableState, useClientFiltered } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";

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
/* Employee combobox (searchable select)                                      */
/* -------------------------------------------------------------------------- */

function EmployeeCombobox({
  value,
  onChange,
  employees,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  employees: EmployeeOption[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => employees.find((e) => e.id === value) ?? null,
    [employees, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q),
    );
  }, [employees, query]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  }, []);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span
            className={cn(
              "truncate",
              !selected && "text-muted-foreground",
            )}
          >
            {selected
              ? `${selected.name} (${selected.email})`
              : "Выберите сотрудника..."}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b p-2">
          <Input
            autoFocus
            placeholder="Поиск по ФИО или email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              } else if (e.key === "Enter" && filtered.length > 0) {
                e.preventDefault();
                onChange(filtered[0].id);
                setOpen(false);
              }
            }}
            className="h-9"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              Сотрудники не найдены
            </div>
          ) : (
            filtered.map((e) => {
              const isSelected = e.id === value;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    onChange(e.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground",
                  )}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">
                    {e.name}{" "}
                    <span className="text-muted-foreground">({e.email})</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function HrPoliciesPage() {
  // === Policies ===
  const [policies, setPolicies] = useState<BudgetPolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);

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
      const res = await fetch("/api/hr/employees?per_page=500");
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

      const json = await res.json().catch(() => ({}));
      const summary = (json.data ?? json)?.accrual_summary as
        | { accrued: number; errors: string[] }
        | null
        | undefined;

      if (summary?.errors && summary.errors.length > 0) {
        toast.error(
          `Политика сохранена, но начисление не прошло: ${summary.errors[0]}`,
        );
      } else if (summary && summary.accrued > 0) {
        toast.success(
          `${editingPolicy ? "Политика обновлена" : "Политика создана"}. Начислено ${summary.accrued} сотрудникам.`,
        );
      } else {
        toast.success(editingPolicy ? "Политика обновлена" : "Политика создана");
      }
      closePolicyDialog();
      await fetchPolicies();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSavingPolicy(false);
    }
  }

  async function deletePolicy(p: BudgetPolicy) {
    if (!confirm(`Отправить политику «${p.name}» в архив?`)) return;
    try {
      const res = await fetch(`/api/admin/policies/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Политика отправлена в архив");
      await fetchPolicies();
    } catch {
      toast.error("Не удалось архивировать политику");
    }
  }

  async function restorePolicy(p: BudgetPolicy) {
    try {
      const res = await fetch(`/api/admin/policies/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Политика «${p.name}» восстановлена`);
      await fetchPolicies();
    } catch {
      toast.error("Не удалось восстановить политику");
    }
  }

  async function togglePolicyActive(p: BudgetPolicy) {
    try {
      const res = await fetch(`/api/admin/policies/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      if (!res.ok) throw new Error();
      toast.success(p.is_active ? "Политика деактивирована" : "Политика активирована");
      await fetchPolicies();
    } catch {
      toast.error("Не удалось изменить статус");
    }
  }

  async function toggleIndividualActive(a: IndividualAccrual) {
    try {
      const res = await fetch(`/api/hr/individual-accruals/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !a.is_active }),
      });
      if (!res.ok) throw new Error();
      toast.success(a.is_active ? "Начисление деактивировано" : "Начисление активировано");
      await fetchIndividuals();
    } catch {
      toast.error("Не удалось изменить статус");
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

      const json = await res.json().catch(() => ({}));
      const summary = (json.data ?? json)?.accrual_summary as
        | { accrued: number; errors: string[] }
        | null
        | undefined;

      if (summary?.errors && summary.errors.length > 0) {
        toast.error(
          `Начисление сохранено, но баллы не зачислены: ${summary.errors[0]}`,
        );
      } else if (summary && summary.accrued > 0) {
        toast.success(
          `${editingIndividual ? "Начисление обновлено" : "Индивидуальное начисление создано"}. Баллы зачислены сотруднику.`,
        );
      } else {
        toast.success(
          editingIndividual
            ? "Начисление обновлено"
            : "Индивидуальное начисление создано",
        );
      }
      closeIndividualDialog();
      await fetchIndividuals();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSavingIndividual(false);
    }
  }

  async function deleteIndividual(a: IndividualAccrual) {
    if (!confirm("Отправить это индивидуальное начисление в архив?")) return;
    try {
      const res = await fetch(`/api/hr/individual-accruals/${a.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Начисление отправлено в архив");
      await fetchIndividuals();
    } catch {
      toast.error("Не удалось архивировать");
    }
  }

  async function restoreIndividual(a: IndividualAccrual) {
    try {
      const res = await fetch(`/api/hr/individual-accruals/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) throw new Error();
      toast.success("Начисление восстановлено");
      await fetchIndividuals();
    } catch {
      toast.error("Не удалось восстановить");
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

  const employeeNameById = useMemo(() => {
    const m = new Map<string, EmployeeOption>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  /* -------------------- Derived data -------------------- */

  const activePolicies = useMemo(
    () => policies.filter((p) => p.is_active),
    [policies],
  );
  const archivedPolicies = useMemo(
    () => policies.filter((p) => !p.is_active),
    [policies],
  );
  const activeIndividuals = useMemo(
    () => individuals.filter((a) => a.is_active),
    [individuals],
  );
  const archivedIndividuals = useMemo(
    () => individuals.filter((a) => !a.is_active),
    [individuals],
  );

  interface ArchiveRow {
    id: string;
    kind: "policy" | "individual";
    name: string;
    points: number;
    period: BudgetPeriod;
    description: string;
    archivedAt: string;
    policy?: BudgetPolicy;
    individual?: IndividualAccrual;
  }

  const archiveRows = useMemo<ArchiveRow[]>(() => {
    const rows: ArchiveRow[] = [];
    for (const p of archivedPolicies) {
      rows.push({
        id: `p-${p.id}`,
        kind: "policy",
        name: p.name,
        points: p.points_amount,
        period: p.period,
        description: formatFilterHuman(p.target_filter),
        archivedAt: p.updated_at ?? "",
        policy: p,
      });
    }
    for (const a of archivedIndividuals) {
      const emp = employeeNameById.get(a.user_id);
      const modeLabel = a.mode === "replacement" ? "Замена" : "Дополнение";
      rows.push({
        id: `i-${a.id}`,
        kind: "individual",
        name: emp?.name ?? a.user_id,
        points: a.points_amount,
        period: a.period,
        description: a.description ? `${modeLabel}: ${a.description}` : modeLabel,
        archivedAt: a.updated_at ?? "",
        individual: a,
      });
    }
    return rows;
  }, [archivedPolicies, archivedIndividuals, employeeNameById]);

  /* -------------------- DataTable states (local, not URL) -------------------- */

  const policyTable = useLocalTableState();
  const individualTable = useLocalTableState();
  const restrictionTable = useLocalTableState();
  const archiveTable = useLocalTableState({ defaultSort: { key: "archivedAt", direction: "desc" } });

  // We define columns below, but need them for filtering — use late-binding refs
  // The columns are defined after this block, so we use the filter hook after columns

  /* -------------------- Column defs -------------------- */

  const PERIOD_OPTIONS = [
    { value: "monthly", label: "Ежемесячно" },
    { value: "quarterly", label: "Ежеквартально" },
    { value: "semiannual", label: "Раз в полгода" },
    { value: "yearly", label: "Ежегодно" },
  ];

  const policyColumns: ColumnDef<BudgetPolicy>[] = useMemo(() => [
    {
      key: "name",
      header: "Название",
      sortable: true,
      filter: { type: "text" },
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "points_amount",
      header: "Баллов",
      sortable: true,
      filter: { type: "number" },
      className: "text-right tabular-nums",
      headerClassName: "text-right",
      cell: (row) => row.points_amount.toLocaleString("ru-RU"),
    },
    {
      key: "period",
      header: "Частота",
      filter: { type: "select", options: PERIOD_OPTIONS },
      cell: (row) => (
        <Badge variant="outline">{PERIOD_LABELS[row.period] ?? row.period}</Badge>
      ),
    },
    {
      key: "target_filter",
      header: "Правила",
      className: "max-w-[280px] truncate text-muted-foreground",
      cell: (row) => formatFilterHuman(row.target_filter),
    },
    {
      key: "next_accrual_date",
      header: "Следующее начисление",
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <CalendarClock className="size-3.5" />
          {row.is_active ? formatDateRu(row.next_accrual_date) : "—"}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Активна",
      filter: {
        type: "select",
        options: [
          { value: "true", label: "Активные" },
          { value: "false", label: "Неактивные" },
        ],
      },
      className: "text-center",
      headerClassName: "text-center",
      cell: (row) => (
        <Switch
          checked={row.is_active}
          onCheckedChange={() => togglePolicyActive(row)}
        />
      ),
    },
  ], []);

  const individualColumns: ColumnDef<IndividualAccrual>[] = useMemo(() => [
    {
      key: "user_id",
      header: "Сотрудник",
      sortable: true,
      cell: (row) => {
        const emp = employeeNameById.get(row.user_id);
        return (
          <div>
            <span className="font-medium">{emp?.name ?? row.user_id}</span>
            {emp?.email && (
              <p className="text-xs text-muted-foreground">{emp.email}</p>
            )}
          </div>
        );
      },
    },
    {
      key: "mode",
      header: "Тип",
      filter: {
        type: "select",
        options: [
          { value: "addition", label: "Дополнение" },
          { value: "replacement", label: "Замена" },
        ],
      },
      cell: (row) => (
        <Badge variant={row.mode === "replacement" ? "destructive" : "default"}>
          {row.mode === "replacement" ? "Замена" : "Дополнение"}
        </Badge>
      ),
    },
    {
      key: "points_amount",
      header: "Баллов",
      sortable: true,
      filter: { type: "number" },
      className: "text-right tabular-nums",
      headerClassName: "text-right",
      cell: (row) => row.points_amount.toLocaleString("ru-RU"),
    },
    {
      key: "period",
      header: "Частота",
      filter: { type: "select", options: PERIOD_OPTIONS },
      cell: (row) => (
        <Badge variant="outline">{PERIOD_LABELS[row.period] ?? row.period}</Badge>
      ),
    },
    {
      key: "next_accrual_date",
      header: "Следующее начисление",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.is_active ? formatDateRu(row.next_accrual_date) : "—"}
        </span>
      ),
    },
    {
      key: "description",
      header: "Описание",
      className: "max-w-[200px] truncate text-muted-foreground",
      cell: (row) => row.description || "—",
    },
    {
      key: "is_active",
      header: "Активно",
      filter: {
        type: "select",
        options: [
          { value: "true", label: "Активные" },
          { value: "false", label: "Неактивные" },
        ],
      },
      className: "text-center",
      headerClassName: "text-center",
      cell: (row) => (
        <Switch
          checked={row.is_active}
          onCheckedChange={() => toggleIndividualActive(row)}
        />
      ),
    },
  ], [employeeNameById]);

  const providerOptions = useMemo(
    () => [...new Set(restrictions.map((r) => r.provider_name))].sort().map((v) => ({ value: v, label: v })),
    [restrictions],
  );
  const categoryOptions = useMemo(
    () => [...new Set(restrictions.map((r) => r.category_name))].sort().map((v) => ({ value: v, label: v })),
    [restrictions],
  );

  const restrictionColumns: ColumnDef<RestrictionItem>[] = useMemo(() => [
    {
      key: "provider_name",
      header: "Провайдер",
      sortable: true,
      filter: { type: "select", options: providerOptions },
      className: "text-muted-foreground",
    },
    {
      key: "name",
      header: "Название",
      sortable: true,
      filter: { type: "text" },
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "category_name",
      header: "Категория",
      sortable: true,
      filter: { type: "select", options: categoryOptions },
    },
    {
      key: "price_points",
      header: "Цена",
      sortable: true,
      filter: { type: "number" },
      className: "text-right tabular-nums",
      headerClassName: "text-right",
      cell: (row) => row.price_points.toLocaleString("ru-RU"),
    },
    {
      key: "is_restricted",
      header: "Ограничена",
      filter: {
        type: "select",
        options: [
          { value: "true", label: "Ограничена" },
          { value: "false", label: "Доступна" },
        ],
      },
      className: "text-center",
      headerClassName: "text-center",
      cell: (row) => (
        <Switch
          checked={row.is_restricted}
          disabled={togglingId === row.id}
          onCheckedChange={() => toggleRestriction(row)}
        />
      ),
    },
  ], [togglingId, providerOptions, categoryOptions]);

  const KIND_OPTIONS = [
    { value: "policy", label: "Общая политика" },
    { value: "individual", label: "Индивидуальная" },
  ];

  const archiveColumns: ColumnDef<ArchiveRow>[] = useMemo(() => [
    {
      key: "kind",
      header: "Тип",
      sortable: true,
      filter: { type: "select", options: KIND_OPTIONS },
      cell: (row) => (
        <Badge variant={row.kind === "policy" ? "outline" : "secondary"}>
          {row.kind === "policy" ? "Общая политика" : "Индивидуальная"}
        </Badge>
      ),
    },
    {
      key: "name",
      header: "Название / Сотрудник",
      sortable: true,
      filter: { type: "text" },
      cell: (row) => (
        <div>
          <span className="font-medium">{row.name}</span>
          {row.kind === "individual" && row.individual &&
            employeeNameById.get(row.individual.user_id)?.email && (
              <p className="text-xs text-muted-foreground">
                {employeeNameById.get(row.individual.user_id)?.email}
              </p>
            )}
        </div>
      ),
    },
    {
      key: "points",
      header: "Баллов",
      sortable: true,
      className: "text-right tabular-nums",
      headerClassName: "text-right",
      cell: (row) => row.points.toLocaleString("ru-RU"),
    },
    {
      key: "period",
      header: "Частота",
      sortable: true,
      filter: { type: "select", options: PERIOD_OPTIONS },
      cell: (row) => (
        <Badge variant="outline">{PERIOD_LABELS[row.period] ?? row.period}</Badge>
      ),
    },
    {
      key: "description",
      header: "Описание",
      className: "max-w-[260px] truncate text-muted-foreground",
      cell: (row) => row.description || "—",
    },
    {
      key: "archivedAt",
      header: "Дата архивации",
      sortable: true,
      cell: (row) => (
        <span className="text-muted-foreground">{formatDateRu(row.archivedAt)}</span>
      ),
    },
  ], [employeeNameById]);

  /* -------------------- Client-side filtering -------------------- */

  const policyFiltered = useClientFiltered(policies, policyTable.state, policyColumns);
  const individualFiltered = useClientFiltered(individuals, individualTable.state, individualColumns);
  const restrictionFiltered = useClientFiltered(restrictions, restrictionTable.state, restrictionColumns);
  const archiveFiltered = useClientFiltered(archiveRows, archiveTable.state, archiveColumns);

  const [activeTab, setActiveTab] = useState("policies");

  const TAB_CONFIG: Record<string, { title: string; description: string; createLabel?: string; onCreate?: () => void }> = {
    policies: {
      title: "Политики начисления",
      description: "Автоматическое начисление баллов сотрудникам по правилам",
      createLabel: "Создать политику",
      onCreate: openCreatePolicy,
    },
    individuals: {
      title: "Индивидуальные начисления",
      description: "Исключение из политик для отдельного сотрудника: можно дополнить сумму политики или полностью заменить её для конкретного человека",
      createLabel: "Создать начисление",
      onCreate: openCreateIndividual,
    },
    restrictions: {
      title: "Ограничение льгот",
      description: "Управление доступностью льгот в каталоге сотрудников",
    },
    archive: {
      title: "Архив политик",
      description: "Неактивные политики и начисления",
    },
  };

  const tab = TAB_CONFIG[activeTab] ?? TAB_CONFIG.policies;

  return (
    <div className="page-transition space-y-8 p-6">
      <div className="flex items-start justify-between min-h-[3.5rem]">
        <div>
          <h1 className="text-2xl font-heading font-bold">{tab.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tab.description}</p>
        </div>
        <div className="min-w-[180px] flex justify-end">
          {tab.onCreate && (
            <Button onClick={tab.onCreate}>
              <Plus className="size-4" />
              {tab.createLabel}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="policies">Политики</TabsTrigger>
          <TabsTrigger value="individuals">Индивидуальные</TabsTrigger>
          <TabsTrigger value="restrictions">
            <ShieldOff className="mr-1.5 size-4" />
            Ограничения
          </TabsTrigger>
          <TabsTrigger value="archive">
            <Archive className="mr-1.5 size-4" />
            Архив
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="mt-6">
          <DataTable
            columns={policyColumns}
            data={policyFiltered.filtered}
            total={policyFiltered.total}
            loading={policiesLoading}
            state={policyTable.state}
            onStateChange={policyTable.setState}
            onReset={policyTable.resetFilters}
            searchable={{ placeholder: "Поиск по названию..." }}
            actions={(p) => [
              { label: "Редактировать", icon: Pencil, onClick: () => openEditPolicy(p) },
              ...(p.is_active
                ? [{ label: "В архив", icon: Trash2, onClick: () => deletePolicy(p), variant: "destructive" as const }]
                : []),
            ]}
          />
        </TabsContent>

        <TabsContent value="individuals" className="mt-6">
          <DataTable
            columns={individualColumns}
            data={individualFiltered.filtered}
            total={individualFiltered.total}
            loading={individualsLoading}
            state={individualTable.state}
            onStateChange={individualTable.setState}
            onReset={individualTable.resetFilters}
            searchable={{ placeholder: "Поиск по сотруднику..." }}
            actions={(a) => [
              { label: "Редактировать", icon: Pencil, onClick: () => openEditIndividual(a) },
              ...(a.is_active
                ? [{ label: "В архив", icon: Trash2, onClick: () => deleteIndividual(a), variant: "destructive" as const }]
                : []),
            ]}
          />
        </TabsContent>

        <TabsContent value="restrictions" className="mt-6">
          <DataTable
            columns={restrictionColumns}
            data={restrictionFiltered.filtered}
            total={restrictionFiltered.total}
            loading={restrictionsLoading}
            state={restrictionTable.state}
            onStateChange={restrictionTable.setState}
            onReset={restrictionTable.resetFilters}
            searchable={{ placeholder: "Поиск по названию или провайдеру..." }}
            rowClassName={(row) => row.is_restricted ? "opacity-60" : ""}
          />
        </TabsContent>

        <TabsContent value="archive" className="mt-6">
          <DataTable
            columns={archiveColumns}
            data={archiveFiltered.filtered}
            total={archiveFiltered.total}
            loading={policiesLoading || individualsLoading}
            state={archiveTable.state}
            onStateChange={archiveTable.setState}
            onReset={archiveTable.resetFilters}
            searchable={{ placeholder: "Поиск в архиве..." }}
            rowClassName={() => "opacity-70"}
            actions={(row) => [
              {
                label: "Восстановить",
                icon: RotateCcw,
                onClick: () =>
                  row.kind === "policy"
                    ? restorePolicy(row.policy!)
                    : restoreIndividual(row.individual!),
              },
            ]}
            emptyState={{
              icon: Archive,
              title: "Архив пуст",
              description: "Архивированные политики и начисления появятся здесь",
            }}
          />
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
                <EmployeeCombobox
                  value={individualForm.user_id}
                  onChange={(v) =>
                    setIndividualForm({ ...individualForm, user_id: v })
                  }
                  employees={employees}
                  disabled={!!editingIndividual}
                />
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
