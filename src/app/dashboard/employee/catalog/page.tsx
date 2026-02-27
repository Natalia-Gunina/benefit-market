"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import type { BenefitCategory } from "@/lib/types";
import type { BenefitWithCategory } from "@/components/benefits/benefit-card";
import { useCartStore } from "@/lib/store/cart";
import { Input } from "@/components/ui/input";
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
    avg_rating: number | null;
    review_count: number | null;
    providers: { id: string; name: string; logo_url: string | null } | null;
    global_categories: { name: string; icon: string } | null;
  } | null;
}

function offeringToBenefit(o: OfferingItem): BenefitWithCategory {
  const po = o.provider_offerings;
  return {
    id: o.id,
    tenant_id: "",
    category_id: "",
    name: po?.name ?? "Предложение",
    description: po?.description ?? "",
    price_points: o.effective_price,
    stock_limit: o.tenant_stock_limit ?? po?.stock_limit ?? null,
    is_active: true,
    created_at: "",
    tenant_offering_id: o.id,
    provider_name: po?.providers?.name,
    avg_rating: po?.avg_rating ?? undefined,
    category: po?.global_categories
      ? {
          id: "",
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
  const [benefits, setBenefits] = useState<BenefitWithCategory[]>([]);
  const [offerings, setOfferings] = useState<BenefitWithCategory[]>([]);
  const [categories, setCategories] = useState<BenefitCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [benefitsRes, categoriesRes, offeringsRes] = await Promise.all([
          fetch("/api/benefits"),
          fetch("/api/admin/categories"),
          fetch("/api/offerings"),
        ]);
        if (benefitsRes.ok) {
          const json = await benefitsRes.json();
          setBenefits(json.data ?? []);
        }
        if (categoriesRes.ok) {
          const json = await categoriesRes.json();
          setCategories(json.data ?? []);
        }
        if (offeringsRes.ok) {
          const json = await offeringsRes.json();
          const items: OfferingItem[] = json.data?.data ?? json.data ?? [];
          setOfferings(items.map(offeringToBenefit));
        }
      } catch {
        // network error — leave empty
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const allItems = useMemo(
    () => [...benefits, ...offerings],
    [benefits, offerings],
  );

  const filtered = useMemo(() => {
    let result = allItems;

    if (selectedCategoryId) {
      result = result.filter((b) => b.category_id === selectedCategoryId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q),
      );
    }

    return result;
  }, [allItems, selectedCategoryId, searchQuery]);

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
      });
      toast.success(`${benefit.name} добавлен в корзину`);
    },
    [addItem],
  );

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Каталог льгот</h1>

      {/* Filters row */}
      <div className="space-y-4">
        <CategoryFilter
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onChange={setSelectedCategoryId}
        />

        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск льгот..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      <BenefitGrid
        benefits={filtered}
        isLoading={isLoading}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
