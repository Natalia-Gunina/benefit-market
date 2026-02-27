"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
}

interface Offering {
  id: string;
  name: string;
  description: string;
  long_description: string;
  base_price_points: number;
  stock_limit: number | null;
  status: string;
  delivery_info: string;
  terms_conditions: string;
  global_category_id: string | null;
  avg_rating: number;
  review_count: number;
}

export default function EditOfferingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [offering, setOffering] = useState<Offering | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/provider/offerings/${id}`)
      .then((r) => r.json())
      .then((json) => setOffering(json.data))
      .catch(() => toast.error("Ошибка загрузки"));
  }, [id]);

  useEffect(() => {
    fetch("/api/global-categories")
      .then((r) => r.json())
      .then((json) => setCategories(json.data ?? []))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!offering) return;
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

  const handleSubmitForReview = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/provider/offerings/${id}/submit`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error?.message ?? "Ошибка");
        return;
      }
      toast.success("Отправлено на модерацию!");
      router.push("/dashboard/provider/offerings");
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };

  if (!offering) {
    return <div className="p-6 text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="page-transition space-y-6 p-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/provider/offerings">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button>
        </Link>
        <h1 className="text-2xl font-heading font-bold">Редактирование</h1>
        <Badge variant={offering.status === "published" ? "default" : "secondary"}>
          {offering.status}
        </Badge>
      </div>

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
            <Select value={offering.global_category_id ?? ""} onValueChange={(v) => setOffering({ ...offering, global_category_id: v })}>
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
            {offering.status === "draft" && (
              <Button variant="outline" onClick={handleSubmitForReview} disabled={submitting}>
                <Send className="mr-2 size-4" />
                {submitting ? "Отправка..." : "На модерацию"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
