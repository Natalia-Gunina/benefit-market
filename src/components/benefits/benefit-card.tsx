"use client";

import Link from "next/link";
import type { Benefit, BenefitCategory } from "@/lib/types";
import {
  Star,
  Check,
  Plus,
  Minus,
  MapPin,
  Globe,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store/cart";

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

export interface BenefitWithCategory extends Benefit {
  category?: BenefitCategory;
  tenant_offering_id?: string;
  provider_name?: string;
  provider_logo_url?: string;
  avg_rating?: number;
  is_stackable?: boolean;
  format?: "online" | "offline";
  cities?: string[];
  recommendation_reason?: string;
}

interface BenefitCardProps {
  benefit: BenefitWithCategory;
  onAddToCart: (benefit: BenefitWithCategory) => void;
}

export function BenefitCard({ benefit, onAddToCart }: BenefitCardProps) {
  const outOfStock =
    benefit.stock_limit !== null && benefit.stock_limit <= 0;

  const cartItem = useCartStore((s) =>
    s.items.find((item) => item.benefit.id === benefit.id),
  );
  const inCart = !!cartItem;
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const href = benefit.tenant_offering_id
    ? `/dashboard/employee/catalog/offering/${benefit.tenant_offering_id}`
    : `/dashboard/employee/catalog/${benefit.id}`;

  const vtId = benefit.id.slice(0, 8);

  const providerName = benefit.provider_name ?? "?";
  const initials = getInitials(providerName);
  const color = avatarColors[hashCode(providerName) % avatarColors.length];

  const cityLabel =
    benefit.format === "offline" && Array.isArray(benefit.cities) && benefit.cities.length > 0
      ? benefit.cities.length === 1
        ? benefit.cities[0]
        : `${benefit.cities[0]} +${benefit.cities.length - 1}`
      : null;

  return (
    <div className={`group relative flex h-full flex-col rounded-xl border bg-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${benefit.recommendation_reason ? "border-primary/30 shadow-[0_0_0_1px_hsl(262_83%_58%/0.08)]" : ""}`}>
      {benefit.recommendation_reason && (
        <div className="rounded-t-xl bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(290,70%,50%)] px-5 py-2 flex items-center gap-1.5 text-xs text-white">
          <Sparkles className="size-3 shrink-0" />
          <span className="line-clamp-1">{benefit.recommendation_reason}</span>
        </div>
      )}

      <Link href={href} className="flex flex-1 flex-col cursor-pointer px-5 pt-4">
        <div className="flex items-start gap-3.5">
          {benefit.provider_logo_url ? (
            <img
              src={benefit.provider_logo_url}
              alt={providerName}
              className="size-10 shrink-0 rounded-full object-cover"
              style={{ viewTransitionName: `benefit-avatar-${vtId}` }}
            />
          ) : (
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color.bg} ${color.text}`}
              style={{ viewTransitionName: `benefit-avatar-${vtId}` }}
            >
              {initials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-semibold leading-snug line-clamp-2"
              style={{ viewTransitionName: `benefit-title-${vtId}` }}
            >
              {benefit.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {providerName}
            </p>
          </div>
        </div>

        <div className="mt-auto pt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {benefit.category && (
            <span>{benefit.category.name}</span>
          )}
          {cityLabel ? (
            <span className="flex items-center gap-1">
              <MapPin className="size-3 shrink-0" />
              {cityLabel}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Globe className="size-3 shrink-0" />
              Онлайн
            </span>
          )}
          {benefit.avg_rating !== undefined && benefit.avg_rating > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              {benefit.avg_rating.toFixed(1)}
            </span>
          )}
        </div>
      </Link>

      <div className="flex items-center justify-between px-5 py-4 mt-3 border-t border-border/50">
        <span className="text-base font-bold tabular-nums">
          {benefit.price_points.toLocaleString("ru-RU")} б.
        </span>

        {outOfStock ? (
          <span className="text-xs text-muted-foreground">Нет в наличии</span>
        ) : inCart && benefit.is_stackable ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => updateQuantity(benefit.id, (cartItem?.quantity ?? 1) - 1)}
            >
              <Minus className="size-4" />
            </Button>
            <span className="text-sm font-semibold tabular-nums min-w-[2ch] text-center">
              {cartItem?.quantity ?? 1}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              className="hover:bg-primary hover:text-primary-foreground hover:border-primary"
              onClick={() => onAddToCart(benefit)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        ) : inCart ? (
          <Button
            variant="outline"
            size="icon-sm"
            className="border-0 bg-gradient-primary text-white shadow-sm hover:opacity-90"
            onClick={() => removeItem(benefit.id)}
          >
            <Check className="size-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon-sm"
            className="hover:bg-primary hover:text-primary-foreground hover:border-primary"
            onClick={() => onAddToCart(benefit)}
          >
            <Plus className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
