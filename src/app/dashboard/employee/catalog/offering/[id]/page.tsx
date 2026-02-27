"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Heart,
  HeartPulse,
  GraduationCap,
  Dumbbell,
  UtensilsCrossed,
  Gift,
  ShieldCheck,
  Car,
  Sparkles,
  Wallet,
  ChevronRight,
  Building2,
  Truck,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "@/lib/store/cart";
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
import { StarRating } from "@/components/reviews/star-rating";
import { ReviewsSection } from "@/components/reviews/reviews-section";

const iconMap: Record<string, LucideIcon> = {
  heart: Heart,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  dumbbell: Dumbbell,
  utensils: UtensilsCrossed,
  gift: Gift,
  shield: ShieldCheck,
  car: Car,
  sparkles: Sparkles,
  wallet: Wallet,
};

interface OfferingDetail {
  id: string;
  provider_offering_id: string;
  effective_price: number;
  custom_price_points: number | null;
  tenant_stock_limit: number | null;
  ratings: {
    global: { avg: number; count: number };
    company: { avg: number; count: number };
  };
  provider_offerings: {
    id: string;
    name: string;
    description: string;
    long_description: string | null;
    base_price_points: number;
    stock_limit: number | null;
    delivery_info: string | null;
    terms_conditions: string | null;
    avg_rating: number | null;
    review_count: number | null;
    providers: {
      id: string;
      name: string;
      logo_url: string | null;
      description: string | null;
    } | null;
    global_categories: { name: string; icon: string } | null;
  } | null;
}

export default function OfferingDetailPage() {
  const params = useParams<{ id: string }>();
  const addItem = useCartStore((s) => s.addItem);
  const [offering, setOffering] = useState<OfferingDetail | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [offeringRes, walletRes] = await Promise.all([
          fetch(`/api/offerings/${params.id}`),
          fetch("/api/wallets/me"),
        ]);

        if (offeringRes.ok) {
          const json = await offeringRes.json();
          setOffering(json.data ?? json);
        }

        if (walletRes.ok) {
          const json = await walletRes.json();
          const d = json.data ?? json;
          if (d.wallet) {
            setBalance(d.wallet.balance - d.wallet.reserved);
          } else if (d.available !== undefined) {
            setBalance(d.available);
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

  if (!offering || !offering.provider_offerings) {
    return (
      <div className="page-transition space-y-4 p-6">
        <Link
          href="/dashboard/employee/catalog"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Назад к каталогу
        </Link>
        <p className="text-muted-foreground">Предложение не найдено.</p>
      </div>
    );
  }

  const po = offering.provider_offerings;
  const provider = po.providers;
  const category = po.global_categories;
  const IconComponent = iconMap[category?.icon ?? ""] ?? Package;
  const stockLimit = offering.tenant_stock_limit ?? po.stock_limit;
  const outOfStock = stockLimit !== null && stockLimit <= 0;
  const canAfford =
    balance !== null && balance >= offering.effective_price;

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
        {category && (
          <>
            <span className="hover:text-foreground transition-colors">
              {category.name}
            </span>
            <ChevronRight className="size-3.5" />
          </>
        )}
        <span className="text-foreground font-medium truncate max-w-[200px]">
          {po.name}
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
            <div className="space-y-1.5">
              <CardTitle className="font-heading text-xl">{po.name}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {category && (
                  <Badge variant="secondary">{category.name}</Badge>
                )}
                {provider && (
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="size-3" />
                    {provider.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Rating */}
          {(offering.ratings.global.count > 0 ||
            offering.ratings.company.count > 0) && (
            <div className="flex flex-wrap gap-4">
              {offering.ratings.global.count > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Общий рейтинг
                  </p>
                  <StarRating
                    rating={offering.ratings.global.avg}
                    count={offering.ratings.global.count}
                  />
                </div>
              )}
              {offering.ratings.company.count > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    В нашей компании
                  </p>
                  <StarRating
                    rating={offering.ratings.company.avg}
                    count={offering.ratings.company.count}
                  />
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="prose prose-sm max-w-none text-foreground/80">
            <p className="whitespace-pre-wrap">
              {po.long_description || po.description}
            </p>
          </div>

          {/* Price & stock */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Стоимость:</span>
              <Badge className="text-base tabular-nums px-3 py-1">
                {offering.effective_price.toLocaleString("ru-RU")} баллов
              </Badge>
            </div>

            {stockLimit !== null && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  В наличии:
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    stockLimit > 0
                      ? "text-[var(--success)]"
                      : "text-[var(--error)]"
                  }`}
                >
                  {stockLimit > 0 ? stockLimit : "Нет в наличии"}
                </span>
              </div>
            )}
          </div>

          {/* Delivery info */}
          {po.delivery_info && (
            <div className="flex items-start gap-2 rounded-lg border p-3">
              <Truck className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Доставка / Активация</p>
                <p className="text-sm text-muted-foreground">
                  {po.delivery_info}
                </p>
              </div>
            </div>
          )}

          {/* Terms */}
          {po.terms_conditions && (
            <div className="flex items-start gap-2 rounded-lg border p-3">
              <FileText className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Условия</p>
                <p className="text-sm text-muted-foreground">
                  {po.terms_conditions}
                </p>
              </div>
            </div>
          )}

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
              onClick={() => {
                addItem({
                  id: offering.id,
                  name: po.name,
                  price_points: offering.effective_price,
                  stock_limit: stockLimit,
                  tenant_offering_id: offering.id,
                  provider_name: provider?.name,
                  provider_logo_url: provider?.logo_url ?? undefined,
                  avg_rating: offering.ratings.global.avg,
                  category_name: category?.name,
                  category_icon: category?.icon,
                });
                toast.success(`${po.name} добавлен в корзину`);
              }}
            >
              Добавить в корзину
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/dashboard/employee/catalog">Назад</Link>
          </Button>
        </CardFooter>
      </Card>

      {/* Reviews section */}
      <div className="max-w-2xl">
        <ReviewsSection
          tenantOfferingId={offering.id}
          providerOfferingId={po.id}
        />
      </div>
    </div>
  );
}
