import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  BenefitCard,
  type BenefitWithCategory,
} from "@/components/benefits/benefit-card";

interface BenefitGridProps {
  benefits: BenefitWithCategory[];
  isLoading: boolean;
  onAddToCart: (benefit: BenefitWithCategory) => void;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-2/3" />
      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="size-8 rounded-md" />
      </div>
    </div>
  );
}

export function BenefitGrid({
  benefits,
  isLoading,
  onAddToCart,
}: BenefitGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (benefits.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Льготы не найдены"
        description="Попробуйте изменить фильтры или поисковый запрос"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {benefits.map((benefit) => (
        <BenefitCard
          key={benefit.id}
          benefit={benefit}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
}
