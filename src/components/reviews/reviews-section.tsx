"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StarRating } from "./star-rating";
import { ReviewForm } from "./review-form";

interface ReviewItem {
  id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  users?: { email: string } | null;
}

interface ReviewStats {
  global: { avg: number; count: number };
  company: { avg: number; count: number };
}

interface CanReviewResponse {
  can_review: boolean;
  has_reviewed: boolean;
  review_id?: string;
}

interface ReviewsSectionProps {
  tenantOfferingId: string;
  providerOfferingId: string;
}

export function ReviewsSection({
  tenantOfferingId,
  providerOfferingId,
}: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [canReview, setCanReview] = useState<CanReviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [reviewsRes, canReviewRes] = await Promise.all([
        fetch(`/api/offerings/${tenantOfferingId}/reviews`),
        fetch(`/api/offerings/${tenantOfferingId}/can-review`),
      ]);

      if (reviewsRes.ok) {
        const json = await reviewsRes.json();
        const d = json.data ?? json;
        setReviews(d.reviews ?? []);
        setStats(d.stats ?? null);
      }

      if (canReviewRes.ok) {
        const json = await canReviewRes.json();
        setCanReview(json.data ?? json);
      }
    } catch {
      toast.error("Не удалось загрузить отзывы");
    } finally {
      setIsLoading(false);
    }
  }, [tenantOfferingId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleRefresh() {
    setIsLoading(true);
    fetchData();
  }

  function handleEdit(review: ReviewItem) {
    setEditingReview(review);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deletingReviewId) return;
    try {
      const res = await fetch(`/api/reviews/${deletingReviewId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Отзыв удалён");
      handleRefresh();
    } catch {
      toast.error("Не удалось удалить отзыв");
    } finally {
      setDeletingReviewId(null);
    }
  }

  function handleNewReview() {
    setEditingReview(null);
    setFormOpen(true);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-semibold">Отзывы</h2>
        {canReview?.can_review && !canReview.has_reviewed && (
          <Button size="sm" onClick={handleNewReview}>
            <MessageSquarePlus className="size-4 mr-1.5" />
            Оставить отзыв
          </Button>
        )}
      </div>

      {/* Stats summary */}
      {stats && (stats.global.count > 0 || stats.company.count > 0) && (
        <div className="flex flex-wrap gap-6">
          {stats.global.count > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Общий рейтинг
              </p>
              <StarRating rating={stats.global.avg} count={stats.global.count} />
            </div>
          )}
          {stats.company.count > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                В нашей компании
              </p>
              <StarRating
                rating={stats.company.avg}
                count={stats.company.count}
              />
            </div>
          )}
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">Отзывов пока нет</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <StarRating rating={review.rating} />
                    {review.title && (
                      <p className="font-medium text-sm">{review.title}</p>
                    )}
                  </div>
                  {canReview?.has_reviewed &&
                    canReview.review_id === review.id && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => handleEdit(review)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive"
                          onClick={() => setDeletingReviewId(review.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                </div>
                {review.body && (
                  <p className="text-sm text-foreground/80">{review.body}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{review.users?.email ?? "Пользователь"}</span>
                  <span>&middot;</span>
                  <span>
                    {new Date(review.created_at).toLocaleDateString("ru-RU")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingReviewId} onOpenChange={() => setDeletingReviewId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить отзыв?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Отзыв будет удалён безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Review form dialog */}
      <ReviewForm
        open={formOpen}
        onOpenChange={setFormOpen}
        providerOfferingId={providerOfferingId}
        existingReview={
          editingReview
            ? {
                id: editingReview.id,
                rating: editingReview.rating,
                title: editingReview.title,
                body: editingReview.body,
              }
            : undefined
        }
        onSuccess={handleRefresh}
      />
    </div>
  );
}
