"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable, useTableState } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";
import type { AuditLog } from "@/lib/types";

/* -------------------------------------------------------------------------- */

const ENTITY_OPTIONS = [
  "benefit",
  "benefit_category",
  "budget_policy",
  "eligibility_rule",
  "order",
  "user",
  "tenant",
  "wallet",
].map((v) => ({ value: v, label: v }));

const ACTION_OPTIONS = [
  { value: "create", label: "create" },
  { value: "update", label: "update" },
  { value: "delete", label: "delete" },
];

/* -------------------------------------------------------------------------- */

export default function AuditPage() {
  const { state, setState, resetFilters } = useTableState({ pageSize: 25 });

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ----- Fetch ------------------------------------------------------------ */
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(state.page));
      params.set("per_page", String(state.pageSize));
      if (state.sort) {
        params.set("sort_by", state.sort.key);
        params.set("sort_dir", state.sort.direction);
      }

      Object.entries(state.filters).forEach(([k, v]) => {
        if (!v) return;
        if (k === "created_at") {
          const [from, to] = v.split("~");
          if (from) params.set("date_from", from);
          if (to) params.set("date_to", to);
        } else {
          params.set(k, v);
        }
      });

      const res = await fetch(`/api/admin/audit-log?${params}`);
      if (!res.ok) throw new Error("Не удалось загрузить аудит-лог");
      const json = await res.json();
      setLogs(json.data ?? []);
      setTotal(json.meta?.total ?? json.total ?? (json.data ?? []).length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка загрузки";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [state]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  /* ----- Columns ---------------------------------------------------------- */
  const columns: ColumnDef<AuditLog>[] = [
    {
      key: "created_at",
      header: "Дата",
      sortable: true,
      filter: { type: "date-range" },
      cell: (row) =>
        new Date(row.created_at).toLocaleString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      key: "user_id",
      header: "Пользователь",
      cell: (row) => (
        <span className="font-mono text-xs">{row.user_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: "action",
      header: "Действие",
      filter: { type: "select", options: ACTION_OPTIONS },
    },
    {
      key: "entity_type",
      header: "Сущность",
      filter: { type: "select", options: ENTITY_OPTIONS },
    },
    {
      key: "entity_id",
      header: "ID сущности",
      cell: (row) => (
        <span className="font-mono text-xs">{row.entity_id.slice(0, 8)}...</span>
      ),
    },
  ];

  /* ----- Expandable diff -------------------------------------------------- */
  function renderDiff(log: AuditLog) {
    if (!log.diff || Object.keys(log.diff).length === 0) return null;
    return (
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Diff (JSON)
        </p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-background border p-3 text-xs font-mono">
          {JSON.stringify(log.diff, null, 2)}
        </pre>
      </div>
    );
  }

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Аудит-лог</h1>
        <p className="mt-1 text-sm text-muted-foreground">История действий пользователей в системе</p>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        total={total}
        loading={loading}
        error={error}
        state={state}
        onStateChange={setState}
        onReset={resetFilters}
        expandable={(log) => renderDiff(log)}
      />
    </div>
  );
}
