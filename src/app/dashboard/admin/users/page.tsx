"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { DataTablePagination } from "@/components/shared/data-table-pagination";

import type { UserRole } from "@/lib/types";

/* -------------------------------------------------------------------------- */

interface UserRow {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  profile?: {
    grade: string;
    location: string;
    legal_entity: string;
  };
  wallet?: {
    balance: number;
  };
  display_name?: string;
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

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const perPage = 20;

  /* ----- Fetch ------------------------------------------------------------ */
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (search) params.set("search", search);
      if (roleFilter && roleFilter !== "all") params.set("role", roleFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setUsers(json.data ?? json);
      setTotal(json.total ?? (json.data ?? json).length);
    } catch {
      toast.error("Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

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

  /* ----- Render ----------------------------------------------------------- */
  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Пользователи</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по email или имени..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={roleFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setRoleFilter("all");
              setPage(1);
            }}
          >
            Все
          </Button>
          {ALL_ROLES.map((r) => (
            <Button
              key={r}
              variant={roleFilter === r ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setRoleFilter(r);
                setPage(1);
              }}
            >
              {ROLE_LABELS[r]}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Имя</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Грейд</TableHead>
              <TableHead>Локация</TableHead>
              <TableHead className="text-right">Баланс</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  Пользователи не найдены
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.display_name ?? "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(v) => requestRoleChange(u.id, u.email, v as UserRole)}
                    >
                      <SelectTrigger className="w-[130px]" size="sm">
                        <SelectValue>
                          <Badge variant={ROLE_VARIANTS[u.role]}>
                            {ROLE_LABELS[u.role]}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{u.profile?.grade ?? "—"}</TableCell>
                  <TableCell>{u.profile?.location ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {u.wallet?.balance != null
                      ? u.wallet.balance.toLocaleString("ru-RU")
                      : "—"}
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
      {/* Role change confirmation dialog */}
      <AlertDialog open={!!pendingRoleChange} onOpenChange={() => setPendingRoleChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изменить роль пользователя?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы собираетесь изменить роль пользователя{" "}
              <strong>{pendingRoleChange?.email}</strong> на{" "}
              <strong>{pendingRoleChange ? ROLE_LABELS[pendingRoleChange.newRole] : ""}</strong>.
              Это повлияет на его права доступа в системе.
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
