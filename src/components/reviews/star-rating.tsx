"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  count?: number;
  size?: "sm" | "md";
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

export function StarRating({
  rating,
  count,
  size = "sm",
  interactive = false,
  onRate,
}: StarRatingProps) {
  const iconSize = size === "sm" ? "size-4" : "size-5";

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= Math.round(rating);
          return (
            <button
              key={star}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onRate?.(star)}
              className={cn(
                "p-0 border-0 bg-transparent",
                interactive
                  ? "cursor-pointer hover:scale-110 transition-transform"
                  : "cursor-default",
              )}
            >
              <Star
                className={cn(
                  iconSize,
                  filled
                    ? "fill-amber-400 text-amber-400"
                    : "fill-transparent text-muted-foreground/40",
                )}
              />
            </button>
          );
        })}
      </div>
      {rating > 0 && (
        <span className="text-sm font-medium tabular-nums">
          {rating.toFixed(1)}
        </span>
      )}
      {count !== undefined && (
        <span className="text-sm text-muted-foreground">
          ({count})
        </span>
      )}
    </div>
  );
}
