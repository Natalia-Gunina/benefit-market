"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEMO_LS_KEY = "demo_employee_profile_extra";

const maritalOptions = [
  { value: "unmarried", label: "Не в браке" },
  { value: "married", label: "В браке" },
] as const;

const workFormatOptions = [
  { value: "on_site", label: "На месте работодателя" },
  { value: "hybrid", label: "Гибридный" },
  { value: "remote", label: "Удалённый" },
] as const;

const petOptions = [
  { value: "yes", label: "Да" },
  { value: "no", label: "Нет" },
] as const;

const priorityOptions = [
  { value: "health", label: "Здоровье и самочувствие" },
  { value: "family", label: "Семья и дети" },
  { value: "comfort", label: "Комфорт и бытовые удобства" },
  { value: "career", label: "Развитие и карьера" },
  { value: "leisure", label: "Впечатления и досуг" },
] as const;

const DEFAULT_PRIORITIES = priorityOptions.map((p) => p.value) as string[];

const genderLabel: Record<string, string> = {
  male: "Мужской",
  female: "Женский",
  other: "Другой",
};

function labelOf<T extends { value: string; label: string }>(
  list: readonly T[],
  value: string,
): string {
  return list.find((o) => o.value === value)?.label ?? "—";
}

interface Child {
  birthday: string;
}

interface ProfileState {
  full_name: string;
  gender: string;
  company: string;
  birthday: string;
  marital_status: string;
  has_children: boolean;
  children: Child[];
  work_format: string;
  has_pets: string;
  priorities: string[];
}

const EMPTY: ProfileState = {
  full_name: "",
  gender: "",
  company: "",
  birthday: "",
  marital_status: "",
  has_children: false,
  children: [],
  work_format: "",
  has_pets: "",
  priorities: DEFAULT_PRIORITIES,
};

function ageFromBirthday(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU");
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function EmployeeProfilePage() {
  const [profile, setProfile] = useState<ProfileState>(EMPTY);
  const [snapshot, setSnapshot] = useState<ProfileState>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const today = useMemo(() => todayIso(), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/employee/profile")
      .then(async (r) => {
        if (!r.ok) throw new Error("load failed");
        const json = await r.json();
        const data = json.data as ProfileState;
        if (cancelled) return;

        // In demo mode the API does not persist edits, so layer the
        // last-saved client copy on top to give a satisfying UX.
        let extra: Partial<ProfileState> = {};
        try {
          const raw = localStorage.getItem(DEMO_LS_KEY);
          if (raw) extra = JSON.parse(raw) as Partial<ProfileState>;
        } catch {
          // ignore
        }

        const merged: ProfileState = {
          ...data,
          marital_status: extra.marital_status ?? data.marital_status ?? "",
          has_children: extra.has_children ?? data.has_children ?? false,
          children: extra.children ?? data.children ?? [],
          work_format: extra.work_format ?? data.work_format ?? "",
          has_pets: extra.has_pets ?? data.has_pets ?? "",
          priorities:
            extra.priorities && extra.priorities.length === DEFAULT_PRIORITIES.length
              ? extra.priorities
              : data.priorities && data.priorities.length === DEFAULT_PRIORITIES.length
                ? data.priorities
                : DEFAULT_PRIORITIES,
        };

        setProfile(merged);
        setSnapshot(merged);
      })
      .catch(() => toast.error("Не удалось загрузить профиль"))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const childErrors = useMemo(() => {
    if (!profile.has_children) return [] as boolean[];
    return profile.children.map((c) => !c.birthday);
  }, [profile.has_children, profile.children]);

  const hasChildErrors = childErrors.some(Boolean);

  const handleSave = async () => {
    if (hasChildErrors) {
      setShowErrors(true);
      toast.error("Укажите дату рождения для каждого добавленного ребёнка");
      return;
    }
    setShowErrors(false);
    setSaving(true);
    const payload = {
      marital_status: profile.marital_status,
      has_children: profile.has_children,
      children: profile.has_children ? profile.children : [],
      work_format: profile.work_format,
      has_pets: profile.has_pets,
      priorities: profile.priorities,
    };
    try {
      const res = await fetch("/api/employee/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error("Ошибка сохранения");
        return;
      }
      try {
        localStorage.setItem(DEMO_LS_KEY, JSON.stringify(payload));
      } catch {
        // ignore quota errors
      }
      toast.success("Профиль обновлён");
      setSnapshot(profile);
      setEditing(false);
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setProfile(snapshot);
    setShowErrors(false);
    setEditing(false);
  };

  function addChild() {
    setProfile((p) => ({
      ...p,
      has_children: true,
      children: [...p.children, { birthday: "" }],
    }));
  }
  function removeChild(idx: number) {
    setProfile((p) => ({
      ...p,
      children: p.children.filter((_, i) => i !== idx),
    }));
  }
  function setChildBirthday(idx: number, value: string) {
    setProfile((p) => ({
      ...p,
      children: p.children.map((c, i) => (i === idx ? { ...c, birthday: value } : c)),
    }));
  }

  function movePriority(idx: number, dir: -1 | 1) {
    setProfile((p) => {
      const next = [...p.priorities];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return p;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...p, priorities: next };
    });
  }

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="page-transition space-y-6 p-6 max-w-2xl">
      <h1 className="text-2xl font-heading font-bold">Мой профиль</h1>
      <p className="text-sm text-muted-foreground">
        Основные данные нельзя менять самостоятельно — обратитесь к HR. Остальные
        поля можно редактировать в любое время, заполнение необязательно.
      </p>

      {/* Read-only base info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Основные данные</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">ФИО</Label>
              <p className="font-medium">{profile.full_name || "—"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Пол</Label>
              <p className="font-medium">
                {profile.gender ? genderLabel[profile.gender] ?? profile.gender : "—"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Компания</Label>
              <p className="font-medium">{profile.company || "—"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Дата рождения</Label>
              <p className="font-medium">{formatDate(profile.birthday)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editable */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Дополнительная информация</CardTitle>
          {!editing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
              Редактировать
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {editing ? (
            <EditView
              profile={profile}
              setProfile={setProfile}
              today={today}
              childErrors={childErrors}
              showErrors={showErrors}
              addChild={addChild}
              removeChild={removeChild}
              setChildBirthday={setChildBirthday}
              movePriority={movePriority}
            />
          ) : (
            <ReadView profile={profile} />
          )}

          {editing && (
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
              <Button type="button" variant="ghost" onClick={handleCancel} disabled={saving}>
                Отмена
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-mode view
// ---------------------------------------------------------------------------

function ReadView({ profile }: { profile: ProfileState }) {
  const childrenLines = profile.has_children
    ? profile.children
        .filter((c) => c.birthday)
        .map((c) => {
          const age = ageFromBirthday(c.birthday);
          const adult = age !== null && age >= 18;
          return {
            line: `${formatDate(c.birthday)} — ${age ?? "—"} ${age !== null ? pluralYears(age) : ""}`,
            adult,
          };
        })
    : [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ReadField label="Семейное положение">
        {profile.marital_status ? labelOf(maritalOptions, profile.marital_status) : "—"}
      </ReadField>

      <ReadField label="Несовершеннолетние дети">
        {!profile.has_children ? (
          "Нет"
        ) : childrenLines.length === 0 ? (
          "Есть (даты не указаны)"
        ) : (
          <ul className="space-y-0.5">
            {childrenLines.map((c, i) => (
              <li key={i}>
                {c.line}
                {c.adult && (
                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                    совершеннолетний
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </ReadField>

      <ReadField label="Формат работы">
        {profile.work_format ? labelOf(workFormatOptions, profile.work_format) : "—"}
      </ReadField>

      <ReadField label="Домашние животные">
        {profile.has_pets ? labelOf(petOptions, profile.has_pets) : "—"}
      </ReadField>

      <div className="space-y-1 sm:col-span-2">
        <Label className="text-muted-foreground text-xs">Приоритеты</Label>
        <ol className="space-y-1 text-sm">
          {profile.priorities.map((value, i) => (
            <li key={value}>
              <span className="text-muted-foreground tabular-nums">{i + 1}.</span>{" "}
              {labelOf(priorityOptions, value)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ReadField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <div className="font-medium text-sm">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit-mode view
// ---------------------------------------------------------------------------

interface EditViewProps {
  profile: ProfileState;
  setProfile: React.Dispatch<React.SetStateAction<ProfileState>>;
  today: string;
  childErrors: boolean[];
  showErrors: boolean;
  addChild: () => void;
  removeChild: (idx: number) => void;
  setChildBirthday: (idx: number, value: string) => void;
  movePriority: (idx: number, dir: -1 | 1) => void;
}

function EditView({
  profile,
  setProfile,
  today,
  childErrors,
  showErrors,
  addChild,
  removeChild,
  setChildBirthday,
  movePriority,
}: EditViewProps) {
  return (
    <div className="space-y-6">
      {/* Marital status */}
      <div className="space-y-2">
        <Label>Семейное положение</Label>
        <Select
          value={profile.marital_status || "__none"}
          onValueChange={(v) =>
            setProfile((p) => ({ ...p, marital_status: v === "__none" ? "" : v }))
          }
        >
          <SelectTrigger className="max-w-[260px]">
            <SelectValue placeholder="Не указано" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Не указано</SelectItem>
            {maritalOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Children */}
      <div className="space-y-3">
        <Label>Несовершеннолетние дети</Label>
        <Select
          value={profile.has_children ? "yes" : "no"}
          onValueChange={(v) =>
            setProfile((p) => ({
              ...p,
              has_children: v === "yes",
              children: v === "yes" && p.children.length === 0 ? [{ birthday: "" }] : p.children,
            }))
          }
        >
          <SelectTrigger className="max-w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no">Нет</SelectItem>
            <SelectItem value="yes">Есть</SelectItem>
          </SelectContent>
        </Select>

        {profile.has_children && (
          <div className="space-y-2">
            {profile.children.map((child, i) => {
              const age = ageFromBirthday(child.birthday);
              const adult = age !== null && age >= 18;
              const missing = showErrors && childErrors[i];
              return (
                <div
                  key={i}
                  className={`flex flex-wrap items-end gap-3 rounded-md border p-3 ${
                    missing
                      ? "border-destructive bg-destructive/5"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Ребёнок {i + 1} — дата рождения
                    </Label>
                    <Input
                      type="date"
                      max={today}
                      value={child.birthday}
                      onChange={(e) => setChildBirthday(i, e.target.value)}
                      className={`w-[180px] ${missing ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      aria-invalid={missing || undefined}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Возраст</Label>
                    <p className="text-sm font-medium">
                      {age === null ? "—" : `${age} ${pluralYears(age)}`}
                    </p>
                  </div>
                  {adult && (
                    <p className="basis-full text-xs text-amber-600 dark:text-amber-400">
                      Ребёнок уже совершеннолетний.
                    </p>
                  )}
                  {missing && (
                    <p className="basis-full text-xs text-destructive">
                      Укажите дату рождения ребёнка.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive"
                    onClick={() => removeChild(i)}
                  >
                    <Trash2 className="size-3.5" />
                    Удалить
                  </Button>
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={addChild}>
              <Plus className="size-3.5" />
              Добавить ребёнка
            </Button>
          </div>
        )}
      </div>

      {/* Work format */}
      <div className="space-y-2">
        <Label>Формат работы</Label>
        <Select
          value={profile.work_format || "__none"}
          onValueChange={(v) =>
            setProfile((p) => ({ ...p, work_format: v === "__none" ? "" : v }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Не указано" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Не указано</SelectItem>
            {workFormatOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pets */}
      <div className="space-y-2">
        <Label>Есть ли домашние животные</Label>
        <Select
          value={profile.has_pets || "__none"}
          onValueChange={(v) =>
            setProfile((p) => ({ ...p, has_pets: v === "__none" ? "" : v }))
          }
        >
          <SelectTrigger className="max-w-[220px]">
            <SelectValue placeholder="Не указано" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Не указано</SelectItem>
            {petOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Priorities */}
      <div className="space-y-2">
        <Label>Что для вас сейчас в приоритете?</Label>
        <p className="text-xs text-muted-foreground">
          Расставьте варианты по убыванию важности — сверху самое важное.
        </p>
        <ol className="space-y-2">
          {profile.priorities.map((value, i) => (
            <li
              key={value}
              className="flex items-center gap-2 rounded-md border bg-card p-2 pl-3"
            >
              <span className="w-5 text-sm font-semibold tabular-nums text-muted-foreground">
                {i + 1}.
              </span>
              <span className="flex-1 text-sm">{labelOf(priorityOptions, value)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={i === 0}
                onClick={() => movePriority(i, -1)}
                aria-label="Поднять выше"
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={i === profile.priorities.length - 1}
                onClick={() => movePriority(i, 1)}
                aria-label="Опустить ниже"
              >
                <ArrowDown className="size-3.5" />
              </Button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function pluralYears(age: number): string {
  const mod10 = age % 10;
  const mod100 = age % 100;
  if (mod10 === 1 && mod100 !== 11) return "год";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "года";
  return "лет";
}
