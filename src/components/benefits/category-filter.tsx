"use client";

import type { BenefitCategory } from "@/lib/types";
import {
  Heart,
  HeartPulse,
  GraduationCap,
  Plane,
  Dumbbell,
  UtensilsCrossed,
  Gift,
  ShieldCheck,
  Car,
  Baby,
  Laptop,
  Package,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const iconMap: Record<string, LucideIcon> = {
  heart: Heart,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  plane: Plane,
  dumbbell: Dumbbell,
  utensils: UtensilsCrossed,
  gift: Gift,
  shield: ShieldCheck,
  car: Car,
  baby: Baby,
  laptop: Laptop,
};

interface CategoryFilterProps {
  categories: BenefitCategory[];
  selectedCategoryId: string | null;
  onChange: (categoryId: string | null) => void;
}

export function CategoryFilter({
  categories,
  selectedCategoryId,
  onChange,
}: CategoryFilterProps) {
  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Tabs
      value={selectedCategoryId ?? "all"}
      onValueChange={(value) => onChange(value === "all" ? null : value)}
    >
      <TabsList className="w-full flex-wrap h-auto gap-1 overflow-x-auto">
        <TabsTrigger value="all" className="gap-1.5">
          <LayoutGrid className="size-4" />
          Все
        </TabsTrigger>
        {sorted.map((cat) => {
          const Icon = iconMap[cat.icon] ?? Package;
          return (
            <TabsTrigger key={cat.id} value={cat.id} className="gap-1.5">
              <Icon className="size-4" />
              {cat.name}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
