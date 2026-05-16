/**
 * Stable color mapping for the 13 global benefit categories.
 *
 * Both the pie chart (CategoryChart) and the stacked area chart
 * (CategoryTrendChart) on the HR dashboard need the same category to render
 * with the same color. Names mirror DEMO_GLOBAL_CATEGORIES in
 * src/lib/demo-data.ts.
 *
 * Hues are spaced ~25° apart; the destructive-red zone (340–20°) is occupied
 * only by softened pink/coral so it never clashes with --destructive.
 */

export const CATEGORY_COLORS: Record<string, string> = {
  "Здоровье": "#2F9E66",
  "Образование": "#2680D9",
  "Спорт": "#E67219",
  "Питание": "#EDB014",
  "Транспорт": "#28A6BF",
  "Развлечения": "#CC4FA3",
  "Финансы": "#2B9788",
  "Красота": "#D9588A",
  "Семья и дети": "#DB7A55",
  "Подписки и сервисы": "#7466C9",
  "Питомцы": "#D98C26",
  "Дом и быт": "#67A140",
  "Путешествия": "#5E73D9",
};

export const CATEGORY_FALLBACK_PALETTE: string[] = Object.values(CATEGORY_COLORS);

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getCategoryColor(name: string, index?: number): string {
  const direct = CATEGORY_COLORS[name];
  if (direct) return direct;

  const palette = CATEGORY_FALLBACK_PALETTE;
  if (name) {
    return palette[hashString(name) % palette.length];
  }
  const i = typeof index === "number" && index >= 0 ? index : 0;
  return palette[i % palette.length];
}
