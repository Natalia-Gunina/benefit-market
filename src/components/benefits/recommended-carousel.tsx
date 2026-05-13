"use client";

import { Sparkles, TrendingUp } from "lucide-react";
import { BenefitCard, type BenefitWithCategory } from "@/components/benefits/benefit-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export interface RecommendedItem {
  benefit: BenefitWithCategory;
  reason: string;
}

interface RecommendedCarouselProps {
  items: RecommendedItem[];
  source: "llm" | "popular";
  isLoading: boolean;
  onAddToCart: (benefit: BenefitWithCategory) => void;
}

function SkeletonCarouselCard() {
  return (
    <div className="snap-start shrink-0 w-[280px] md:w-[300px]">
      <Skeleton className="mb-2 h-4 w-3/4" />
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-9 w-full rounded-md" />
      </Card>
    </div>
  );
}

export function RecommendedCarousel({
  items,
  source,
  isLoading,
  onAddToCart,
}: RecommendedCarouselProps) {
  const Icon = source === "llm" ? Sparkles : TrendingUp;
  const subtitle =
    source === "llm"
      ? "Подобрано на основе вашего профиля"
      : "Популярные льготы";

  return (
    <section
      aria-label="Рекомендованные льготы"
      className="rounded-lg border bg-card p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-md bg-primary/10 p-1.5 text-primary">
          <Icon className="size-4" />
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold leading-tight">
            Рекомендовано для вас
          </h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCarouselCard key={i} />
            ))
          : items.map(({ benefit, reason }) => (
              <div
                key={benefit.id}
                className="snap-start shrink-0 w-[280px] md:w-[300px]"
              >
                <p className="mb-2 line-clamp-2 px-1 text-xs italic text-muted-foreground">
                  {reason}
                </p>
                <BenefitCard benefit={benefit} onAddToCart={onAddToCart} />
              </div>
            ))}
      </div>
    </section>
  );
}
