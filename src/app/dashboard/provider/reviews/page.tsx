"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Star } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";

interface ReviewItem {
  id: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  created_at: string;
  provider_offerings?: { name: string } | null;
  users?: { email: string } | null;
}

interface OfferingOption {
  id: string;
  name: string;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  visible: { label: "Опубликован", variant: "default" },
  hidden: { label: "Скрыт", variant: "secondary" },
  flagged: { label: "Жалоба", variant: "destructive" },
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function ProviderReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [offerings, setOfferings] = useState<OfferingOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offeringFilter, setOfferingFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    fetch("/api/provider/offerings?per_page=100")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data?.data ?? json.data ?? [];
        setOfferings(data.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })));
      })
      .catch(() => {});
  }, []);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (offeringFilter !== "all") params.set("offering_id", offeringFilter);
      if (ratingFilter !== "all") params.set("rating", ratingFilter);

      const res = await fetch(`/api/provider/reviews?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setReviews(json.data?.data ?? []);
      setTotal(json.data?.meta?.total ?? 0);
    } catch {
      toast.error("Не удалось загрузить отзывы");
    } finally {
      setLoading(false);
    }
  }, [page, offeringFilter, ratingFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Отзывы</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={offeringFilter}
          onValueChange={(v) => { setOfferingFilter(v); setPage(1); }}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Все предложения" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все предложения</SelectItem>
            {offerings.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={ratingFilter}
          onValueChange={(v) => { setRatingFilter(v); setPage(1); }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Все оценки" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все оценки</SelectItem>
            {[5, 4, 3, 2, 1].map((r) => (
              <SelectItem key={r} value={String(r)}>{r} звёзд</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Предложение</TableHead>
              <TableHead>Оценка</TableHead>
              <TableHead>Заголовок</TableHead>
              <TableHead className="max-w-[300px]">Текст</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Дата</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : reviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Отзывов пока нет
                </TableCell>
              </TableRow>
            ) : (
              reviews.map((r) => {
                const st = statusLabels[r.status] ?? statusLabels.visible;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.provider_offerings?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StarRating rating={r.rating} />
                    </TableCell>
                    <TableCell>{r.title || "—"}</TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {r.body || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("ru")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {!loading && total > perPage && (
          <DataTablePagination
            page={page}
            per_page={perPage}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
