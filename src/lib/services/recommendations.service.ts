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
// Max length of a "reason" string shown under each carousel card. Sized so
// that two lines of text-xs italic fit comfortably inside a 280-300px card.
const REASON_MAX_LEN = 55;
// No more than this many recommendations from the same global_category —
// prevents the carousel from collapsing into "5 health benefits".
const MAX_PER_CATEGORY = 2;
// Bump when the prompt or output format changes meaningfully. Mixed into the
// profile_hash so old cached rows stop matching and get regenerated lazily.
const PROMPT_VERSION = "v4";

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
    const [profile, rawOfferings] = await Promise.all([
      loadProfileSnapshot(admin, userId),
      getActiveOfferingsForTenant(admin, tenantId),
    ]);

    // Hard filter: remote workers should never see office-only benefits in
    // any path (LLM input, popular fallback, diversity filler). This is the
    // belt to the prompt's suspenders — even if the LLM ignores instructions,
    // an "обеды в офис" type benefit physically cannot reach the carousel.
    const offerings = filterOfferingsForProfile(rawOfferings, profile);

    if (offerings.length === 0) {
      return { items: [], source: "popular" };
    }

    const profileHash = hashProfile(profile);
    const catalogHash = hashCatalog(offerings);

    // We only consider a cache hit when it was produced by the LLM.
    // Popular fallbacks are recomputed in-memory (cheap) so a transient
    // problem (missing key, LLM error, half-filled profile) never gets
    // pinned in the cache and survives across config changes.
    const cached = await readCache(admin, userId);
    if (
      cached &&
      cached.source === "llm" &&
      cached.profile_hash === profileHash &&
      cached.catalog_hash === catalogHash
    ) {
      logger.info("Recommendations cache hit", "recommendations", {
        userId,
        source: "llm",
        items: cached.items.length,
      });
      return rehydrate(cached, offerings);
    }

    const generated = isProfileMeaningfullyFilled(profile)
      ? await generateLLMRecommendations(profile, offerings)
      : getPopularFallback(offerings);

    logger.info("Recommendations generated", "recommendations", {
      userId,
      source: generated.source,
      items: generated.items.length,
      profileFilled: isProfileMeaningfullyFilled(profile),
    });

    // Only cache LLM results — they're the expensive part. Popular results
    // are deterministic from the offerings list and cheap to recompute.
    if (generated.source === "llm" && generated.items.length > 0) {
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
  // PROMPT_VERSION prefix invalidates the cache when the prompt or reason
  // format changes — old rows will never match a new-version hash.
  return PROMPT_VERSION + ":" + createHash("md5").update(stable).digest("hex");
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
      // Truncate on read too — protects against pre-v2 cache rows that
      // still have long reasons until they get organically regenerated.
      items.push({ ...offering, reason: truncateReason(it.reason) });
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
              "Ты — этичный и тактичный HR-помощник по подбору корпоративных льгот. " +
              "Пиши уважительно и нейтрально. Описывай для каких СИТУАЦИЙ нужна льгота, " +
              "а не какие особенности у пользователя. " +
              "НИКОГДА не упоминай возраст, пол, состояние здоровья, семейное положение, " +
              "зарплату или статус сотрудника в тексте — это можно ИСПОЛЬЗОВАТЬ для выбора, " +
              "но НЕ называть прямо. " +
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
    // Bumped from 160 → 280 chars: gives the LLM enough context to spot
    // location/format mismatches (e.g. "обеды в офис на 22 рабочих дня").
    const description = truncate(po?.description ?? "", 280);
    const rating = po?.avg_rating ?? 0;
    const reviewCount = po?.review_count ?? 0;
    const ratingLabel =
      rating > 0
        ? ` | рейтинг: ${rating.toFixed(1)} (${reviewCount} отзывов)`
        : " | рейтинг: —";
    const format = po?.format === "offline" ? "офлайн" : "онлайн";
    return `- id=${o.id} | ${name} | категория: ${cat} | формат: ${format}${ratingLabel} | ${description}`;
  });

  const remoteWorker = profile.work_format === "remote";
  const officeWorker = profile.work_format === "on_site";

  return [
    "Профиль сотрудника:",
    ...profileLines,
    "",
    `Доступные льготы (${offerings.length}):`,
    ...offeringLines,
    "",
    `ЗАДАЧА: выбери ${MAX_RECOMMENDATIONS} наиболее подходящих льгот.`,
    "",
    "ПРАВИЛА ВЫБОРА:",
    `- Не больше ${MAX_PER_CATEGORY} льгот из одной категории. Разнообразь подборку.`,
    "- При выборе между похожими по тематике льготами предпочитай ту, у которой выше рейтинг.",
    "- Учитывай возраст, семейное положение, детей, питомцев, формат работы и приоритеты.",
    "- ВНИМАТЕЛЬНО ЧИТАЙ ОПИСАНИЕ: если льгота явно привязана к офису (корпоративные обеды, доставка еды в офис, корпоративный транспорт, парковка у БЦ, ДМС с прикреплением к одной клинике рядом с работой и т.п.) — НЕ предлагай её удалённому или гибридному сотруднику.",
    remoteWorker
      ? "- ЭТОТ СОТРУДНИК РАБОТАЕТ УДАЛЁННО. Он НЕ ходит в офис. Любые «офисные» льготы (обеды в офис, доставка к офису, корпоративный транспорт) для него БЕСПОЛЕЗНЫ — пропускай их."
      : officeWorker
        ? "- Этот сотрудник работает в офисе. Льготы с доставкой к рабочему месту ему подходят."
        : "- Этот сотрудник работает в гибридном режиме. Чисто офисные льготы стоит избегать или предлагать с оговоркой.",
    "- Используй ТОЛЬКО id из списка выше.",
    "",
    "ПРАВИЛА ДЛЯ ПРИЧИНЫ (reason):",
    `- Максимум ${REASON_MAX_LEN} символов или 7 слов. Это очень важно — длинный текст будет обрезан в UI.`,
    "- Опирайся на КОНКРЕТНЫЙ факт из профиля. Для каждой льготы — РАЗНЫЙ факт, не повторяй один и тот же по 5 раз.",
    "- Причина должна быть осмысленной и СОВПАДАТЬ с содержанием льготы. Если ты обосновываешь льготу удалённой работой — убедись что льгота РЕАЛЬНО подходит удалёнщику.",
    "- НЕ повторяй название льготы — оно видно на карточке.",
    "- НЕ используй слова «дома» или «в доме» без явной необходимости. Они часто звучат неестественно («полезные товары для питомца в доме» — питомец и так живёт дома, это лишнее).",
    "- НЕ используй шаблонные глаголы типа «поможет», «обеспечит», «предоставляет» — это бессмысленный канцелярит.",
    "",
    "ЭТИЧЕСКИЕ ПРАВИЛА (КРИТИЧНО — нарушение испортит впечатление):",
    "- ПИШИ О ЛЬГОТЕ, А НЕ О ЧЕЛОВЕКЕ. Описывай для каких СИТУАЦИЙ льгота, а не какие особенности у пользователя.",
    "- ЗАПРЕЩЕНО упоминать возраст напрямую («учитывая возраст», «в вашем возрасте», «уже пора»). Это звучит покровительственно и эйджистски, даже если пользователь старше или младше среднего.",
    "- ЗАПРЕЩЕНО намекать на проблемы со здоровьем, физические особенности или нужду в чём-либо («раз у вас здоровье...», «важно следить», «вам нужно»).",
    "- ЗАПРЕЩЕНО делать выводы по полу («для женщин особенно полезно», «мужчинам подходит»).",
    "- ЗАПРЕЩЕНО осуждать или акцентировать семейное положение («раз нет детей», «при вашем одиночестве»).",
    "- ЗАПРЕЩЕНО упоминать зарплату, грейд, должность, статус.",
    "- Тон — уважительный и нейтральный, как у профессионального HR.",
    "- Возраст, пол, семейное положение можно ИСПОЛЬЗОВАТЬ для выбора льготы, но НЕ упоминать в тексте причины.",
    "",
    "✅ ХОРОШИЕ примеры:",
    "  • «Подходит для семей с маленькими детьми» — про целевую аудиторию",
    "  • «Удобно при удалённой работе» — про ситуацию",
    "  • «Высокий рейтинг и хорошие отзывы» — про качество",
    "  • «Регулярные обследования — забота о себе» — нейтральная польза",
    "  • «Поддержка при стрессе» — про функцию льготы",
    "",
    "❌ ПЛОХИЕ примеры (НЕ ДЕЛАЙ ТАК):",
    "  • «Учитывая возраст и здоровье, важно следить» — эйджизм + лекторский тон",
    "  • «В вашем возрасте важно...» — упоминание возраста = недопустимо",
    "  • «Для женщин особенно полезно» — гендерный стереотип",
    "  • «ДМС обеспечит медицинские услуги» — пустой канцелярит",
    "  • «Полезные товары для питомца в доме» — где же ещё питомец",
    "  • «Поддержка психического здоровья важна дома» — «дома» тут не к месту",
    "  • Указывать «при удалённой работе» для офисных льгот — противоречие",
    "",
    'Ответь строго в JSON: {"recommendations":[{"id":"<uuid>","reason":"<короткая причина>"}]}',
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
  // Collect everything the LLM returned (in its preferred order) without
  // capping length yet — enforceDiversity below applies the per-category
  // limit and then we slice to MAX_RECOMMENDATIONS.
  const raw_items: RecommendationItem[] = [];

  for (const r of recs) {
    if (typeof r !== "object" || r === null) continue;
    const id = (r as Record<string, unknown>).id;
    const reason = (r as Record<string, unknown>).reason;
    if (typeof id !== "string" || typeof reason !== "string") continue;
    if (seen.has(id)) continue;
    const offering = byId.get(id);
    if (!offering) continue;
    raw_items.push({ ...offering, reason: truncateReason(reason) });
    seen.add(id);
  }

  return enforceDiversity(raw_items, offerings, "LLM");
}

// ---------------------------------------------------------------------------
// Popularity fallback
// ---------------------------------------------------------------------------

function getPopularFallback(offerings: OfferingRow[]): RecommendationsResult {
  const sorted = sortByRating(offerings);
  const seeded: RecommendationItem[] = sorted.map((o) => ({
    ...o,
    reason: "Популярно у коллег",
  }));
  // Apply diversity so popular doesn't collapse into "5 health items" either.
  const items = enforceDiversity(seeded, offerings, "popular");
  return { items, source: "popular" };
}

function sortByRating(offerings: OfferingRow[]): OfferingRow[] {
  return [...offerings].sort((a, b) => {
    const aRating = a.provider_offerings?.avg_rating ?? 0;
    const bRating = b.provider_offerings?.avg_rating ?? 0;
    if (bRating !== aRating) return bRating - aRating;
    const aReviews = a.provider_offerings?.review_count ?? 0;
    const bReviews = b.provider_offerings?.review_count ?? 0;
    return bReviews - aReviews;
  });
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

// Trim a reason string to REASON_MAX_LEN, breaking on a word boundary when
// possible so we don't slice mid-word. Single source of truth for "what fits
// in the carousel card" — used by both fresh generation and cache rehydrate.
function truncateReason(reason: string): string {
  const cleaned = reason.trim().replace(/\s+/g, " ");
  if (cleaned.length <= REASON_MAX_LEN) return cleaned;
  const cut = cleaned.slice(0, REASON_MAX_LEN);
  const lastSpace = cut.lastIndexOf(" ");
  // Only break at a word boundary if it's reasonably close to the end —
  // otherwise we'd lose too much content.
  const breakPoint = lastSpace > REASON_MAX_LEN * 0.6 ? lastSpace : REASON_MAX_LEN - 1;
  return cleaned.slice(0, breakPoint).trimEnd() + "…";
}

function categoryKeyOf(o: OfferingRow): string {
  return o.provider_offerings?.global_categories?.name ?? "—";
}

// Heuristic patterns for benefits that physically require being in an office.
// Conservative: only matches the literal "в офис[е]" phrase, not bare "офис"
// (which could appear in unrelated contexts like "офис-менеджер").
const OFFICE_ONLY_PATTERNS: RegExp[] = [
  /\bв\s+офис(е|ах|у)?\b/i, // "доставка в офис", "обеды в офис", "получение в офисе"
  /\bдо\s+офис[аеу]\b/i, // "доставка до офиса"
  /\bв\s+бизнес[\s-]?центр[ае]?\b/i, // "парковка в бизнес-центре"
];

function requiresOfficePresence(o: OfferingRow): boolean {
  const po = o.provider_offerings;
  if (!po) return false;
  const haystack = `${po.name ?? ""} ${po.description ?? ""}`;
  return OFFICE_ONLY_PATTERNS.some((re) => re.test(haystack));
}

// Drops offerings that are physically incompatible with the user's profile.
// Currently only handles work_format=remote — those users get no "в офис"
// benefits. Hybrid users still see them (they go to office sometimes).
function filterOfferingsForProfile(
  offerings: OfferingRow[],
  profile: ProfileSnapshot,
): OfferingRow[] {
  if (profile.work_format !== "remote") return offerings;
  return offerings.filter((o) => !requiresOfficePresence(o));
}

// Take an ordered list of recommendation items and produce a final list of up
// to MAX_RECOMMENDATIONS, applying these rules in order:
//
//   1. Respect MAX_PER_CATEGORY: keep seeded items in order, dropping any
//      whose category is already at its cap. Dropped items go into `overflow`.
//   2. If short of MAX_RECOMMENDATIONS, fill from the full catalog by rating,
//      still respecting the per-category cap. These get a generic reason.
//   3. If STILL short (catalog has too few categories to satisfy the cap):
//      first reinsert overflow LLM items (they have nicer reasons), then
//      drop the cap and fill remaining slots by rating.
function enforceDiversity(
  seeded: RecommendationItem[],
  allOfferings: OfferingRow[],
  context: "LLM" | "popular",
): RecommendationItem[] {
  const result: RecommendationItem[] = [];
  const perCategory = new Map<string, number>();
  const usedIds = new Set<string>();
  const overflow: RecommendationItem[] = [];
  const fillerReason =
    context === "LLM" ? "Высокий рейтинг и хорошие отзывы" : "Популярно у коллег";

  const take = (item: RecommendationItem): void => {
    result.push(item);
    perCategory.set(categoryKeyOf(item), (perCategory.get(categoryKeyOf(item)) ?? 0) + 1);
    usedIds.add(item.id);
  };

  // Pass 1: seeded items, respecting cap.
  for (const item of seeded) {
    if (result.length >= MAX_RECOMMENDATIONS) break;
    const count = perCategory.get(categoryKeyOf(item)) ?? 0;
    if (count >= MAX_PER_CATEGORY) {
      overflow.push(item);
      continue;
    }
    take(item);
  }

  // Pass 2: fill by rating, respecting cap.
  if (result.length < MAX_RECOMMENDATIONS) {
    for (const candidate of sortByRating(allOfferings)) {
      if (result.length >= MAX_RECOMMENDATIONS) break;
      if (usedIds.has(candidate.id)) continue;
      const count = perCategory.get(categoryKeyOf(candidate)) ?? 0;
      if (count >= MAX_PER_CATEGORY) continue;
      take({ ...candidate, reason: fillerReason });
    }
  }

  // Pass 3: drop the cap. Prefer reinserting overflow (nicer reasons) over
  // generic rating-based fillers.
  if (result.length < MAX_RECOMMENDATIONS) {
    for (const item of overflow) {
      if (result.length >= MAX_RECOMMENDATIONS) break;
      take(item);
    }
  }
  if (result.length < MAX_RECOMMENDATIONS) {
    for (const candidate of sortByRating(allOfferings)) {
      if (result.length >= MAX_RECOMMENDATIONS) break;
      if (usedIds.has(candidate.id)) continue;
      take({ ...candidate, reason: fillerReason });
    }
  }

  return result;
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
