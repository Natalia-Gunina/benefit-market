"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Heart,
  GraduationCap,
  Plane,
  Dumbbell,
  UtensilsCrossed,
  Gift,
  ShieldCheck,
  Car,
  Baby,
  Laptop,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import type { BenefitCategory } from "@/lib/types";
import type { BenefitWithCategory } from "@/components/benefits/benefit-card";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const iconMap: Record<string, LucideIcon> = {
  heart: Heart,
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

export default function BenefitDetailPage() {
  const params = useParams<{ id: string }>();
  const [benefit, setBenefit] = useState<BenefitWithCategory | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [benefitRes, walletRes] = await Promise.all([
          fetch(`/api/benefits/${params.id}`),
          fetch("/api/wallets/me"),
        ]);

        if (benefitRes.ok) {
          const data = await benefitRes.json();
          setBenefit(data.benefit ?? data);
        }

        if (walletRes.ok) {
          const walletData = await walletRes.json();
          const w = walletData.wallet;
          if (w) {
            setBalance(w.balance - w.reserved);
          }
        }
      } catch {
        // network error
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="page-transition space-y-6 p-6">
        <Skeleton className="h-5 w-64" />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-9 w-48 rounded-md" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!benefit) {
    return (
      <div className="page-transition space-y-4 p-6">
        <Link
          href="/dashboard/employee/catalog"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Назад к каталогу
        </Link>
        <p className="text-muted-foreground">Льгота не найдена.</p>
      </div>
    );
  }

  const IconComponent = iconMap[benefit.category?.icon ?? ""] ?? Package;
  const outOfStock =
    benefit.stock_limit !== null && benefit.stock_limit <= 0;
  const canAfford = balance !== null && balance >= benefit.price_points;

  return (
    <div className="page-transition space-y-6 p-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          href="/dashboard/employee/catalog"
          className="hover:text-foreground transition-colors"
        >
          Каталог
        </Link>
        <ChevronRight className="size-3.5" />
        {benefit.category && (
          <>
            <span className="hover:text-foreground transition-colors">
              {benefit.category.name}
            </span>
            <ChevronRight className="size-3.5" />
          </>
        )}
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {benefit.name}
        </span>
      </nav>

      {/* Back link */}
      <Link
        href="/dashboard/employee/catalog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Назад к каталогу
      </Link>

      {/* Detail card */}
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <IconComponent className="size-7" />
            </div>
            <div className="space-y-1">
              <CardTitle className="font-heading text-xl">
                {benefit.name}
              </CardTitle>
              {benefit.category && (
                <Badge variant="secondary">{benefit.category.name}</Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Description */}
          <div className="prose prose-sm max-w-none text-foreground/80">
            <p className="whitespace-pre-wrap">{benefit.description}</p>
          </div>

          {/* Price & stock */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Стоимость:</span>
              <Badge className="text-base tabular-nums px-3 py-1">
                {benefit.price_points.toLocaleString("ru-RU")} баллов
              </Badge>
            </div>

            {benefit.stock_limit !== null && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  В наличии:
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    benefit.stock_limit > 0
                      ? "text-[var(--success)]"
                      : "text-[var(--error)]"
                  }`}
                >
                  {benefit.stock_limit > 0
                    ? benefit.stock_limit
                    : "Нет в наличии"}
                </span>
              </div>
            )}
          </div>

          {/* User balance context */}
          {balance !== null && (
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Ваш доступный баланс
              </span>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  canAfford ? "text-[var(--success)]" : "text-[var(--error)]"
                }`}
              >
                {balance.toLocaleString("ru-RU")} баллов
              </span>
            </div>
          )}
        </CardContent>

        <CardFooter className="gap-3">
          {outOfStock ? (
            <Button disabled variant="outline">
              Нет в наличии
            </Button>
          ) : (
            <Button
              disabled={!canAfford && balance !== null}
            >
              Добавить в корзину
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/dashboard/employee/catalog">Назад</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
