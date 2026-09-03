import type auth from "./locales/ru/auth.json";
import type common from "./locales/ru/common.json";
import type interview from "./locales/ru/interview.json";
import type landing from "./locales/ru/landing.json";

export interface Messages {
  common: typeof common;
  auth: typeof auth;
  interview: typeof interview;
  landing: typeof landing;
}

export type MessageNamespace = keyof Messages;
