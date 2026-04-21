"use client";

import { useEffect, useState, use } from "react";
import { toast } from "sonner";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
}

type OfferingFormat = "online" | "offline";

interface Offering {
  id: string;
  name: string;
  description: string;
  long_description: string;
  base_price_points: number;
  stock_limit: number | null;
  is_stackable: boolean;
  format: OfferingFormat;
  cities: string[];
  status: string;
  delivery_info: string;
  terms_conditions: string;
  global_category_id: string | null;
  avg_rating: number;
  review_count: number;
}

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Черновик", variant: "secondary" },
  pending_review: { label: "На согласовании", variant: "outline" },
  published: { label: "Активна", variant: "default" },
  archived: { label: "В архиве", variant: "destructive" },
};

export default function EditOfferingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [offering, setOffering] = useState<Offering | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [cityInput, setCityInput] = useState("");

  useEffect(() => {
    fetch(`/api/provider/offerings/${id}`)
      .then((r) => r.json())
      .then((json) => {
        const data = json.data;
        setOffering({
          ...data,
          format: data?.format ?? "online",
          cities: data?.cities ?? [],
          is_stackable: !!data?.is_stackable,
        });
      })
      .catch(() => toast.error("Ошибка загрузки"));
  }, [id]);

  useEffect(() => {
    fetch("/api/global-categories")
      .then((r) => r.json())
      .then((json) => setCategories(json.data ?? []))
      .catch(() => {});
  }, []);

  function addCity() {
    if (!offering) return;
    const v = cityInput.trim();
    if (!v) return;
    if (offering.cities.includes(v)) {
      setCityInput("");
      return;
    }
    setOffering({ ...offering, cities: [...offering.cities, v] });
    setCityInput("");
  }

  function removeCity(c: string) {
    if (!offering) return;
    setOffering({ ...offering, cities: offering.cities.filter((x) => x !== c) });
  }

  const handleSave = async () => {
    if (!offering) return;

    if (offering.format === "offline" && offering.cities.length === 0) {
      toast.error("Укажите хотя бы один город для офлайн-льготы");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/provider/offerings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: offering.name,
          description: offering.description,
          long_description: offering.long_description,
          base_price_points: offering.base_price_points,
          stock_limit: offering.stock_limit,
          global_category_id: offering.global_category_id || null,
          is_stackable: offering.is_stackable,
          format: offering.format,
          cities: offering.format === "offline" ? offering.cities : [],
          delivery_info: offering.delivery_info,
          terms_conditions: offering.terms_conditions,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error?.message ?? "Ошибка");
        return;
      }
      toast.success("Сохранено!");
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  if (!offering) {
    return <div className="p-6 text-muted-foreground">Загрузка...</div>;
  }

  const st = statusLabel[offering.status] ?? statusLabel.draft;

  return (
    <div className="page-transition space-y-6 p-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/provider/offerings">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button>
        </Link>
        <h1 className="text-2xl font-heading font-bold">Льгота</h1>
        <Badge variant={st.variant}>{st.label}</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Смена статуса выполняется администратором. Данные льготы вы можете изменять в любой момент.
      </p>

      <Card>
        <CardHeader><CardTitle>Информация</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Название</Label>
            <Input value={offering.name} onChange={(e) => setOffering({ ...offering, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea value={offering.description} onChange={(e) => setOffering({ ...offering, description: e.target.value })} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Подробное описание</Label>
            <Textarea value={offering.long_description} onChange={(e) => setOffering({ ...offering, long_description: e.target.value })} rows={5} />
          </div>
          <div className="space-y-2">
            <Label>Категория</Label>
            <Select
              value={offering.global_category_id ?? ""}
              onValueChange={(v) => setOffering({ ...offering, global_category_id: v })}
            >
              <SelectTrigger><SelectValue placeholder="Выберите категорию" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Цена (баллы)</Label>
              <Input type="number" min="1" value={offering.base_price_points} onChange={(e) => setOffering({ ...offering, base_price_points: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Лимит</Label>
              <Input type="number" min="0" value={offering.stock_limit ?? ""} onChange={(e) => setOffering({ ...offering, stock_limit: e.target.value ? parseInt(e.target.value) : null })} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is-stackable">Множественный выбор</Label>
            <Switch
              id="is-stackable"
              checked={offering.is_stackable}
              onCheckedChange={(v) => setOffering({ ...offering, is_stackable: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>Формат льготы</Label>
            <Select
              value={offering.format}
              onValueChange={(v) => setOffering({ ...offering, format: v as OfferingFormat })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Онлайн</SelectItem>
                <SelectItem value="offline">Офлайн</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {offering.format === "offline" && (
            <div className="space-y-2">
              <Label>Города доступности</Label>
              <div className="flex gap-2">
                <Input
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCity();
                    }
                  }}
                  placeholder="Например, Москва"
                />
                <Button type="button" variant="outline" onClick={addCity}>
                  Добавить
                </Button>
              </div>
              {offering.cities.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {offering.cities.map((c) => (
                    <Badge key={c} variant="secondary" className="gap-1 pr-1">
                      {c}
                      <button
                        type="button"
                        onClick={() => removeCity(c)}
                        className="rounded-full p-0.5 hover:bg-muted"
                        aria-label={`Удалить ${c}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Информация о доставке</Label>
            <Textarea value={offering.delivery_info ?? ""} onChange={(e) => setOffering({ ...offering, delivery_info: e.target.value })} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Условия</Label>
            <Textarea value={offering.terms_conditions ?? ""} onChange={(e) => setOffering({ ...offering, terms_conditions: e.target.value })} rows={2} />
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
