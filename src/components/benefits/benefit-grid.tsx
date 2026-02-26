import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
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
  );
}

export function BenefitGrid({
  benefits,
  isLoading,
  onAddToCart,
}: BenefitGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
