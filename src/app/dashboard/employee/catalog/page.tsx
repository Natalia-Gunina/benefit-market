"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { BenefitCategory } from "@/lib/types";
import type { BenefitWithCategory } from "@/components/benefits/benefit-card";
import { Input } from "@/components/ui/input";
import { CategoryFilter } from "@/components/benefits/category-filter";
import { BenefitGrid } from "@/components/benefits/benefit-grid";

export default function CatalogPage() {
  const [benefits, setBenefits] = useState<BenefitWithCategory[]>([]);
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
        const [benefitsRes, categoriesRes] = await Promise.all([
          fetch("/api/benefits"),
          fetch("/api/admin/categories"),
        ]);
        if (benefitsRes.ok) {
          const json = await benefitsRes.json();
          setBenefits(json.data ?? []);
        }
        if (categoriesRes.ok) {
          const json = await categoriesRes.json();
          setCategories(json.data ?? []);
        }
      } catch {
        // network error — leave empty
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let result = benefits;

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
  }, [benefits, selectedCategoryId, searchQuery]);

  const handleAddToCart = useCallback((benefit: BenefitWithCategory) => {
    // TODO: integrate with cart/order context
    console.log("Add to cart:", benefit.id);
  }, []);

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
