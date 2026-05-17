"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { DataTable, useTableState } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployeeProfile {
  grade: string;
  grade_numeric: number | null;
  tenure_months: number;
  hire_date: string | null;
  location: string;
  legal_entity: string;
  extra: Record<string, unknown>;
}

interface EmployeeWallet {
  balance: number;
  reserved: number;
}

interface Employee {
  id: string;
  email: string;
  role: string;
  created_at: string;
  name: string;
  profile: EmployeeProfile | null;
  wallet: EmployeeWallet | null;
  initial_limit: number;
  remaining_balance: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pluralYears(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "лет";
  if (mod10 === 1) return "год";
  if (mod10 >= 2 && mod10 <= 4) return "года";
  return "лет";
}

function fullYearsSince(hireDate: string | null): number | null {
  if (!hireDate) return null;
  const hire = new Date(hireDate);
  if (Number.isNaN(hire.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - hire.getFullYear();
  const m = now.getMonth() - hire.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < hire.getDate())) {
    years--;
  }
  return Math.max(0, years);
}

function formatTenureYears(hireDate: string | null): string {
  const years = fullYearsSince(hireDate);
  if (years === null) return "-";
  return `${years} ${pluralYears(years)}`;
}

function formatHireDate(hireDate: string | null): string {
  if (!hireDate) return "-";
  const d = new Date(hireDate);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ru-RU");
}

function formatGrade(profile: EmployeeProfile | null): string {
  if (!profile) return "-";
  if (profile.grade_numeric !== null && profile.grade_numeric !== undefined) {
    return String(profile.grade_numeric);
  }
  return profile.grade || "-";
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const GRADE_OPTIONS = [
  { value: "junior", label: "11 — Junior" },
  { value: "middle", label: "13 — Middle" },
  { value: "senior", label: "15 — Senior" },
  { value: "lead", label: "17+ — Lead" },
];

const LOCATION_OPTIONS = [
  { value: "Москва", label: "Москва" },
  { value: "Санкт-Петербург", label: "Санкт-Петербург" },
  { value: "Казань", label: "Казань" },
];

function buildColumns(): ColumnDef<Employee>[] {
  return [
    {
      key: "name",
      header: "Сотрудник",
      sortable: true,
      filter: { type: "text" },
      filterKey: "search",
      cell: (row) => (
        <div>
          <Link
            href={`/dashboard/hr/employees/${row.id}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.name}
          </Link>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: "grade",
      header: "Грейд",
      sortable: true,
      filter: { type: "select", options: GRADE_OPTIONS },
      filterKey: "grade",
      className: "tabular-nums",
      cell: (row) => formatGrade(row.profile),
    },
    {
      key: "location",
      header: "Локация",
      filter: { type: "select", options: LOCATION_OPTIONS },
      filterKey: "location",
      cell: (row) => row.profile?.location ?? "-",
    },
    {
      key: "hire_date",
      header: "Дата приема",
      sortable: true,
      className: "tabular-nums",
      cell: (row) => formatHireDate(row.profile?.hire_date ?? null),
    },
    {
      key: "tenure",
      header: "Стаж",
      sortable: true,
      filter: { type: "number" },
      filterKey: "tenure",
      cell: (row) => formatTenureYears(row.profile?.hire_date ?? null),
    },
    {
      key: "initial_limit",
      header: "Лимит",
      sortable: true,
      filter: { type: "number" },
      filterKey: "initial_limit",
      className: "text-right tabular-nums",
      headerClassName: "text-right",
      cell: (row) => row.initial_limit.toLocaleString("ru-RU"),
    },
    {
      key: "remaining_balance",
      header: "Остаток",
      sortable: true,
      filter: { type: "number" },
      filterKey: "remaining_balance",
      className: "text-right tabular-nums",
      headerClassName: "text-right",
      cell: (row) => row.remaining_balance.toLocaleString("ru-RU"),
    },
    {
      key: "legal_entity",
      header: "Юрлицо",
      cell: (row) => row.profile?.legal_entity ?? "-",
    },
  ];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmployeesPage() {
  const router = useRouter();
  const { state, setState, resetFilters } = useTableState({ pageSize: 20 });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
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

      const res = await fetch(`/api/hr/employees?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setEmployees(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="page-transition space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Сотрудники</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Профили, грейды, бюджеты и остатки баллов сотрудников
        </p>
      </div>

      <DataTable
        columns={buildColumns()}
        data={employees}
        total={total}
        loading={loading}
        error={error}
        state={state}
        onStateChange={setState}
        onReset={resetFilters}
        searchable={{ placeholder: "Поиск по имени или email..." }}
        onRowClick={(emp) => router.push(`/dashboard/hr/employees/${emp.id}`)}
      />
    </div>
  );
}
