"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

import { DataTable, useLocalTableState, useClientFiltered } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";

interface TeamMember {
  id: string;
  role: string;
  created_at: string;
  users?: { id: string; email: string } | null;
}

const ROLE_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  owner: { label: "Владелец", variant: "default" },
  admin: { label: "Админ", variant: "secondary" },
  member: { label: "Участник", variant: "outline" },
};

const ROLE_OPTIONS = Object.entries(ROLE_CONFIG).map(([value, { label }]) => ({ value, label }));

export default function ProviderTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const table = useLocalTableState();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<string>("member");

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/provider/team");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setMembers(json.data ?? []);
    } catch {
      toast.error("Не удалось загрузить команду");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  function openAdd() {
    setEditingMember(null);
    setFormEmail("");
    setFormRole("member");
    setDialogOpen(true);
  }

  function openEditRole(member: TeamMember) {
    setEditingMember(member);
    setFormEmail(member.users?.email ?? "");
    setFormRole(member.role);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingMember) {
        const res = await fetch(`/api/provider/team/${editingMember.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: formRole }),
        });
        if (!res.ok) throw new Error();
        setMembers((prev) =>
          prev.map((m) => (m.id === editingMember.id ? { ...m, role: formRole } : m)),
        );
        toast.success("Роль обновлена");
      } else {
        const res = await fetch("/api/provider/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formEmail, role: formRole }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error?.message || "Ошибка");
        }
        toast.success("Участник добавлен");
        fetchTeam();
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(member: TeamMember) {
    if (!confirm(`Удалить ${member.users?.email ?? "участника"} из команды?`)) return;
    try {
      const res = await fetch(`/api/provider/team/${member.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success("Участник удалён");
    } catch {
      toast.error("Не удалось удалить");
    }
  }

  const columns: ColumnDef<TeamMember>[] = useMemo(() => [
    {
      key: "users",
      header: "Email",
      sortable: true,
      filter: { type: "text" },
      cell: (row) => <span className="font-medium">{row.users?.email ?? "—"}</span>,
    },
    {
      key: "role",
      header: "Роль",
      filter: { type: "select", options: ROLE_OPTIONS },
      cell: (row) => {
        const rl = ROLE_CONFIG[row.role] ?? ROLE_CONFIG.member;
        return <Badge variant={rl.variant}>{rl.label}</Badge>;
      },
    },
    {
      key: "created_at",
      header: "Дата добавления",
      sortable: true,
      className: "text-muted-foreground",
      cell: (row) => new Date(row.created_at).toLocaleDateString("ru"),
    },
  ], []);

  const filtered = useClientFiltered(members, table.state, columns);

  return (
    <div className="page-transition space-y-8 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Команда</h1>
          <p className="mt-1 text-sm text-muted-foreground">Участники с доступом к кабинету провайдера</p>
        </div>
        <Button onClick={openAdd}>
          <UserPlus className="size-4" />
          Добавить участника
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered.filtered}
        total={filtered.total}
        loading={loading}
        state={table.state}
        onStateChange={table.setState}
        onReset={table.resetFilters}
        searchable={{ placeholder: "Поиск по email..." }}
        actions={(m) =>
          m.role === "owner"
            ? []
            : [
                { label: "Изменить роль", icon: Pencil, onClick: () => openEditRole(m) },
                { label: "Удалить", icon: Trash2, onClick: () => handleRemove(m), variant: "destructive" as const },
              ]
        }
        emptyState={{
          icon: Users,
          title: "Команда пуста",
          description: "Добавьте участников для совместной работы",
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? "Изменить роль" : "Добавить участника"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="user@example.com"
                required
                disabled={!!editingMember}
              />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Админ</SelectItem>
                  <SelectItem value="member">Участник</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editingMember ? "Сохранить" : "Добавить"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
