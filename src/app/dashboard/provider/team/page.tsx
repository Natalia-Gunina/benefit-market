"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TeamMember {
  id: string;
  role: string;
  created_at: string;
  users?: { id: string; email: string } | null;
}

const roleLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  owner: { label: "Владелец", variant: "default" },
  admin: { label: "Админ", variant: "secondary" },
  member: { label: "Участник", variant: "outline" },
};

export default function ProviderTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
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
      setDialogOpen(false);
      setFormEmail("");
      setFormRole("member");
      fetchTeam();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(member: TeamMember, newRole: string) {
    try {
      const res = await fetch(`/api/provider/team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error();
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)),
      );
      toast.success("Роль обновлена");
    } catch {
      toast.error("Не удалось обновить роль");
    }
  }

  async function handleRemove(member: TeamMember) {
    if (!confirm(`Удалить ${member.users?.email ?? "участника"} из команды?`)) return;
    try {
      const res = await fetch(`/api/provider/team/${member.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success("Участник удалён");
    } catch {
      toast.error("Не удалось удалить");
    }
  }

  return (
    <div className="page-transition space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Команда</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="size-4" />
          Добавить участника
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Дата добавления</TableHead>
              <TableHead className="w-40">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  В команде пока нет участников
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => {
                const rl = roleLabels[m.role] ?? roleLabels.member;
                const isOwner = m.role === "owner";
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.users?.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rl.variant}>{rl.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString("ru")}
                    </TableCell>
                    <TableCell>
                      {!isOwner && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={m.role}
                            onValueChange={(v) => handleRoleChange(m, v)}
                          >
                            <SelectTrigger className="h-8 w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Админ</SelectItem>
                              <SelectItem value="member">Участник</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemove(m)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add member dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить участника</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="user@example.com"
                required
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
                Добавить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
