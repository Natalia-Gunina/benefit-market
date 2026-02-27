"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Category {
  id: string;
  name: string;
}

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

  useEffect(() => {
    fetch("/api/global-categories")
      .then((r) => r.json())
      .then((json) => setCategories(json.data ?? []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error?.message ?? "Ошибка создания");
        return;
      }
      toast.success("Предложение создано!");
      router.push("/dashboard/provider/offerings");
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-transition space-y-6 p-6 max-w-2xl">
      <h1 className="text-2xl font-heading font-bold">Новое предложение</h1>

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

            <div className="space-y-2">
              <Label htmlFor="delivery">Информация о доставке</Label>
              <Textarea id="delivery" value={form.delivery_info} onChange={(e) => setForm({ ...form, delivery_info: e.target.value })} rows={2} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms">Условия</Label>
              <Textarea id="terms" value={form.terms_conditions} onChange={(e) => setForm({ ...form, terms_conditions: e.target.value })} rows={2} />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Создание..." : "Создать предложение"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
