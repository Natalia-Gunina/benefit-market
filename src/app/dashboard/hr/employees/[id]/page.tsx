"use client";

import { useCallback, useEffect, useState, use } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface Profile {
  grade: string;
  tenure_months: number;
  location: string;
  legal_entity: string;
  extra: Record<string, unknown>;
}

interface Wallet {
  id: string;
  balance: number;
  reserved: number;
  period: string;
  expires_at: string;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price_points: number;
}

interface Order {
  id: string;
  status: string;
  total_points: number;
  created_at: string;
  order_items: OrderItem[];
}

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

interface EmployeeDetail {
  id: string;
  name: string;
  email: string;
  role: string;
  profile: Profile;
  wallet: Wallet | null;
  orders: Order[];
  ledger: LedgerEntry[];
}

const orderStatusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Оплачен", variant: "default" },
  reserved: { label: "Зарезервирован", variant: "secondary" },
  cancelled: { label: "Отменён", variant: "destructive" },
  expired: { label: "Истёк", variant: "outline" },
};

const ledgerTypeLabel: Record<string, string> = {
  accrual: "Начисление",
  spend: "Списание",
  reserve: "Резерв",
  release: "Возврат",
  expire: "Истечение",
};

const maritalLabel: Record<string, string> = {
  married: "В браке",
  unmarried: "Не в браке",
};

const workFormatLabel: Record<string, string> = {
  on_site: "На месте работодателя",
  hybrid: "Гибридный",
  remote: "Удалённый",
};

const priorityLabel: Record<string, string> = {
  health: "Здоровье и самочувствие",
  family: "Семья и дети",
  comfort: "Комфорт и быт",
  career: "Развитие и карьера",
  leisure: "Впечатления и досуг",
};

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU");
}

function formatDateTime(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HrEmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accrualOpen, setAccrualOpen] = useState(false);
  const [accrualAmount, setAccrualAmount] = useState("");
  const [accrualDesc, setAccrualDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/employees/${id}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
    } catch {
      setError("Не удалось загрузить сотрудника");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitAccrual() {
    const amount = Number(accrualAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Введите положительное число баллов");
      return;
    }
    if (!accrualDesc.trim()) {
      toast.error("Укажите комментарий к начислению");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/hr/employees/${id}/accrue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, description: accrualDesc.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error?.message ?? "Не удалось начислить баллы");
        return;
      }
      toast.success(`Начислено ${amount.toLocaleString("ru-RU")} б.`);
      setAccrualOpen(false);
      setAccrualAmount("");
      setAccrualDesc("");
      await load();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Загрузка...</div>;
  if (error || !data) return <div className="p-6 text-destructive">{error ?? "Нет данных"}</div>;

  const extra = data.profile.extra ?? {};
  const marital = extra.marital_status as string | undefined;
  const hasChildren = extra.has_children as boolean | undefined;
  const children = (extra.children as { birthday: string }[] | undefined) ?? [];
  const workFormat = extra.work_format as string | undefined;
  const hasPets = extra.has_pets as string | undefined;
  const priorities = (extra.priorities as string[] | undefined) ?? [];

  return (
    <div className="page-transition space-y-6 p-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/hr/employees">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold">{data.name}</h1>
          <p className="text-sm text-muted-foreground">{data.email}</p>
        </div>
        <Button onClick={() => setAccrualOpen(true)}>
          <Plus className="size-4" />
          Начислить баллы
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Wallet */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Кошелёк</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.wallet ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold tabular-nums">
                    {data.wallet.balance.toLocaleString("ru-RU")}
                  </span>
                  <span className="text-sm text-muted-foreground">баллов</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Зарезервировано: {data.wallet.reserved.toLocaleString("ru-RU")}
                </div>
                <div className="text-sm text-muted-foreground">
                  Период: {data.wallet.period} · до {formatDate(data.wallet.expires_at)}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Кошелёк не создан</p>
            )}
          </CardContent>
        </Card>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Профиль</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Field label="Грейд" value={data.profile.grade || "—"} />
            <Field label="Локация" value={data.profile.location || "—"} />
            <Field label="Юрлицо" value={data.profile.legal_entity || "—"} />
            <Field
              label="Стаж"
              value={
                data.profile.tenure_months > 0
                  ? `${Math.floor(data.profile.tenure_months / 12)} г. ${
                      data.profile.tenure_months % 12
                    } мес.`
                  : "—"
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Personal extras (from employee self-profile) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Личные данные сотрудника</CardTitle>
          <p className="text-xs text-muted-foreground">
            Заполняется самим сотрудником в его кабинете. Используйте для подбора льгот.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <Field
            label="Семейное положение"
            value={marital ? maritalLabel[marital] ?? marital : "не указано"}
          />
          <Field
            label="Формат работы"
            value={workFormat ? workFormatLabel[workFormat] ?? workFormat : "не указано"}
          />
          <Field
            label="Несовершеннолетние дети"
            value={
              hasChildren === undefined
                ? "не указано"
                : hasChildren
                  ? children.length > 0
                    ? `${children.length} (${children
                        .map((c) => formatDate(c.birthday))
                        .join(", ")})`
                    : "есть"
                  : "нет"
            }
          />
          <Field
            label="Домашние животные"
            value={hasPets === "yes" ? "есть" : hasPets === "no" ? "нет" : "не указано"}
          />
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-muted-foreground text-xs">Приоритеты</Label>
            {priorities.length === 0 ? (
              <p className="text-muted-foreground">не указано</p>
            ) : (
              <ol className="text-sm space-y-0.5">
                {priorities.map((p, i) => (
                  <li key={p}>
                    <span className="text-muted-foreground tabular-nums">{i + 1}.</span>{" "}
                    {priorityLabel[p] ?? p}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">История заказов ({data.orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет заказов</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Льготы</TableHead>
                  <TableHead className="text-right">Баллов</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orders.map((o) => {
                  const st = orderStatusLabel[o.status] ?? { label: o.status, variant: "outline" as const };
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(o.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {o.order_items.map((oi) => oi.name).join(", ")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {o.total_points.toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Движение баллов</CardTitle>
        </CardHeader>
        <CardContent>
          {data.ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет операций</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Операция</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ledger.slice(0, 30).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(l.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ledgerTypeLabel[l.type] ?? l.type}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.description}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        l.amount >= 0 ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {l.amount >= 0 ? "+" : ""}
                      {l.amount.toLocaleString("ru-RU")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Accrual dialog */}
      <Dialog open={accrualOpen} onOpenChange={setAccrualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Начислить баллы</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Сумма</Label>
              <Input
                type="number"
                min={1}
                value={accrualAmount}
                onChange={(e) => setAccrualAmount(e.target.value)}
                placeholder="Например, 5000"
              />
            </div>
            <div className="space-y-1">
              <Label>Комментарий</Label>
              <Input
                value={accrualDesc}
                onChange={(e) => setAccrualDesc(e.target.value)}
                placeholder="Бонус за переработки в апреле"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAccrualOpen(false)} disabled={submitting}>
              Отмена
            </Button>
            <Button onClick={submitAccrual} disabled={submitting}>
              {submitting ? "Начисление..." : "Начислить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
