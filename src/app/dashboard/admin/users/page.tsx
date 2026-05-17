"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import { DataTable, useTableState } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";
import type { UserRole } from "@/lib/types";

/* -------------------------------------------------------------------------- */

interface UserRow {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  department?: string;
  grade?: string;
  location?: string;
  balance?: number;
  is_active?: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  employee: "Сотрудник",
  hr: "HR",
  admin: "Админ",
  provider: "Провайдер",
};

const ROLE_VARIANTS: Record<UserRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  hr: "secondary",
  employee: "outline",
  provider: "outline",
};

const ALL_ROLES: UserRole[] = ["employee", "hr", "admin", "provider"];

const ROLE_OPTIONS = ALL_ROLES.map((r) => ({
  value: r,
  label: ROLE_LABELS[r],
}));

/* -------------------------------------------------------------------------- */

function RoleBadge({
  user,
  onRequestChange,
}: {
  user: UserRow;
  onRequestChange: (userId: string, email: string, newRole: UserRole) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <Badge
            variant={ROLE_VARIANTS[user.role]}
            className="text-xs hover:ring-2 hover:ring-ring/20 transition-shadow"
          >
            {ROLE_LABELS[user.role]}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-36 p-1"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {ALL_ROLES.map((r) => (
          <button
            key={r}
            className={cn(
              "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-muted",
              r === user.role && "bg-primary/10 font-medium"
            )}
            onClick={() => {
              if (r !== user.role) {
                onRequestChange(user.id, user.email, r);
              }
              setOpen(false);
            }}
          >
            <Badge variant={ROLE_VARIANTS[r]} className="text-xs">
              {ROLE_LABELS[r]}
            </Badge>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */

export default function UsersPage() {
  const { state, setState, resetFilters } = useTableState({ pageSize: 20 });

  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ----- Fetch ------------------------------------------------------------ */
  const fetchUsers = useCallback(async () => {
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

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Не удалось загрузить пользователей");
      const json = await res.json();
      setUsers(json.data ?? []);
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
    fetchUsers();
  }, [fetchUsers]);

  /* ----- Role change confirmation ----------------------------------------- */
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    userId: string;
    email: string;
    newRole: UserRole;
  } | null>(null);

  function requestRoleChange(userId: string, email: string, newRole: UserRole) {
    setPendingRoleChange({ userId, email, newRole });
  }

  async function confirmRoleChange() {
    if (!pendingRoleChange) return;
    const { userId, newRole } = pendingRoleChange;
    try {
      const res = await fetch(`/api/admin/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role: newRole }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success("Роль обновлена");
    } catch {
      toast.error("Не удалось обновить роль");
    } finally {
      setPendingRoleChange(null);
    }
  }

  /* ----- Columns ---------------------------------------------------------- */
  const columns: ColumnDef<UserRow>[] = [
    {
      key: "full_name",
      header: "Пользователь",
      sortable: true,
      filter: { type: "text" },
      filterKey: "name",
      cell: (row) => (
        <div>
          <span className="font-medium">{row.full_name ?? row.email.split("@")[0]}</span>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Роль",
      filter: { type: "select", options: ROLE_OPTIONS },
      cell: (row) => (
        <RoleBadge user={row} onRequestChange={requestRoleChange} />
      ),
    },
    {
      key: "grade",
      header: "Грейд",
      sortable: true,
      filter: {
        type: "select",
        options: [
          { value: "junior", label: "Junior" },
          { value: "middle", label: "Middle" },
          { value: "senior", label: "Senior" },
          { value: "lead", label: "Lead" },
        ],
      },
      filterKey: "grade",
      cell: (row) => row.grade ?? "—",
    },
    {
      key: "location",
      header: "Локация",
      filter: { type: "text" },
      filterKey: "location",
      cell: (row) => row.location ?? "—",
    },
    {
      key: "balance",
      header: "Баланс",
      sortable: true,
      className: "text-right tabular-nums",
      headerClassName: "text-right",
      cell: (row) =>
        row.balance != null
          ? row.balance.toLocaleString("ru-RU")
          : "—",
    },
  ];

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Пользователи</h1>
        <p className="mt-1 text-sm text-muted-foreground">Управление ролями и доступом</p>
      </div>

      <DataTable
        columns={columns}
        data={users}
        total={total}
        loading={loading}
        error={error}
        state={state}
        onStateChange={setState}
        onReset={resetFilters}
        searchable={{ placeholder: "Поиск по email или имени..." }}
      />

      <AlertDialog
        open={!!pendingRoleChange}
        onOpenChange={() => setPendingRoleChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изменить роль пользователя?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы собираетесь изменить роль пользователя{" "}
              <strong>{pendingRoleChange?.email}</strong> на{" "}
              <strong>
                {pendingRoleChange ? ROLE_LABELS[pendingRoleChange.newRole] : ""}
              </strong>
              . Это повлияет на его права доступа в системе.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
