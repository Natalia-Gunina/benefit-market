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
}

interface BenefitCardProps {
  benefit: BenefitWithCategory;
  onAddToCart: (benefit: BenefitWithCategory) => void;
}

export function BenefitCard({ benefit, onAddToCart }: BenefitCardProps) {
  const IconComponent = iconMap[benefit.category?.icon ?? ""] ?? Package;
  const outOfStock =
    benefit.stock_limit !== null && benefit.stock_limit <= 0;

  return (
    <Card className="group relative flex flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <Link
        href={`/dashboard/employee/catalog/${benefit.id}`}
        className="cursor-pointer"
      >
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
          {benefit.category && (
            <Badge variant="secondary" className="w-fit text-xs">
              {benefit.category.name}
            </Badge>
          )}
        </CardHeader>

        <CardContent className="flex-1">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {benefit.description}
          </p>
        </CardContent>
      </Link>

      <CardFooter>
        {outOfStock ? (
          <Button className="w-full" disabled variant="outline">
            Нет в наличии
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
