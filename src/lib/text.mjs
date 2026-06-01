export const stopWords = new Set([
  "что",
  "как",
  "если",
  "это",
  "для",
  "про",
  "при",
  "или",
  "его",
  "она",
  "они",
  "мне",
  "нам",
  "тебе",
  "урок",
  "уроке",
  "занятии",
  "ребенок",
  "ребенка",
  "ребенку",
  "ребенок",
  "ученик",
  "ученика",
  "ученику",
]);

export function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}\s+#.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

export function scoreText(questionTokens, text) {
  const normalized = normalize(text);
  return questionTokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
}

export function pick(row, keys) {
  for (const key of keys) {
    if (row?.[key]) return row[key];
  }
  return "";
}
