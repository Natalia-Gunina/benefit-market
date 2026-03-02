"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, Loader2, Search, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/data-table-pagination";

interface Offering {
  id: string;
  name: string;
  description: string;
  base_price_points: number;
  status: string;
  avg_rating: number;
  review_count: number;
  created_at: string;
  global_categories?: { name: string; icon: string } | null;
}

const statusTabs = [
  { key: "all", label: "Все" },
  { key: "draft", label: "Черновик" },
  { key: "pending_review", label: "На модерации" },
  { key: "published", label: "Опубликовано" },
  { key: "archived", label: "Архив" },
] as const;

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Черновик", variant: "secondary" },
  pending_review: { label: "На модерации", variant: "outline" },
  published: { label: "Опубликовано", variant: "default" },
  archived: { label: "Архив", variant: "destructive" },
};

export default function ProviderOfferingsPage() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchOfferings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/provider/offerings?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setOfferings(json.data?.data ?? json.data ?? []);
      setTotal(json.data?.meta?.total ?? 0);
    } catch {
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchOfferings();
  }, [fetchOfferings]);

  return (
    <div className="page-transition space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Мои предложения</h1>
        <Button asChild>
          <Link href="/dashboard/provider/offerings/new">
            <Plus className="size-4" />
            Новое предложение
          </Link>
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1">
        {statusTabs.map((tab) => (
          <Button
            key={tab.key}
            variant={statusFilter === tab.key ? "default" : "ghost"}
            size="sm"
            onClick={() => { setStatusFilter(tab.key); setPage(1); }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию..."
          className="pl-9"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead className="text-right">Цена</TableHead>
              <TableHead className="text-center">Рейтинг</TableHead>
              <TableHead className="text-center">Статус</TableHead>
              <TableHead>Создано</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : offerings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Предложений не найдено
                </TableCell>
              </TableRow>
            ) : (
              offerings.map((o) => {
                const st = statusBadge[o.status] ?? statusBadge.draft;
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/provider/offerings/${o.id}`}
                        className="font-medium hover:underline"
                      >
                        {o.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.global_categories?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.base_price_points.toLocaleString()} pts
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-sm">
                          {o.avg_rating > 0 ? o.avg_rating.toFixed(1) : "—"}
                        </span>
                        <span className="text-sm text-muted-foreground">({o.review_count})</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("ru")}
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
