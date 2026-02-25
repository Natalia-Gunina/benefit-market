"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

export default function HrPoliciesPage() {
  const [policies, setPolicies] = useState<BudgetPolicy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 20;

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : policies.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
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
    </div>
  );
}
