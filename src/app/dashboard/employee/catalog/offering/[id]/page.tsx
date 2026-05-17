"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingCart,
  Check,
  MapPin,
  Globe,
  Star,
  Truck,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "@/lib/store/cart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/reviews/star-rating";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { getCategoryIcon } from "@/lib/category-icons";

const avatarColors = [
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

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
    format?: string;
    cities?: string[] | null;
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
  const removeItem = useCartStore((s) => s.removeItem);
  const cartItems = useCartStore((s) => s.items);
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
          if (d.wallet) setBalance(d.wallet.balance - d.wallet.reserved);
          else if (d.available !== undefined) setBalance(d.available);
        }
      } catch {
        toast.error("Не удалось загрузить данные");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="page-transition space-y-8 p-6">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <div className="flex gap-4">
              <Skeleton className="size-14 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-7 w-72" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!offering || !offering.provider_offerings) {
    return (
      <div className="page-transition space-y-4 p-6">
        <Link
          href="/dashboard/employee/catalog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
  const IconComponent = getCategoryIcon(category?.icon ?? "");
  const stockLimit = offering.tenant_stock_limit ?? po.stock_limit;
  const outOfStock = stockLimit !== null && stockLimit <= 0;
  const canAfford = balance !== null && balance >= offering.effective_price;

  const providerName = provider?.name ?? "Провайдер";
  const color = avatarColors[hashCode(providerName) % avatarColors.length];

  const inCart = cartItems.some((item) => item.benefit.id === offering.id);
  const vtId = offering.id.slice(0, 8);

  function handleAddToCart() {
    if (!offering || !po) return;
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
  }

  return (
    <div className="page-transition space-y-8 p-6">
      <Link
        href="/dashboard/employee/catalog"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Назад к каталогу
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px] items-start">
        {/* ─── Left column ─── */}
        <div className="space-y-8">
          {/* Header: avatar + name + meta + price */}
          <div className="flex items-start gap-4">
            {provider?.logo_url ? (
              <img
                src={provider.logo_url}
                alt={providerName}
                className="size-14 shrink-0 rounded-full object-cover"
                style={{ viewTransitionName: `benefit-avatar-${vtId}` }}
              />
            ) : (
              <div
                className={`flex size-14 shrink-0 items-center justify-center rounded-full text-sm font-bold ${color.bg} ${color.text}`}
                style={{ viewTransitionName: `benefit-avatar-${vtId}` }}
              >
                {getInitials(providerName)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-6">
                <h1 className="text-2xl font-heading font-bold leading-tight" style={{ viewTransitionName: `benefit-title-${vtId}` }}>{po.name}</h1>
                <span className="text-2xl font-bold tabular-nums shrink-0">
                  {offering.effective_price.toLocaleString("ru-RU")} <span className="text-sm font-normal text-muted-foreground">б.</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                <span>{providerName}</span>
                {category && (
                  <>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1">
                      <IconComponent className="size-3.5" />
                      {category.name}
                    </span>
                  </>
                )}
                {po.format === "offline" && Array.isArray(po.cities) && po.cities.length > 0 ? (
                  <>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {po.cities.join(", ")}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1">
                      <Globe className="size-3.5" />
                      Онлайн
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-4">
                  {offering.ratings.global.count > 0 && (
                    <StarRating rating={offering.ratings.global.avg} count={offering.ratings.global.count} />
                  )}
                  {offering.ratings.company.count > 0 && (
                    <span className="text-xs text-muted-foreground">
                      В компании: <Star className="inline size-3 fill-amber-400 text-amber-400 -mt-0.5" /> {offering.ratings.company.avg.toFixed(1)} ({offering.ratings.company.count})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {balance !== null && (
                    <span className={`text-xs tabular-nums ${canAfford ? "text-muted-foreground" : "text-error"}`}>
                      {canAfford
                        ? `Баланс: ${balance.toLocaleString("ru-RU")} б.`
                        : `Не хватает ${(offering.effective_price - balance).toLocaleString("ru-RU")} б.`}
                    </span>
                  )}
                  {outOfStock ? (
                    <Button disabled variant="outline">Нет в наличии</Button>
                  ) : inCart ? (
                    <Button variant="outline" className="border-success text-success" onClick={() => removeItem(offering.id)}>
                      <Check className="size-4" />
                      В корзине
                    </Button>
                  ) : (
                    <Button disabled={!canAfford && balance !== null} onClick={handleAddToCart}>
                      <ShoppingCart className="size-4" />
                      В корзину
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-[15px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
              {po.long_description || po.description}
            </p>
          </div>

          {/* Extra info */}
          {(po.delivery_info || po.terms_conditions) && (
            <div className="space-y-4 rounded-lg border p-5">
              {po.delivery_info && (
                <div className="flex items-start gap-3">
                  <Truck className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Доставка / Активация</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{po.delivery_info}</p>
                  </div>
                </div>
              )}
              {po.delivery_info && po.terms_conditions && <div className="border-t" />}
              {po.terms_conditions && (
                <div className="flex items-start gap-3">
                  <FileText className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Условия</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{po.terms_conditions}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Right column: reviews ─── */}
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto custom-scrollbar">
          <ReviewsSection
            tenantOfferingId={offering.id}
            providerOfferingId={po.id}
          />
        </div>
      </div>
    </div>
  );
}
