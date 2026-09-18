"use client";

import { useEffect, useRef, useState } from "react";
import { InvalidTokenAlert } from "./InvalidTokenAlert";
import { ResetPasswordForm } from "./ResetPasswordForm";

const TOKEN_PREFIX = "#token=";

/**
 * Читает токен из URL-фрагмента и немедленно очищает его из адресной строки.
 */
function readAndClearFragmentToken(): string | null {
  const hash = window.location.hash;
  let token: string | null = null;

  if (hash.startsWith(TOKEN_PREFIX)) {
    try {
      token = decodeURIComponent(hash.slice(TOKEN_PREFIX.length));
    } catch {
      token = null;
    }
  }

  // Убираем фрагмент из адресной строки, чтобы токен не попал
  // в историю браузера при последующих навигациях.
  history.replaceState(null, "", window.location.pathname);

  return token;
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
  const hasReadRef = useRef(false);

  useEffect(() => {
    if (hasReadRef.current) return;
    hasReadRef.current = true;

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
