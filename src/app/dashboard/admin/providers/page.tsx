"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Check, Ban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Provider {
  id: string;
  name: string;
  slug: string;
  status: string;
  contact_email: string | null;
  created_at: string;
}

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Ожидает", variant: "outline" },
  verified: { label: "Верифицирован", variant: "default" },
  suspended: { label: "Заблокирован", variant: "destructive" },
  rejected: { label: "Отклонён", variant: "destructive" },
};

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProviders = useCallback(() => {
    setIsLoading(true);
    fetch("/api/admin/providers")
      .then((r) => r.json())
      .then((json) => setProviders(json.data?.data ?? json.data ?? []))
      .catch(() => toast.error("Ошибка загрузки данных"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);

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

  const handleSuspend = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/providers/${id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Нарушение правил" }),
      });
      if (res.ok) {
        toast.success("Провайдер заблокирован");
        loadProviders();
      } else {
        toast.error("Ошибка");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/providers/${id}`, {
        method: "DELETE",
      });
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

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Управление провайдерами</h1>

      {isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : providers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Провайдеры не найдены
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Провайдеры ({providers.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {providers.map((p) => {
                const st = statusBadge[p.status] ?? statusBadge.pending;
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{p.slug} &middot; {p.contact_email ?? "—"}</p>
                    </div>
                    <div className="flex gap-2">
                      {p.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => handleVerify(p.id)}>
                          <Check className="mr-1 size-3.5" />Верифицировать
                        </Button>
                      )}
                      {p.status !== "suspended" && (
                        <Button size="sm" variant="ghost" onClick={() => handleSuspend(p.id)}>
                          <Ban className="mr-1 size-3.5" />Заблокировать
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <Trash2 className="mr-1 size-3.5 text-destructive" />
                            Удалить
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить провайдера «{p.name}»?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Провайдер и все его предложения (льготы) будут удалены безвозвратно.
                              Это действие нельзя отменить.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(p.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Удалить провайдера
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
