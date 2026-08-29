import type auth from "./locales/ru/auth.json";
import type common from "./locales/ru/common.json";
import type interview from "./locales/ru/interview.json";

export interface Messages {
  common: typeof common;
  auth: typeof auth;
  interview: typeof interview;
}

export type MessageNamespace = keyof Messages;
