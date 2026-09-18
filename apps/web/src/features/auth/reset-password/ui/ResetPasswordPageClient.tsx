"use client";

import { useEffect, useState } from "react";
import { InvalidTokenAlert } from "./InvalidTokenAlert";
import { ResetPasswordForm } from "./ResetPasswordForm";

const TOKEN_PREFIX = "#token=";

/**
 * Module-level кэш токена.
 *
 * `undefined` — ещё не читали (SSR или первый рендер до эффекта).
 * `null`      — фрагмент пуст или не содержит token=.
 * `string`    — токен успешно извлечён.
 *
 * Переменная выживает между двойными mount/unmount React StrictMode,
 * поэтому второй запуск useEffect не читает уже очищенный хэш.
 */
let cachedToken: string | null | undefined;

/**
 * Читает токен из URL-фрагмента и немедленно очищает его из адресной строки.
 * Вызывается один раз: повторный вызов возвращает кэш.
 */
function readAndClearFragmentToken(): string | null {
  if (cachedToken !== undefined) return cachedToken;

  const hash = window.location.hash;
  cachedToken = hash.startsWith(TOKEN_PREFIX)
    ? decodeURIComponent(hash.slice(TOKEN_PREFIX.length))
    : null;

  // Убираем фрагмент из адресной строки, чтобы токен не попал
  // в историю браузера при последующих навигациях.
  history.replaceState(null, "", window.location.pathname);

  return cachedToken;
}

/** @internal Сброс кэша для изоляции тестов. Не вызывать в production-коде. */
export function _resetCachedTokenForTests(): void {
  cachedToken = undefined;
}

/**
 * Читает токен из URL-фрагмента (`#token=...`) на клиенте.
 *
 * Fragment никогда не отправляется на сервер, не попадает в серверные логи
 * и не сохраняется прокси-серверами — в отличие от query string (CWE-598).
 */
export function ResetPasswordPageClient() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(readAndClearFragmentToken());
    setReady(true);
  }, []);

  if (!ready) {
    // Ждём гидратации: возвращаем null, чтобы избежать hydration mismatch.
    return null;
  }

  if (!token) {
    return <InvalidTokenAlert />;
  }

  return <ResetPasswordForm token={token} />;
}
