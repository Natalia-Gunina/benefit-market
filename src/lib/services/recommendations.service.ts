import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";
import {
  getActiveOfferingsForTenant,
  type OfferingRow,
} from "@/lib/services/offerings.service";

const MAX_RECOMMENDATIONS = 5;
const LLM_MODEL = "gpt-4o-mini";
const LLM_TIMEOUT_MS = 15_000;

export type RecommendationSource = "llm" | "popular";

export interface RecommendationItem extends OfferingRow {
  reason: string;
}

export interface RecommendationsResult {
  items: RecommendationItem[];
  source: RecommendationSource;
}

interface ProfileSnapshot {
  marital_status: string;
  has_children: boolean;
  children: { birthday: string }[];
  work_format: string;
  has_pets: string;
  priorities: string[];
  gender: string;
  birthday: string;
}

interface CachedRow {
  items: { tenant_offering_id: string; reason: string }[];
  source: RecommendationSource;
  profile_hash: string;
  catalog_hash: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getRecommendationsForUser(
  userId: string,
  tenantId: string,
): Promise<RecommendationsResult> {
  const admin = createAdminClient();

  try {
    const [profile, offerings] = await Promise.all([
      loadProfileSnapshot(admin, userId),
      getActiveOfferingsForTenant(admin, tenantId),
    ]);

    if (offerings.length === 0) {
      return { items: [], source: "popular" };
    }

    const profileHash = hashProfile(profile);
    const catalogHash = hashCatalog(offerings);

    const cached = await readCache(admin, userId);
    if (
      cached &&
      cached.profile_hash === profileHash &&
      cached.catalog_hash === catalogHash
    ) {
      return rehydrate(cached, offerings);
    }

    const generated = isProfileMeaningfullyFilled(profile)
      ? await generateLLMRecommendations(profile, offerings)
      : getPopularFallback(offerings);

    // Don't cache empty results — let the next request retry.
    if (generated.items.length > 0) {
      await writeCache(admin, {
        userId,
        tenantId,
        items: generated.items.map((it) => ({
          tenant_offering_id: it.id,
          reason: it.reason,
        })),
        source: generated.source,
        profileHash,
        catalogHash,
      });
    }

    return generated;
  } catch (err) {
    // The recommendations carousel is non-critical UX. If anything blows up
    // (malformed profile JSONB, DB hiccup, LLM crash that escaped the inner
    // try/catch), log it and fall back to a popularity ranking so the page
    // still renders. NEVER throw out of this function — the API contract
    // guarantees a valid response shape.
    logger.error(
      "getRecommendationsForUser failed; falling back to popular",
      "recommendations",
      {
        userId,
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      },
    );
    try {
      const offerings = await getActiveOfferingsForTenant(admin, tenantId);
      return getPopularFallback(offerings);
    } catch {
      return { items: [], source: "popular" };
    }
  }
}

// Called from PATCH /api/employee/profile to eagerly invalidate the cache
// when the employee changes anything that affects recommendations.
export async function invalidateRecommendationsForUser(
  userId: string,
): Promise<void> {
  const admin = createAdminClient();
  const result = await admin
    .from("employee_recommendations")
    .delete()
    .eq("user_id", userId);
  if (result.error) {
    logger.warn(
      "Failed to invalidate recommendations cache",
      "recommendations.invalidate",
      { userId, error: result.error.message },
    );
  }
}

// ---------------------------------------------------------------------------
// Profile loading + completeness
// ---------------------------------------------------------------------------

async function loadProfileSnapshot(
  admin: SupabaseClient,
  userId: string,
): Promise<ProfileSnapshot> {
  const { data } = await admin
    .from("employee_profiles")
    .select("gender, birthday, extra")
    .eq("user_id", userId)
    .single();

  const row = (data ?? {}) as {
    gender: string | null;
    birthday: string | null;
    extra: Record<string, unknown> | null;
  };
  // `extra` is a JSONB blob. We can't trust its shape: legacy imports, broken
  // PATCHes, or hand-edited rows may store nulls, booleans, or even arrays
  // where the new schema expects something else. Coerce defensively — every
  // call site downstream assumes the shape returned by ProfileSnapshot.
  const extra =
    row.extra && typeof row.extra === "object" && !Array.isArray(row.extra)
      ? (row.extra as Record<string, unknown>)
      : {};

  const childrenRaw = extra.children;
  const children: { birthday: string }[] = Array.isArray(childrenRaw)
    ? childrenRaw
        .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
        .map((c) => ({
          birthday: typeof c.birthday === "string" ? c.birthday : "",
        }))
    : [];

  const prioritiesRaw = extra.priorities;
  const priorities: string[] = Array.isArray(prioritiesRaw)
    ? prioritiesRaw.filter((p): p is string => typeof p === "string")
    : [];

  return {
    marital_status: typeof extra.marital_status === "string" ? extra.marital_status : "",
    has_children: extra.has_children === true,
    children,
    work_format: typeof extra.work_format === "string" ? extra.work_format : "",
    has_pets: typeof extra.has_pets === "string" ? extra.has_pets : "",
    priorities,
    gender: typeof row.gender === "string" ? row.gender : "",
    birthday: typeof row.birthday === "string" ? row.birthday : "",
  };
}

export function isProfileMeaningfullyFilled(profile: ProfileSnapshot): boolean {
  // Profile is "meaningfully filled" if at least 3 of the 4 key signals are set.
  // priorities is always non-empty (defaults), so we don't count it.
  const filled = [
    !!profile.marital_status,
    !!profile.work_format,
    !!profile.has_pets,
    profile.has_children === true || profile.has_children === false, // explicit choice
  ].filter(Boolean).length;
  return filled >= 3;
}

// ---------------------------------------------------------------------------
// Hashes
// ---------------------------------------------------------------------------

function hashProfile(profile: ProfileSnapshot): string {
  // Stringify in a fixed key order so the hash is stable.
  const stable = JSON.stringify({
    marital_status: profile.marital_status,
    has_children: profile.has_children,
    children: profile.children.map((c) => c.birthday).sort(),
    work_format: profile.work_format,
    has_pets: profile.has_pets,
    priorities: profile.priorities,
    gender: profile.gender,
    birthday: profile.birthday,
  });
  return createHash("md5").update(stable).digest("hex");
}

function hashCatalog(offerings: OfferingRow[]): string {
  const ids = offerings
    .map((o) => o.id)
    .sort()
    .join(",");
  return createHash("md5").update(ids).digest("hex");
}

// ---------------------------------------------------------------------------
// Cache read/write
// ---------------------------------------------------------------------------

async function readCache(
  admin: SupabaseClient,
  userId: string,
): Promise<CachedRow | null> {
  const { data, error } = await admin
    .from("employee_recommendations")
    .select("items, source, profile_hash, catalog_hash")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    logger.warn("Failed to read recommendations cache", "recommendations.read", {
      userId,
      error: error.message,
    });
    return null;
  }
  return (data as CachedRow | null) ?? null;
}

async function writeCache(
  admin: SupabaseClient,
  payload: {
    userId: string;
    tenantId: string;
    items: { tenant_offering_id: string; reason: string }[];
    source: RecommendationSource;
    profileHash: string;
    catalogHash: string;
  },
): Promise<void> {
  const result = await admin.from("employee_recommendations").upsert(
    {
      user_id: payload.userId,
      tenant_id: payload.tenantId,
      items: payload.items,
      source: payload.source,
      profile_hash: payload.profileHash,
      catalog_hash: payload.catalogHash,
      generated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id" },
  );
  if (result.error) {
    logger.warn(
      "Failed to write recommendations cache",
      "recommendations.write",
      { userId: payload.userId, error: result.error.message },
    );
  }
}

function rehydrate(
  cached: CachedRow,
  offerings: OfferingRow[],
): RecommendationsResult {
  const byId = new Map(offerings.map((o) => [o.id, o]));
  const items: RecommendationItem[] = [];
  for (const it of cached.items) {
    const offering = byId.get(it.tenant_offering_id);
    if (offering) {
      items.push({ ...offering, reason: it.reason });
    }
  }
  return { items, source: cached.source };
}

// ---------------------------------------------------------------------------
// LLM generation
// ---------------------------------------------------------------------------

async function generateLLMRecommendations(
  profile: ProfileSnapshot,
  offerings: OfferingRow[],
): Promise<RecommendationsResult> {
  if (!serverEnv.OPENAI_API_KEY) {
    logger.info("OPENAI_API_KEY not set — using popularity fallback", "recommendations.llm");
    return getPopularFallback(offerings);
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: serverEnv.OPENAI_API_KEY });

    const prompt = buildPrompt(profile, offerings);

    const completion = await client.chat.completions.create(
      {
        model: LLM_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Ты — помощник по подбору корпоративных льгот. " +
              "Отвечай строго в JSON. Используй только id из списка, который дал пользователь.",
          },
          { role: "user", content: prompt },
        ],
      },
      { timeout: LLM_TIMEOUT_MS },
    );

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseLLMResponse(raw, offerings);
    if (parsed.length === 0) {
      logger.warn("LLM returned no valid recommendations", "recommendations.llm");
      return getPopularFallback(offerings);
    }
    return { items: parsed, source: "llm" };
  } catch (err) {
    logger.error("OpenAI call failed", "recommendations.llm", {
      error: err instanceof Error ? err.message : String(err),
    });
    return getPopularFallback(offerings);
  }
}

function buildPrompt(profile: ProfileSnapshot, offerings: OfferingRow[]): string {
  const age = profile.birthday ? computeAge(profile.birthday) : null;
  const childAges = profile.children
    .map((c) => (c.birthday ? computeAge(c.birthday) : null))
    .filter((a): a is number => a !== null);

  const profileLines: string[] = [];
  if (age !== null) profileLines.push(`Возраст: ${age}`);
  if (profile.gender) profileLines.push(`Пол: ${renderGender(profile.gender)}`);
  if (profile.marital_status)
    profileLines.push(`Семейное положение: ${renderMarital(profile.marital_status)}`);
  if (profile.has_children) {
    profileLines.push(
      childAges.length > 0
        ? `Дети: ${childAges.length} (возраст: ${childAges.join(", ")})`
        : `Дети: есть`,
    );
  } else {
    profileLines.push("Детей нет");
  }
  if (profile.work_format)
    profileLines.push(`Формат работы: ${renderWorkFormat(profile.work_format)}`);
  if (profile.has_pets)
    profileLines.push(`Домашние животные: ${profile.has_pets === "yes" ? "есть" : "нет"}`);
  if (profile.priorities.length > 0)
    profileLines.push(
      `Приоритеты (по убыванию важности): ${profile.priorities.map(renderPriority).join(" → ")}`,
    );

  const offeringLines = offerings.map((o) => {
    const po = o.provider_offerings;
    const cat = po?.global_categories?.name ?? "—";
    const name = po?.name ?? "Без названия";
    const description = truncate(po?.description ?? "", 180);
    return `- id=${o.id} | ${name} | категория: ${cat} | ${description}`;
  });

  return [
    "Профиль сотрудника:",
    ...profileLines,
    "",
    `Доступные льготы (${offerings.length}):`,
    ...offeringLines,
    "",
    `Выбери ${MAX_RECOMMENDATIONS} наиболее подходящих льгот для этого сотрудника. ` +
      `Учитывай возраст, семейное положение, наличие детей и питомцев, формат работы и приоритеты. ` +
      `Для каждой укажи короткую (1 предложение, на русском) причину, почему она подходит именно этому человеку. ` +
      `Используй ТОЛЬКО id из списка выше.`,
    "",
    'Ответь строго в формате JSON: {"recommendations":[{"id":"<uuid>","reason":"<причина>"}]}',
  ].join("\n");
}

function parseLLMResponse(
  raw: string,
  offerings: OfferingRow[],
): RecommendationItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const recs = (parsed as { recommendations?: unknown }).recommendations;
  if (!Array.isArray(recs)) return [];

  const byId = new Map(offerings.map((o) => [o.id, o]));
  const seen = new Set<string>();
  const items: RecommendationItem[] = [];

  for (const r of recs) {
    if (typeof r !== "object" || r === null) continue;
    const id = (r as Record<string, unknown>).id;
    const reason = (r as Record<string, unknown>).reason;
    if (typeof id !== "string" || typeof reason !== "string") continue;
    if (seen.has(id)) continue;
    const offering = byId.get(id);
    if (!offering) continue;
    items.push({ ...offering, reason: reason.trim() });
    seen.add(id);
    if (items.length >= MAX_RECOMMENDATIONS) break;
  }

  return items;
}

// ---------------------------------------------------------------------------
// Popularity fallback
// ---------------------------------------------------------------------------

function getPopularFallback(offerings: OfferingRow[]): RecommendationsResult {
  const sorted = [...offerings].sort((a, b) => {
    const aRating = a.provider_offerings?.avg_rating ?? 0;
    const bRating = b.provider_offerings?.avg_rating ?? 0;
    if (bRating !== aRating) return bRating - aRating;
    const aReviews = a.provider_offerings?.review_count ?? 0;
    const bReviews = b.provider_offerings?.review_count ?? 0;
    return bReviews - aReviews;
  });
  const items: RecommendationItem[] = sorted
    .slice(0, MAX_RECOMMENDATIONS)
    .map((o) => ({ ...o, reason: "Популярно у коллег" }));
  return { items, source: "popular" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeAge(birthday: string): number {
  const d = new Date(birthday);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function renderGender(g: string): string {
  if (g === "male") return "мужской";
  if (g === "female") return "женский";
  return g;
}

function renderMarital(m: string): string {
  if (m === "married") return "в браке";
  if (m === "unmarried") return "не в браке";
  return m;
}

function renderWorkFormat(w: string): string {
  if (w === "on_site") return "офис";
  if (w === "hybrid") return "гибрид";
  if (w === "remote") return "удалёнка";
  return w;
}

function renderPriority(p: string): string {
  const map: Record<string, string> = {
    health: "здоровье",
    family: "семья",
    comfort: "комфорт",
    career: "карьера",
    leisure: "досуг",
  };
  return map[p] ?? p;
}
