"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Category {
  id: string;
  name: string;
}

type OfferingFormat = "online" | "offline";

export default function NewOfferingPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    long_description: "",
    base_price_points: "",
    stock_limit: "",
    global_category_id: "",
    delivery_info: "",
    terms_conditions: "",
  });
  const [isStackable, setIsStackable] = useState(false);
  const [format, setFormat] = useState<OfferingFormat>("online");
  const [cities, setCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");

  useEffect(() => {
    fetch("/api/global-categories")
      .then((r) => r.json())
      .then((json) => setCategories(json.data ?? []))
      .catch(() => {});
  }, []);

  function addCity() {
    const v = cityInput.trim();
    if (!v) return;
    if (cities.includes(v)) {
      setCityInput("");
      return;
    }
    setCities([...cities, v]);
    setCityInput("");
  }

  function removeCity(c: string) {
    setCities(cities.filter((x) => x !== c));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (format === "offline" && cities.length === 0) {
      toast.error("Укажите хотя бы один город для офлайн-льготы");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/provider/offerings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          base_price_points: parseInt(form.base_price_points, 10),
          stock_limit: form.stock_limit ? parseInt(form.stock_limit, 10) : null,
          global_category_id: form.global_category_id || null,
          is_stackable: isStackable,
          format,
          cities: format === "offline" ? cities : [],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error?.message ?? "Ошибка создания");
        return;
      }
      toast.success("Льгота отправлена на согласование");
      router.push("/dashboard/provider/offerings");
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-transition space-y-6 p-6 max-w-2xl">
      <h1 className="text-2xl font-heading font-bold">Новая льгота</h1>

      <Card>
        <CardHeader>
          <CardTitle>Основная информация</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Категория</Label>
              <Select value={form.global_category_id} onValueChange={(v) => setForm({ ...form, global_category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Выберите категорию" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Краткое описание</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="long_description">Подробное описание</Label>
              <Textarea id="long_description" value={form.long_description} onChange={(e) => setForm({ ...form, long_description: e.target.value })} rows={5} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Цена (баллы)</Label>
                <Input id="price" type="number" min="1" value={form.base_price_points} onChange={(e) => setForm({ ...form, base_price_points: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Лимит (пусто = безлимит)</Label>
                <Input id="stock" type="number" min="0" value={form.stock_limit} onChange={(e) => setForm({ ...form, stock_limit: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-stackable">Множественный выбор</Label>
              <Switch id="is-stackable" checked={isStackable} onCheckedChange={setIsStackable} />
            </div>

            <div className="space-y-2">
              <Label>Формат льготы</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as OfferingFormat)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Онлайн</SelectItem>
                  <SelectItem value="offline">Офлайн</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {format === "offline" && (
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
                {cities.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {cities.map((c) => (
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
                <p className="text-xs text-muted-foreground">
                  Добавьте все города, в которых льгота доступна офлайн.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="delivery">Информация о доставке</Label>
              <Textarea id="delivery" value={form.delivery_info} onChange={(e) => setForm({ ...form, delivery_info: e.target.value })} rows={2} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms">Условия</Label>
              <Textarea id="terms" value={form.terms_conditions} onChange={(e) => setForm({ ...form, terms_conditions: e.target.value })} rows={2} />
            </div>

            <p className="text-sm text-muted-foreground">
              После создания льгота получит статус «На согласовании» и станет видимой в кабинете администратора.
            </p>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Создание..." : "Создать льготу"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
