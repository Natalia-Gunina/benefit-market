"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StarRating } from "./star-rating";

interface ReviewFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerOfferingId: string;
  existingReview?: {
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
  };
  onSuccess: () => void;
}

export function ReviewForm({
  open,
  onOpenChange,
  providerOfferingId,
  existingReview,
  onSuccess,
}: ReviewFormProps) {
  const isEditing = !!existingReview;
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [title, setTitle] = useState(existingReview?.title ?? "");
  const [body, setBody] = useState(existingReview?.body ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Выберите рейтинг");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEditing
        ? `/api/reviews/${existingReview.id}`
        : "/api/reviews";
      const method = isEditing ? "PATCH" : "POST";

      const payload = isEditing
        ? { rating, title: title || undefined, body: body || undefined }
        : {
            provider_offering_id: providerOfferingId,
            rating,
            title: title || undefined,
            body: body || undefined,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message ?? "Ошибка при отправке отзыва");
      }

      toast.success(isEditing ? "Отзыв обновлён" : "Отзыв добавлен");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Редактировать отзыв" : "Оставить отзыв"}
          </DialogTitle>
          <DialogDescription>
            Поделитесь своим опытом использования
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Рейтинг</Label>
            <StarRating
              rating={rating}
              size="md"
              interactive
              onRate={setRating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-title">Заголовок</Label>
            <Input
              id="review-title"
              placeholder="Кратко о вашем опыте"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-body">Отзыв</Label>
            <Textarea
              id="review-body"
              placeholder="Расскажите подробнее..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting || rating === 0}>
              {isSubmitting
                ? "Отправка..."
                : isEditing
                  ? "Сохранить"
                  : "Отправить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
