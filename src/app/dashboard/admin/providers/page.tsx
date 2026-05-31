"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Ban, Check, Loader2, Plus, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

import { DataTable, useLocalTableState, useClientFiltered } from "@/components/data-table";
import type { ColumnDef } from "@/components/data-table";

interface Provider {
  id: string;
  name: string;
  slug: string;
  status: string;
  contact_email: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Ожидает", variant: "outline" },
  verified: { label: "Верифицирован", variant: "default" },
  suspended: { label: "Заблокирован", variant: "destructive" },
  rejected: { label: "Отклонён", variant: "destructive" },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const table = useLocalTableState();

  const loadProviders = useCallback(() => {
    setIsLoading(true);
    fetch("/api/admin/providers?per_page=1000")
      .then((r) => r.json())
      .then((json) => setProviders(json.data?.data ?? json.data ?? []))
      .catch(() => toast.error("Ошибка загрузки данных"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  /* ----- Actions ----- */

  const handleVerify = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/providers/${id}/verify`, { method: "POST" });
      if (res.ok) {
        toast.success("Провайдер верифицирован");
        loadProviders();
      } else {
        toast.error("Ошибка верификации");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить провайдера и все его предложения? Это действие нельзя отменить.")) return;
    try {
      const res = await fetch(`/api/admin/providers/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Провайдер и его предложения удалены");
        loadProviders();
      } else {
        toast.error("Не удалось удалить провайдера");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  /* ----- Suspend ----- */

  const [suspendId, setSuspendId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [isSuspending, setIsSuspending] = useState(false);

  const handleSuspend = async () => {
    if (!suspendId) return;
    setIsSuspending(true);
    try {
      const res = await fetch(`/api/admin/providers/${suspendId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: suspendReason || "Нарушение правил" }),
      });
      if (res.ok) {
        toast.success("Провайдер заблокирован");
        loadProviders();
      } else {
        toast.error("Ошибка");
      }
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setIsSuspending(false);
      setSuspendId(null);
      setSuspendReason("");
    }
  };

  /* ----- Create dialog ----- */

  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formLogoUrl, setFormLogoUrl] = useState("");

  function resetCreateForm() {
    setFormName("");
    setFormDescription("");
    setFormEmail("");
    setFormPhone("");
    setFormWebsite("");
    setFormAddress("");
    setFormLogoUrl("");
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Укажите название провайдера");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim(),
          contact_email: formEmail.trim(),
          contact_phone: formPhone.trim(),
          website: formWebsite.trim(),
          address: formAddress.trim(),
          logo_url: formLogoUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error?.message ?? "Не удалось создать провайдера");
        return;
      }
      toast.success("Провайдер создан");
      setCreateOpen(false);
      resetCreateForm();
      loadProviders();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setIsCreating(false);
    }
  };

  /* ----- Columns ----- */

  const columns: ColumnDef<Provider>[] = useMemo(() => [
    {
      key: "name",
      header: "Название",
      sortable: true,
      filter: { type: "text" },
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "slug",
      header: "Slug",
      sortable: true,
      className: "text-muted-foreground",
    },
    {
      key: "contact_email",
      header: "Email",
      sortable: true,
      filter: { type: "text" },
      cell: (row) => row.contact_email ?? "—",
    },
    {
      key: "status",
      header: "Статус",
      filter: { type: "select", options: STATUS_OPTIONS },
      cell: (row) => {
        const st = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.pending;
        return <Badge variant={st.variant}>{st.label}</Badge>;
      },
    },
  ], []);

  const filtered = useClientFiltered(providers, table.state, columns);

  return (
    <div className="page-transition space-y-8 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Провайдеры</h1>
          <p className="mt-1 text-sm text-muted-foreground">Поставщики льгот и услуг на платформе</p>
        </div>
        <Button onClick={() => { resetCreateForm(); setCreateOpen(true); }}>
          <Plus className="size-4" />
          Добавить провайдера
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered.filtered}
        total={filtered.total}
        loading={isLoading}
        state={table.state}
        onStateChange={table.setState}
        onReset={table.resetFilters}
        searchable={{ placeholder: "Поиск по названию или email..." }}
        actions={(p) => [
          ...(p.status === "pending"
            ? [{ label: "Верифицировать", icon: Check, onClick: () => handleVerify(p.id) }]
            : []),
          ...(p.status !== "suspended"
            ? [{ label: "Заблокировать", icon: Ban, onClick: () => setSuspendId(p.id), variant: "destructive" as const }]
            : []),
          { label: "Удалить", icon: Trash2, onClick: () => handleDelete(p.id), variant: "destructive" as const },
        ]}
        emptyState={{
          icon: Store,
          title: "Нет провайдеров",
          description: "Добавьте первого провайдера",
        }}
      />

      {/* Suspend confirmation */}
      <AlertDialog open={!!suspendId} onOpenChange={() => { setSuspendId(null); setSuspendReason(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Заблокировать провайдера?</AlertDialogTitle>
            <AlertDialogDescription>
              Провайдер будет заблокирован и его предложения станут недоступны.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="suspend-reason">Причина блокировки</Label>
            <Input
              id="suspend-reason"
              placeholder="Укажите причину..."
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSuspending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspend}
              disabled={isSuspending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSuspending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Блокируем...
                </>
              ) : (
                "Заблокировать"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create provider dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый провайдер</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider-name">Название компании-провайдера *</Label>
              <Input
                id="provider-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Например, World Class"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-description">Описание</Label>
              <Textarea
                id="provider-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Краткое описание провайдера и его услуг"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="provider-email">Email</Label>
                <Input
                  id="provider-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-phone">Телефон</Label>
                <Input
                  id="provider-phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+7 (495) 000-00-00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-website">Сайт</Label>
              <Input
                id="provider-website"
                type="url"
                value={formWebsite}
                onChange={(e) => setFormWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-address">Адрес</Label>
              <Input
                id="provider-address"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Город, улица, дом"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-logo">Логотип (URL)</Label>
              <div className="flex items-center gap-3">
                {formLogoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={formLogoUrl} alt="" className="size-8 rounded border object-contain" />
                )}
                <Input
                  id="provider-logo"
                  className="flex-1"
                  value={formLogoUrl}
                  onChange={(e) => setFormLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              {formWebsite && !formLogoUrl && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    try {
                      const domain = new URL(formWebsite).hostname;
                      setFormLogoUrl(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
                    } catch { /* invalid url */ }
                  }}
                >
                  Сгенерировать из сайта
                </button>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isCreating}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="size-4 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
