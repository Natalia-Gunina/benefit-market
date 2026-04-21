"use client";

import Link from "next/link";
import type { Benefit, BenefitCategory } from "@/lib/types";
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
  Star,
  Building2,
  Check,
  Plus,
  Minus,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store/cart";

/** Maps category icon name (stored in DB) to a Lucide component */
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

export interface BenefitWithCategory extends Benefit {
  category?: BenefitCategory;
  /** Set when this card represents a marketplace offering */
  tenant_offering_id?: string;
  provider_name?: string;
  avg_rating?: number;
  /** Whether this benefit can be added multiple times */
  is_stackable?: boolean;
  /** Delivery format of the offering */
  format?: "online" | "offline";
  /** Cities where an offline offering is available */
  cities?: string[];
}

interface BenefitCardProps {
  benefit: BenefitWithCategory;
  onAddToCart: (benefit: BenefitWithCategory) => void;
}

export function BenefitCard({ benefit, onAddToCart }: BenefitCardProps) {
  const IconComponent = iconMap[benefit.category?.icon ?? ""] ?? Package;
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

  return (
    <Card className="group relative flex h-full flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <Link href={href} className="flex flex-1 flex-col cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <IconComponent className="size-5" />
              </div>
              <CardTitle className="text-base leading-tight">
                {benefit.name}
              </CardTitle>
            </div>
            <Badge variant="outline" className="shrink-0 tabular-nums">
              {benefit.price_points.toLocaleString("ru-RU")} б.
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {benefit.category && (
              <Badge variant="secondary" className="w-fit text-xs">
                {benefit.category.name}
              </Badge>
            )}
            {benefit.provider_name && (
              <Badge variant="outline" className="w-fit text-xs gap-0.5">
                <Building2 className="size-3" />
                {benefit.provider_name}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-1.5">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {benefit.description}
          </p>
          {benefit.avg_rating !== undefined && benefit.avg_rating > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              <span className="tabular-nums">{benefit.avg_rating.toFixed(1)}</span>
            </div>
          )}
        </CardContent>
      </Link>

      <CardFooter>
        {outOfStock ? (
          <Button className="w-full" disabled variant="outline">
            Нет в наличии
          </Button>
        ) : inCart && benefit.is_stackable ? (
          <div className="flex w-full items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => updateQuantity(benefit.id, (cartItem?.quantity ?? 1) - 1)}
            >
              <Minus className="size-4" />
            </Button>
            <span className="min-w-[3ch] text-center tabular-nums text-base font-semibold">
              {cartItem?.quantity ?? 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => onAddToCart(benefit)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        ) : inCart ? (
          <Button
            className="w-full border-success text-success hover:bg-success/5"
            variant="outline"
            onClick={() => removeItem(benefit.id)}
          >
            <Check className="size-4" />
            В корзине
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={() => onAddToCart(benefit)}
          >
            Добавить
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
