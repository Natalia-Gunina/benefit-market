"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "./star-rating";
import { ReviewForm } from "./review-form";

export interface MyReview {
  id: string;
  provider_offering_id: string;
  rating: number;
  title: string | null;
  body: string | null;
}

interface OrderItemReviewProps {
  providerOfferingId: string;
  existingReview?: MyReview | null;
  onChanged?: () => void;
  size?: "sm" | "md";
}

export function OrderItemReview({
  providerOfferingId,
  existingReview,
  onChanged,
  size = "sm",
}: OrderItemReviewProps) {
  const [open, setOpen] = useState(false);
  const hasReview = !!existingReview;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasReview ? (
        <button
          className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors hover:bg-muted"
          onClick={() => setOpen(true)}
        >
          <StarRating rating={existingReview!.rating} size={size} />
        </button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setOpen(true)}
        >
          <MessageSquarePlus className="size-3 mr-1" />
          Оценить
        </Button>
      )}

      {/* Mount the form only while open so its useState initializers
          read the latest existingReview each time the dialog opens. */}
      {open && (
        <ReviewForm
          open={open}
          onOpenChange={setOpen}
          providerOfferingId={providerOfferingId}
          existingReview={
            hasReview
              ? {
                  id: existingReview!.id,
                  rating: existingReview!.rating,
                  body: existingReview!.body,
                }
              : undefined
          }
          onSuccess={() => onChanged?.()}
        />
      )}
    </div>
  );
}
