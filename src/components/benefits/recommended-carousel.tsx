"use client";

import Link from "next/link";
import {
  Sparkles,
  TrendingUp,
  Star,
  Plus,
  Check,
  Minus,
} from "lucide-react";
import type { BenefitWithCategory } from "@/components/benefits/benefit-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store/cart";

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

const avatarColors = [
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function SkeletonCarouselCard() {
  return (
    <div className="snap-start shrink-0 w-[280px]">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <div className="flex items-center justify-between pt-2 border-t">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function CompactCard({
  benefit,
  reason,
  onAddToCart,
}: {
  benefit: BenefitWithCategory;
  reason: string;
  onAddToCart: (benefit: BenefitWithCategory) => void;
}) {
  const outOfStock = benefit.stock_limit !== null && benefit.stock_limit <= 0;
  const providerName = benefit.provider_name ?? "?";
  const initials = getInitials(providerName);
  const color = avatarColors[hashCode(providerName) % avatarColors.length];

  const cartItem = useCartStore((s) =>
    s.items.find((item) => item.benefit.id === benefit.id),
  );
  const inCart = !!cartItem;
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const href = benefit.tenant_offering_id
    ? `/dashboard/employee/catalog/offering/${benefit.tenant_offering_id}`
    : `/dashboard/employee/catalog/${benefit.id}`;

  return (
    <div className="snap-start shrink-0 w-[280px]">
      <div className="group rounded-lg border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 h-full flex flex-col">
        <Link href={href} className="flex-1 cursor-pointer space-y-2.5">
          <div className="flex items-start gap-3">
            {benefit.provider_logo_url ? (
              <img
                src={benefit.provider_logo_url}
                alt={providerName}
                className="size-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${color.bg} ${color.text}`}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight line-clamp-2">
                {benefit.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {providerName}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/70 italic line-clamp-1 leading-snug">
            {reason}
          </p>
        </Link>

        <div className="mt-3 flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tabular-nums">
              {benefit.price_points.toLocaleString("ru-RU")} б.
            </span>
            {benefit.avg_rating !== undefined && benefit.avg_rating > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {benefit.avg_rating.toFixed(1)}
              </span>
            )}
          </div>

          {outOfStock ? (
            <span className="text-[10px] text-muted-foreground">Нет в наличии</span>
          ) : inCart && benefit.is_stackable ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => updateQuantity(benefit.id, (cartItem?.quantity ?? 1) - 1)}
              >
                <Minus className="size-3" />
              </Button>
              <span className="text-xs font-semibold tabular-nums min-w-[2ch] text-center">
                {cartItem?.quantity ?? 1}
              </span>
              <Button
                variant="outline"
                size="icon-xs"
                className="hover:bg-primary hover:text-primary-foreground hover:border-primary"
                onClick={() => onAddToCart(benefit)}
              >
                <Plus className="size-3" />
              </Button>
            </div>
          ) : inCart ? (
            <Button
              variant="outline"
              size="icon-xs"
              className="border-success text-success hover:bg-success hover:text-white"
              onClick={() => removeItem(benefit.id)}
            >
              <Check className="size-3.5" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon-xs"
              className="hover:bg-primary hover:text-primary-foreground hover:border-primary"
              onClick={() => onAddToCart(benefit)}
            >
              <Plus className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
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
      className="rounded-lg border bg-card p-5"
    >
      <div className="mb-4 flex items-center gap-2">
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

      <div className="relative">
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] scrollbar-none">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCarouselCard key={i} />
              ))
            : items.map(({ benefit, reason }) => (
                <CompactCard
                  key={benefit.id}
                  benefit={benefit}
                  reason={reason}
                  onAddToCart={onAddToCart}
                />
              ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-card to-transparent" />
      </div>
    </section>
  );
}
