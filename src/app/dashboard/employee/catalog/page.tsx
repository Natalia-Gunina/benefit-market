"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Search, Wallet, RefreshCw, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import type { BenefitCategory } from "@/lib/types";
import type { BenefitWithCategory } from "@/components/benefits/benefit-card";
import { useCartStore } from "@/lib/store/cart";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryFilter } from "@/components/benefits/category-filter";
import { BenefitGrid } from "@/components/benefits/benefit-grid";

interface OfferingItem {
  id: string;
  provider_offering_id: string;
  custom_price_points: number | null;
  tenant_stock_limit: number | null;
  effective_price: number;
  provider_offerings: {
    name: string;
    description: string;
    base_price_points: number;
    stock_limit: number | null;
    is_stackable: boolean;
    format: "online" | "offline";
    cities: string[] | null;
    avg_rating: number | null;
    review_count: number | null;
    providers: { id: string; name: string; logo_url: string | null } | null;
    global_categories: { name: string; icon: string } | null;
  } | null;
}

const CITY_STORAGE_KEY = "benefit-market:selected-city";

function pluralBenefits(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} льгот`;
  if (mod10 === 1) return `${n} льгота`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} льготы`;
  return `${n} льгот`;
}

interface GlobalCategory {
  id: string;
  name: string;
  icon: string;
}


function offeringToBenefit(o: OfferingItem, categoryId: string): BenefitWithCategory {
  const po = o.provider_offerings;
  return {
    id: o.id,
    tenant_id: "",
    category_id: categoryId,
    name: po?.name ?? "Предложение",
    description: po?.description ?? "",
    price_points: o.effective_price,
    stock_limit: o.tenant_stock_limit ?? po?.stock_limit ?? null,
    is_active: true,
    created_at: "",
    tenant_offering_id: o.id,
    provider_name: po?.providers?.name,
    provider_logo_url: po?.providers?.logo_url ?? undefined,
    avg_rating: po?.avg_rating ?? undefined,
    is_stackable: po?.is_stackable ?? false,
    format: po?.format === "offline" ? "offline" : "online",
    cities: Array.isArray(po?.cities) ? po?.cities : [],
    category: po?.global_categories
      ? {
          id: categoryId,
          tenant_id: "",
          name: po.global_categories.name,
          icon: po.global_categories.icon,
          sort_order: 0,
          global_category_id: null,
        }
      : undefined,
  };
}

export default function CatalogPage() {
  const [offerings, setOfferings] = useState<BenefitWithCategory[]>([]);
  const [categories, setCategories] = useState<BenefitCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("default");
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CITY_STORAGE_KEY);
      if (saved) setSelectedCity(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CITY_STORAGE_KEY, selectedCity);
    } catch {
      // ignore
    }
  }, [selectedCity]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(false);
    try {
      const [globalCatsRes, offeringsRes, walletRes, recsRes] = await Promise.all([
        fetch("/api/admin/global-categories"),
        fetch("/api/offerings?per_page=1000"),
        fetch("/api/wallets/me"),
        fetch("/api/employee/recommendations"),
      ]);

      let globalCats: GlobalCategory[] = [];
      if (globalCatsRes.ok) {
        const json = await globalCatsRes.json();
        globalCats = json.data ?? json;
        setCategories(
          globalCats.map((gc, i) => ({
            id: gc.id,
            tenant_id: "",
            name: gc.name,
            icon: gc.icon ?? "",
            sort_order: i,
            global_category_id: gc.id,
          })),
        );
      }
      const nameToId = new Map(globalCats.map((gc) => [gc.name, gc.id]));

      let allOfferings: BenefitWithCategory[] = [];
      if (offeringsRes.ok) {
        const json = await offeringsRes.json();
        const items: OfferingItem[] = json.data?.data ?? json.data ?? [];
        allOfferings = items.map((o) => {
          const catName = o.provider_offerings?.global_categories?.name ?? "";
          const catId = nameToId.get(catName) ?? "";
          return offeringToBenefit(o, catId);
        });
      }

      // Merge recommendation reasons into offerings
      const recReasons = new Map<string, string>();
      if (recsRes.ok) {
        const json = await recsRes.json();
        const payload = json.data ?? json;
        const rawItems: (OfferingItem & { reason: string })[] = payload?.items ?? [];
        for (const o of rawItems) {
          recReasons.set(o.id, o.reason);
        }
      }

      // Attach recommendation_reason and sort recommended first
      const withRecs = allOfferings.map((o) => ({
        ...o,
        recommendation_reason: recReasons.get(o.id),
      }));
      withRecs.sort((a, b) => {
        const aRec = a.recommendation_reason ? 1 : 0;
        const bRec = b.recommendation_reason ? 1 : 0;
        return bRec - aRec;
      });
      setOfferings(withRecs);

      if (walletRes.ok) {
        const json = await walletRes.json();
        const w = json.data?.wallet ?? json.data;
        if (w) {
          setAvailableBalance((w.balance ?? 0) - (w.reserved ?? 0));
        }
      }
    } catch {
      setFetchError(true);
      toast.error("Не удалось загрузить каталог");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    offerings.forEach((b) => {
      if (b.format === "offline" && Array.isArray(b.cities)) {
        b.cities.forEach((c) => {
          const v = c.trim();
          if (v) set.add(v);
        });
      }
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "ru", { sensitivity: "base" }),
    );
  }, [offerings]);

  const filtered = useMemo(() => {
    let result = offerings;

    if (selectedCity !== "all") {
      result = result.filter((b) => {
        if (b.format !== "offline") return true;
        return Array.isArray(b.cities) && b.cities.includes(selectedCity);
      });
    }

    if (selectedCategoryIds.size > 0) {
      result = result.filter((b) => selectedCategoryIds.has(b.category_id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q),
      );
    }

    if (sortBy === "price-asc") {
      result = [...result].sort((a, b) => a.price_points - b.price_points);
    } else if (sortBy === "price-desc") {
      result = [...result].sort((a, b) => b.price_points - a.price_points);
    } else if (sortBy === "rating") {
      result = [...result].sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
    }

    return result;
  }, [offerings, selectedCategoryIds, searchQuery, selectedCity, sortBy]);

  const addItem = useCartStore((s) => s.addItem);

  const handleAddToCart = useCallback(
    (benefit: BenefitWithCategory) => {
      addItem({
        id: benefit.id,
        name: benefit.name,
        price_points: benefit.price_points,
        stock_limit: benefit.stock_limit,
        category_name: benefit.category?.name,
        category_icon: benefit.category?.icon,
        tenant_offering_id: benefit.tenant_offering_id,
        provider_name: benefit.provider_name,
        avg_rating: benefit.avg_rating,
        is_stackable: benefit.is_stackable,
      });
      toast.success(`${benefit.name} добавлен в корзину`);
    },
    [addItem],
  );

  return (
    <div className="page-transition space-y-8 p-6 overflow-x-hidden">
      {/* Header: title + city + balance */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-heading font-bold">Каталог льгот</h1>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="h-8 w-auto border-none shadow-none px-1 text-sm" aria-label="Выбор города">
                <SelectValue placeholder="Все города" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все города</SelectItem>
                {availableCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {availableBalance !== null && (
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
              <Wallet className="size-3.5 text-primary" />
              <span className="text-sm font-semibold tabular-nums text-primary">
                {availableBalance.toLocaleString("ru-RU")} б.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-2.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          placeholder="Поиск..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />

        <div className="h-5 w-px bg-border" />

        <div className="w-auto min-w-[180px]">
          <CategoryFilter
            categories={categories}
            selectedIds={selectedCategoryIds}
            onChange={setSelectedCategoryIds}
          />
        </div>

        <div className="h-5 w-px bg-border" />

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-8 w-auto border-none shadow-none gap-1.5 text-sm text-muted-foreground px-0">
            <ArrowUpDown className="size-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">По умолчанию</SelectItem>
            <SelectItem value="price-asc">Сначала дешёвые</SelectItem>
            <SelectItem value="price-desc">Сначала дорогие</SelectItem>
            <SelectItem value="rating">По рейтингу</SelectItem>
          </SelectContent>
        </Select>

        {!isLoading && filtered.length !== offerings.length && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {pluralBenefits(filtered.length)}
          </span>
        )}
      </div>

      {/* Error state */}
      {fetchError && !isLoading && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">Не удалось загрузить данные</p>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 size-4" />
            Попробовать снова
          </Button>
        </div>
      )}

      {/* Grid */}
      {!fetchError && (
        <BenefitGrid
          benefits={filtered}
          isLoading={isLoading}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
}
