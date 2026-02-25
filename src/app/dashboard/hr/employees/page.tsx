"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployeeProfile {
  grade: string;
  tenure_months: number;
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
}

interface Meta {
  page: number;
  per_page: number;
  total: number;
}

type SortKey = "name" | "email" | "grade" | "location" | "legal_entity" | "balance" | "tenure";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTenure(months: number): string {
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (years === 0) return `${remaining} мес.`;
  if (remaining === 0) return `${years} г.`;
  return `${years} г. ${remaining} мес.`;
}

// ---------------------------------------------------------------------------
// Table Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, per_page: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  // --- Debounce search ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // --- Fetch employees ---
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "20",
      });
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const res = await fetch(`/api/hr/employees?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setEmployees(json.data);
      setMeta(json.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // --- Client-side sorting ---
  const sortedEmployees = useMemo(() => {
    const sorted = [...employees].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortKey) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "email":
          aVal = a.email.toLowerCase();
          bVal = b.email.toLowerCase();
          break;
        case "grade":
          aVal = (a.profile?.grade ?? "").toLowerCase();
          bVal = (b.profile?.grade ?? "").toLowerCase();
          break;
        case "location":
          aVal = (a.profile?.location ?? "").toLowerCase();
          bVal = (b.profile?.location ?? "").toLowerCase();
          break;
        case "legal_entity":
          aVal = (a.profile?.legal_entity ?? "").toLowerCase();
          bVal = (b.profile?.legal_entity ?? "").toLowerCase();
          break;
        case "balance":
          aVal = a.wallet?.balance ?? 0;
          bVal = b.wallet?.balance ?? 0;
          break;
        case "tenure":
          aVal = a.profile?.tenure_months ?? 0;
          bVal = b.profile?.tenure_months ?? 0;
          break;
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [employees, sortKey, sortDir]);

  // --- Sort toggle ---
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // --- Pagination ---
  const totalPages = Math.ceil(meta.total / meta.per_page) || 1;

  function SortableHead({
    label,
    sortKeyName,
  }: {
    label: string;
    sortKeyName: SortKey;
  }) {
    return (
      <TableHead>
        <button
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => toggleSort(sortKeyName)}
        >
          {label}
          <ArrowUpDown
            className={`size-3 ${
              sortKey === sortKeyName
                ? "text-primary"
                : "text-muted-foreground/50"
            }`}
          />
        </button>
      </TableHead>
    );
  }

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Сотрудники</h1>

      {/* --- Search --- */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* --- Error --- */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-error-light px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* --- Table --- */}
      <Card>
        <CardContent>
          {loading ? (
            <TableSkeleton />
          ) : sortedEmployees.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {debouncedSearch
                ? "Сотрудники не найдены"
                : "Нет сотрудников"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="ФИО" sortKeyName="name" />
                    <SortableHead label="Email" sortKeyName="email" />
                    <SortableHead label="Грейд" sortKeyName="grade" />
                    <SortableHead label="Локация" sortKeyName="location" />
                    <SortableHead
                      label="Юрлицо"
                      sortKeyName="legal_entity"
                    />
                    <SortableHead label="Баланс баллов" sortKeyName="balance" />
                    <SortableHead label="Стаж" sortKeyName="tenure" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">
                        {emp.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {emp.email}
                      </TableCell>
                      <TableCell>{emp.profile?.grade ?? "-"}</TableCell>
                      <TableCell>{emp.profile?.location ?? "-"}</TableCell>
                      <TableCell>
                        {emp.profile?.legal_entity ?? "-"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {emp.wallet
                          ? emp.wallet.balance.toLocaleString("ru-RU")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {emp.profile
                          ? formatTenure(emp.profile.tenure_months)
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Pagination --- */}
      {!loading && meta.total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Всего: {meta.total} сотрудников
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
              Назад
            </Button>
            <span className="text-sm tabular-nums text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперед
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
