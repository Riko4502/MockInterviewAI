/**
 * Результат парсинга поисковой строки витрины (например: "+react -vue middle").
 * Разделяет поисковые токены на обязательные (+), исключаемые (-) и общие термины.
 */
export interface ParsedSearchQuery {
  include: string[]; // Обязательные (+react, +nest)
  exclude: string[]; // Обязательно отсутствующие (-vue, -angular)
  terms: string[]; // Обычные слова (middle, junior)
  raw: string;
}

/** Максимальное суммарное число токенов для защиты от DoS */
const MAX_SEARCH_TOKENS = 10;

// Нужно для поиска
/** Экранирование спецсимволов SQL (%, _, \) */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

// Нужно при создани карточки
/** Очистка строк от потенциально опасных символов HTML (XSS prevention) */
export function stripHtmlTags(input: string): string {
  return input.replace(/[<>]/g, "").trim();
}

// Нужно при создани карточки
/** Нормализация скилла */
export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseSearchQuery(query?: string): ParsedSearchQuery {
  if (!query || typeof query !== "string") {
    return { include: [], exclude: [], terms: [], raw: "" };
  }

  const raw = query.trim().slice(0, 100);
  if (!raw) {
    return { include: [], exclude: [], terms: [], raw: "" };
  }

  const tokens = raw.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TOKENS);
  const include: string[] = [];
  const exclude: string[] = [];
  const terms: string[] = [];

  for (const token of tokens) {
    if (token.startsWith("+") && token.length > 1) {
      include.push(sanitizeSearchTerm(token.slice(1).toLowerCase()));
    } else if (token.startsWith("-") && token.length > 1) {
      exclude.push(sanitizeSearchTerm(token.slice(1).toLowerCase()));
    } else {
      terms.push(sanitizeSearchTerm(token.toLowerCase()));
    }
  }

  return {
    include: Array.from(new Set(include)),
    exclude: Array.from(new Set(exclude)),
    terms: Array.from(new Set(terms)),
    raw,
  };
}
