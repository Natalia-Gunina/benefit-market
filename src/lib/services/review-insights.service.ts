import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { serverEnv, isDemo } from "@/lib/env";
import {
  unwrapRowsSoft,
  unwrapSingleOrNull,
} from "@/lib/supabase/typed-queries";

// Minimum visible reviews before we offer AI analysis at all. Below this,
// percentages would be noisy (one review = 33% on a sample of 3) and there's
// not enough signal for the LLM to detect themes — we surface insufficient_data
// instead of generating misleading insights.
const MIN_REVIEWS_FOR_INSIGHTS = 10;
const MAX_THEMES_PER_SIDE = 5;
const MAX_THEME_TEXT_LEN = 80;
const MAX_SUMMARY_LEN = 240;
const LLM_MODEL = "gpt-4o-mini";
const LLM_TIMEOUT_MS = 20_000;
// Bump when prompt or output format changes — mixed into source_hash so
// existing cache rows stop matching and get regenerated on the next read.
const PROMPT_VERSION = "v1";

export type Theme = { text: string; percent: number };

export type InsightsResult =
  | {
      status: "insufficient_data";
      reviews_count: number;
      min_required: number;
    }
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

interface ReviewRow {
  id: string;
  rating: number;
  title: string;
  body: string;
  updated_at: string;
}

interface CachedRow {
  source_hash: string;
  reviews_count_at_generation: number;
  strengths: unknown;
  weaknesses: unknown;
  summary: string;
  model: string;
  generated_at: string;
}

interface OfferingMeta {
  name: string;
  category_name: string | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getInsightsForOffering(
  providerOfferingId: string,
): Promise<InsightsResult> {
  if (isDemo) {
    return getDemoInsights(providerOfferingId);
  }

  try {
    const admin = createAdminClient();
    const reviews = await loadVisibleReviews(admin, providerOfferingId);

    if (reviews.length < MIN_REVIEWS_FOR_INSIGHTS) {
      return {
        status: "insufficient_data",
        reviews_count: reviews.length,
        min_required: MIN_REVIEWS_FOR_INSIGHTS,
      };
    }

    const sourceHash = computeSourceHash(reviews);

    const cached = await readCache(admin, providerOfferingId);
    if (cached && cached.source_hash === sourceHash) {
      logger.info("Review insights cache hit", "review-insights", {
        providerOfferingId,
        reviews: reviews.length,
      });
      return rehydrate(cached, reviews.length, "cache");
    }

    const offeringMeta = await loadOfferingMeta(admin, providerOfferingId);
    if (!offeringMeta) {
      logger.warn("Offering not found while generating insights", "review-insights", {
        providerOfferingId,
      });
      return { status: "error", message: "Льгота не найдена" };
    }

    const generated = await generateInsightsViaLLM(offeringMeta, reviews);
    if (generated.status !== "ok") {
      return generated;
    }

    await writeCache(admin, {
      providerOfferingId,
      sourceHash,
      reviewsCount: reviews.length,
      strengths: generated.strengths,
      weaknesses: generated.weaknesses,
      summary: generated.summary,
      model: generated.model,
      generatedAt: generated.generated_at,
    });

    return generated;
  } catch (err) {
    logger.error(
      "getInsightsForOffering failed",
      "review-insights",
      {
        providerOfferingId,
        error: err instanceof Error ? err.message : String(err),
      },
    );
    return {
      status: "error",
      message: "AI-анализ временно недоступен",
    };
  }
}

// ---------------------------------------------------------------------------
// Reviews loading
// ---------------------------------------------------------------------------

async function loadVisibleReviews(
  admin: SupabaseClient,
  providerOfferingId: string,
): Promise<ReviewRow[]> {
  const rows = unwrapRowsSoft<ReviewRow>(
    await admin
      .from("reviews")
      .select("id, rating, title, body, updated_at")
      .eq("provider_offering_id", providerOfferingId)
      .eq("status", "visible")
      .order("created_at", { ascending: true }),
  );
  return rows;
}

async function loadOfferingMeta(
  admin: SupabaseClient,
  providerOfferingId: string,
): Promise<OfferingMeta | null> {
  type Row = {
    name: string;
    global_categories: { name: string } | null;
  };
  const row = unwrapSingleOrNull<Row>(
    await admin
      .from("provider_offerings")
      .select("name, global_categories(name)")
      .eq("id", providerOfferingId)
      .single(),
  );
  if (!row) return null;
  return {
    name: row.name,
    category_name: row.global_categories?.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

function computeSourceHash(reviews: ReviewRow[]): string {
  const stable = reviews
    .map((r) => `${r.id}:${r.updated_at}`)
    .sort()
    .join("|");
  return PROMPT_VERSION + ":" + createHash("md5").update(stable).digest("hex");
}

// ---------------------------------------------------------------------------
// Cache read/write
// ---------------------------------------------------------------------------

async function readCache(
  admin: SupabaseClient,
  providerOfferingId: string,
): Promise<CachedRow | null> {
  const { data, error } = await admin
    .from("provider_review_insights")
    .select(
      "source_hash, reviews_count_at_generation, strengths, weaknesses, summary, model, generated_at",
    )
    .eq("provider_offering_id", providerOfferingId)
    .maybeSingle();
  if (error) {
    logger.warn("Failed to read review insights cache", "review-insights.read", {
      providerOfferingId,
      error: error.message,
    });
    return null;
  }
  return (data as CachedRow | null) ?? null;
}

async function writeCache(
  admin: SupabaseClient,
  payload: {
    providerOfferingId: string;
    sourceHash: string;
    reviewsCount: number;
    strengths: Theme[];
    weaknesses: Theme[];
    summary: string;
    model: string;
    generatedAt: string;
  },
): Promise<void> {
  const result = await admin.from("provider_review_insights").upsert(
    {
      provider_offering_id: payload.providerOfferingId,
      source_hash: payload.sourceHash,
      reviews_count_at_generation: payload.reviewsCount,
      strengths: payload.strengths,
      weaknesses: payload.weaknesses,
      summary: payload.summary,
      model: payload.model,
      generated_at: payload.generatedAt,
    } as never,
    { onConflict: "provider_offering_id" },
  );
  if (result.error) {
    logger.warn(
      "Failed to write review insights cache",
      "review-insights.write",
      { providerOfferingId: payload.providerOfferingId, error: result.error.message },
    );
  }
}

function rehydrate(
  cached: CachedRow,
  reviewsCount: number,
  source: "cache",
): InsightsResult {
  const strengths = sanitizeThemes(cached.strengths);
  const weaknesses = sanitizeThemes(cached.weaknesses);
  return {
    status: "ok",
    reviews_count: reviewsCount,
    generated_at: cached.generated_at,
    source,
    model: cached.model,
    strengths,
    weaknesses,
    summary: truncate(cached.summary, MAX_SUMMARY_LEN),
  };
}

// ---------------------------------------------------------------------------
// LLM generation
// ---------------------------------------------------------------------------

async function generateInsightsViaLLM(
  offering: OfferingMeta,
  reviews: ReviewRow[],
): Promise<InsightsResult> {
  if (!serverEnv.OPENAI_API_KEY) {
    logger.info(
      "OPENAI_API_KEY not set — insights unavailable",
      "review-insights.llm",
    );
    return {
      status: "error",
      message: "AI-анализ временно недоступен",
    };
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: serverEnv.OPENAI_API_KEY });

    const prompt = buildPrompt(offering, reviews);

    const completion = await client.chat.completions.create(
      {
        model: LLM_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Ты — продуктовый аналитик отзывов о корпоративных льготах. " +
              "Твоя задача — выделить, что сотрудники чаще всего хвалят (сильные стороны льготы) " +
              "и на что жалуются (слабые стороны льготы), с указанием процента отзывов, " +
              "в которых упомянута каждая тема. " +
              "Пиши на русском, нейтрально, без оценочных суждений, без эмоций. " +
              "Не упоминай отдельных авторов, заголовки или конкретные оценки. " +
              "Не выдумывай темы, которых нет в отзывах. " +
              "Отвечай строго в JSON.",
          },
          { role: "user", content: prompt },
        ],
      },
      { timeout: LLM_TIMEOUT_MS },
    );

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseInsightsResponse(raw);
    if (!parsed) {
      logger.warn("LLM returned invalid insights response", "review-insights.llm", {
        raw_preview: raw.slice(0, 200),
      });
      return {
        status: "error",
        message: "AI-анализ временно недоступен",
      };
    }

    return {
      status: "ok",
      reviews_count: reviews.length,
      generated_at: new Date().toISOString(),
      source: "llm",
      model: LLM_MODEL,
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      summary: parsed.summary,
    };
  } catch (err) {
    logger.error("OpenAI call failed for review insights", "review-insights.llm", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      status: "error",
      message: "AI-анализ временно недоступен",
    };
  }
}

function buildPrompt(offering: OfferingMeta, reviews: ReviewRow[]): string {
  const category = offering.category_name ?? "—";
  const reviewLines = reviews.map((r, i) => {
    const title = (r.title ?? "").trim();
    const body = truncate((r.body ?? "").trim().replace(/\s+/g, " "), 400);
    const titlePart = title ? `"${title}" — ` : "";
    return `[${i + 1}, оценка ${r.rating}/5] ${titlePart}${body}`;
  });

  return [
    `Льгота: ${offering.name}`,
    `Категория: ${category}`,
    `Количество отзывов: ${reviews.length}`,
    "",
    "Отзывы сотрудников:",
    ...reviewLines,
    "",
    "ЗАДАЧА:",
    `1. Выдели от 2 до ${MAX_THEMES_PER_SIDE} сильных сторон льготы — то, что сотрудники чаще всего хвалят.`,
    `2. Выдели от 0 до ${MAX_THEMES_PER_SIDE} слабых сторон льготы — на что жалуются.`,
    "3. Для каждой темы укажи процент отзывов (1-100, целое число), в которых эта тема упомянута.",
    "4. Напиши краткий вывод (summary) на 1-2 предложения.",
    "",
    "ПРАВИЛА:",
    `- Каждая тема — короткая фраза до ${MAX_THEME_TEXT_LEN} символов на русском, понятная и конкретная.`,
    "  Пример сильных сторон: «Удобная запись через приложение», «Профессиональные тренеры», «Корпоративная скидка».",
    "  Пример слабых сторон: «Высокая стоимость без скидки», «Очереди в час пик», «Устаревшие примеры в материалах».",
    "- НЕ выдумывай темы, которых нет в отзывах. Если жалоб реально мало или они уникальны — оставь массив weaknesses коротким или пустым.",
    "- Если одна и та же тема выражена разными словами в нескольких отзывах — объедини их под одной формулировкой.",
    "- НЕ упоминай имена авторов, конкретные отзывы, оценки (5/5, 4/5 и т.п.).",
    "- НЕ дублируй название самой льготы — оно и так известно.",
    "- Процент = доля отзывов из выборки (1-100, целое), в которых упомянута тема. Темы могут перекрываться — сумма необязательно равна 100.",
    "- Сортируй темы по убыванию процента.",
    "- summary — фактическая сводка без рекомендаций, без воды, до 240 символов.",
    "",
    'Ответь строго в JSON: {"strengths":[{"text":"<тема>","percent":<число>}],"weaknesses":[{"text":"<тема>","percent":<число>}],"summary":"<вывод>"}',
  ].join("\n");
}

function parseInsightsResponse(
  raw: string,
): { strengths: Theme[]; weaknesses: Theme[]; summary: string } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const strengths = sanitizeThemes(obj.strengths);
  const weaknesses = sanitizeThemes(obj.weaknesses);
  // Require at least one strength — every benefit that has 10+ visible
  // reviews and accumulates organic activity must have SOMETHING positive
  // people say about it. If the model returned nothing here, the parse
  // probably went sideways — fall through to error rather than store junk.
  if (strengths.length === 0) return null;

  const summary =
    typeof obj.summary === "string"
      ? truncate(obj.summary.trim(), MAX_SUMMARY_LEN)
      : "";

  return { strengths, weaknesses, summary };
}

function sanitizeThemes(input: unknown): Theme[] {
  if (!Array.isArray(input)) return [];
  const out: Theme[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (out.length >= MAX_THEMES_PER_SIDE) break;
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const text = typeof obj.text === "string" ? obj.text.trim() : "";
    const rawPercent = obj.percent;
    if (!text) continue;
    const truncated = truncate(text, MAX_THEME_TEXT_LEN);
    const key = truncated.toLowerCase();
    if (seen.has(key)) continue;
    let percent: number;
    if (typeof rawPercent === "number" && Number.isFinite(rawPercent)) {
      percent = Math.round(rawPercent);
    } else if (typeof rawPercent === "string") {
      const m = rawPercent.match(/\d+/);
      percent = m ? parseInt(m[0]!, 10) : 0;
    } else {
      continue;
    }
    if (!Number.isFinite(percent)) continue;
    if (percent < 1) percent = 1;
    if (percent > 100) percent = 100;
    out.push({ text: truncated, percent });
    seen.add(key);
  }
  // Sort by percent desc — defensive, the LLM is asked to do this but we
  // shouldn't trust the order coming back.
  out.sort((a, b) => b.percent - a.percent);
  return out;
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

async function getDemoInsights(
  providerOfferingId: string,
): Promise<InsightsResult> {
  // Hardcoded mock for the one demo offering that has the richest review
  // text — so the UI can be visually verified in demo mode without a live
  // OpenAI key. The other demo offerings honestly fall under the threshold
  // (the demo dataset has only 1-3 reviews each), which exercises the
  // insufficient_data path in the same screen.
  if (providerOfferingId === "demo-po-001") {
    return {
      status: "ok",
      reviews_count: 12,
      generated_at: "2026-05-15T12:00:00Z",
      source: "llm",
      model: LLM_MODEL,
      strengths: [
        { text: "Профессиональные тренеры", percent: 75 },
        { text: "Корпоративная скидка на абонемент", percent: 60 },
        { text: "Хорошее оборудование и SPA-зона", percent: 50 },
        { text: "Удобный бассейн после работы", percent: 25 },
      ],
      weaknesses: [
        { text: "Высокая стоимость без корпоративной скидки", percent: 33 },
        { text: "Загруженность залов в часы пик", percent: 17 },
      ],
      summary:
        "Сотрудники ценят профессионализм тренеров и SPA-зону. Главная зона роста — снизить ощущение высокой цены и распределить нагрузку по времени.",
    };
  }

  // Try to count actual demo reviews for the requested offering so the
  // insufficient_data card shows real numbers.
  try {
    const { DEMO_REVIEWS } = await import("@/lib/demo-data");
    const visible = (DEMO_REVIEWS ?? []).filter(
      (r) => r.provider_offering_id === providerOfferingId && r.status === "visible",
    );
    return {
      status: "insufficient_data",
      reviews_count: visible.length,
      min_required: MIN_REVIEWS_FOR_INSIGHTS,
    };
  } catch {
    return {
      status: "insufficient_data",
      reviews_count: 0,
      min_required: MIN_REVIEWS_FOR_INSIGHTS,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const breakPoint = lastSpace > max * 0.6 ? lastSpace : max - 1;
  return s.slice(0, breakPoint).trimEnd() + "…";
}
