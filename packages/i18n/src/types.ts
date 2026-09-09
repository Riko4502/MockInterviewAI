import type auth from "./locales/ru/auth.json";
import type common from "./locales/ru/common.json";
import type interview from "./locales/ru/interview.json";
import type landing from "./locales/ru/landing.json";

/**
 * Типы словарей активных пространств имен
 */
export type CommonMessages = typeof common;
export type LandingMessages = typeof landing;
export type AuthMessages = typeof auth;
export type InterviewMessages = typeof interview;

/**
 * Зарезервированные типы для будущих разделов (FR-014)
 * Сами разделы (блог, дорожная карта, база знаний) в рамках Feature 010 не реализуются,
 * но их namespaces зарезервированы в системе типов для масштабируемости.
 */
export type BlogMessages = Record<string, unknown>;
export type RoadmapMessages = Record<string, unknown>;
export type KnowledgeMessages = Record<string, unknown>;

/**
 * Доменные пространства имен (Translation Namespaces) согласно FR-014 и data-model.md
 */
export const translationNamespaces = [
  "landing",
  "common",
  "blog",
  "roadmap",
  "knowledge",
] as const;

export type TranslationNamespace = (typeof translationNamespaces)[number];

export const namespaces = translationNamespaces;

/**
 * Структура словарей сообщений
 */
export interface Messages {
  common: CommonMessages;
  landing: LandingMessages;
  auth: AuthMessages;
  interview: InterviewMessages;
  blog?: BlogMessages;
  roadmap?: RoadmapMessages;
  knowledge?: KnowledgeMessages;
}

export type MessageNamespace = keyof Messages;
