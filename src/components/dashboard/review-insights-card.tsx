"use client";

import { useEffect, useState } from "react";
import { Sparkles, ThumbsUp, ThumbsDown, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Theme = { text: string; percent: number };

type ReviewInsights =
  | { status: "insufficient_data"; reviews_count: number; min_required: number }
  | {
      status: "ok";
      reviews_count: number;
      generated_at: string;
      source: "llm" | "cache";
      model: string;
      strengths: Theme[];
      weaknesses: Theme[];
      summary: string;
    }
  | { status: "error"; message: string };

interface Props {
  // null = no specific offering selected; the card shows a "pick one" hint.
  // The parent passes the same value to `key` too, so each new selection
  // remounts this component — that's how we reset loading/insights state
  // without violating react-hooks/set-state-in-effect.
  offeringId: string | null;
}

export function ReviewInsightsCard({ offeringId }: Props) {
  const offeringSelected = offeringId !== null;
  const [insights, setInsights] = useState<ReviewInsights | null>(null);
  // Start in loading mode only when we actually have something to load.
  const [isLoading, setIsLoading] = useState<boolean>(offeringSelected);

  useEffect(() => {
    if (offeringId === null) return;
    const ctrl = new AbortController();
    fetch(
      `/api/provider/analytics/insights?offering_id=${encodeURIComponent(offeringId)}`,
      { signal: ctrl.signal },
    )
      .then((r) => r.json())
      .then((json) => {
        if (ctrl.signal.aborted) return;
        if (json?.data) {
          setInsights(json.data as ReviewInsights);
        } else {
          setInsights({ status: "error", message: "Не удалось загрузить AI-анализ" });
        }
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        if ((err as { name?: string } | null)?.name === "AbortError") return;
        setInsights({ status: "error", message: "Не удалось загрузить AI-анализ" });
      })
      .finally(() => {
        if (ctrl.signal.aborted) return;
        setIsLoading(false);
      });
    return () => ctrl.abort();
  }, [offeringId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-500" />
          AI-анализ отзывов
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!offeringSelected ? (
          <EmptyHint
            icon={<Info className="size-5 text-muted-foreground" />}
            title="Выберите конкретную льготу"
            description="В фильтре сверху укажите льготу, чтобы увидеть AI-анализ отзывов сотрудников по ней."
          />
        ) : isLoading || insights === null ? (
          <InsightsSkeleton />
        ) : insights.status === "insufficient_data" ? (
          <EmptyHint
            icon={<Info className="size-5 text-muted-foreground" />}
            title={`Пока недостаточно отзывов (${insights.reviews_count} из ${insights.min_required})`}
            description={`AI-анализ появится автоматически, когда наберётся минимум ${insights.min_required} отзывов на эту льготу.`}
          />
        ) : insights.status === "error" ? (
          <EmptyHint
            icon={<Info className="size-5 text-muted-foreground" />}
            title="Не удалось получить AI-анализ"
            description={insights.message || "Попробуйте обновить страницу позже."}
          />
        ) : (
          <InsightsContent insights={insights} />
        )}
      </CardContent>
    </Card>
  );
}

function InsightsContent({
  insights,
}: {
  insights: Extract<ReviewInsights, { status: "ok" }>;
}) {
  const generatedDate = new Date(insights.generated_at);
  const generatedLabel = Number.isNaN(generatedDate.getTime())
    ? null
    : generatedDate.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

  return (
    <div className="space-y-5">
      <div className="text-xs text-muted-foreground">
        На основе {insights.reviews_count}{" "}
        {pluralReviews(insights.reviews_count)}
        {generatedLabel ? ` · ${generatedLabel}` : ""} · {insights.model}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ThemeColumn
          title="Сильные стороны"
          icon={<ThumbsUp className="size-4 text-emerald-600" />}
          tone="positive"
          themes={insights.strengths}
          empty="Ярко выраженных похвал не обнаружено"
        />
        <ThemeColumn
          title="Слабые стороны"
          icon={<ThumbsDown className="size-4 text-rose-600" />}
          tone="negative"
          themes={insights.weaknesses}
          empty="Заметных жалоб не обнаружено"
        />
      </div>

      {insights.summary && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm italic text-muted-foreground">
          {insights.summary}
        </div>
      )}
    </div>
  );
}

function ThemeColumn({
  title,
  icon,
  tone,
  themes,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "positive" | "negative";
  themes: Theme[];
  empty: string;
}) {
  const badgeClass =
    tone === "positive"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900"
      : "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        <span>{title}</span>
      </div>
      {themes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {themes.map((t, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <span className="text-sm">{t.text}</span>
              <Badge variant="outline" className={badgeClass}>
                {t.percent}%
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-3 w-48" />
      <div className="grid gap-6 md:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-4 w-32" />
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-12 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyHint({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="mt-0.5">{icon}</div>
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

// Genitive case (used after "на основе X") — singular form for 1/21/31..., plural otherwise.
function pluralReviews(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "отзыва";
  return "отзывов";
}
