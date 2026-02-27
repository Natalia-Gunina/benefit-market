"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Offering {
  id: string;
  name: string;
  description: string;
  base_price_points: number;
  status: string;
  avg_rating: number;
  review_count: number;
  global_categories?: { name: string; icon: string } | null;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Черновик", variant: "secondary" },
  pending_review: { label: "На модерации", variant: "outline" },
  published: { label: "Опубликовано", variant: "default" },
  archived: { label: "Архив", variant: "destructive" },
};

export default function ProviderOfferingsPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/provider/offerings")
      .then((r) => r.json())
      .then((json) => setOfferings(json.data?.data ?? json.data ?? []))
      .catch(() => toast.error("Ошибка загрузки данных"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="page-transition space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Мои предложения</h1>
        <Button asChild>
          <Link href="/dashboard/provider/offerings/new">
            <Plus className="mr-2 size-4" />
            Новое предложение
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : offerings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            У вас пока нет предложений. Создайте первое!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {offerings.map((o) => {
            const st = statusLabels[o.status] ?? statusLabels.draft;
            return (
              <Link key={o.id} href={`/dashboard/provider/offerings/${o.id}`}>
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{o.name}</span>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">{o.description}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm shrink-0">
                      <div className="flex items-center gap-1">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        <span>{o.avg_rating > 0 ? o.avg_rating.toFixed(1) : "—"}</span>
                        <span className="text-muted-foreground">({o.review_count})</span>
                      </div>
                      <div className="font-medium">{o.base_price_points.toLocaleString()} pts</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
