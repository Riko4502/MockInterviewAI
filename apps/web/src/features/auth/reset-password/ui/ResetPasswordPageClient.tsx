"use client";

import { useEffect, useState } from "react";
import { InvalidTokenAlert } from "./InvalidTokenAlert";
import { ResetPasswordForm } from "./ResetPasswordForm";

/**
 * Читает токен из URL-фрагмента (`#token=...`) на клиенте.
 *
 * Fragment никогда не отправляется на сервер, не попадает в серверные логи
 * и не сохраняется прокси-серверами — в отличие от query string.
 */
export function ResetPasswordPageClient() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash; // "#token=..."
    const raw = hash.startsWith("#token=")
      ? decodeURIComponent(hash.slice("#token=".length))
      : null;

    setToken(raw);
    setReady(true);

    // Немедленно очищаем фрагмент из адресной строки, чтобы токен
    // не сохранился в истории браузера при последующих навигациях.
    history.replaceState(null, "", window.location.pathname);
  }, []);

  if (!ready) {
    // Серверный HTML не содержит токена — показываем пустой контейнер
    // до гидратации, чтобы избежать hydration mismatch.
    return null;
  }

  if (!token) {
    return <InvalidTokenAlert />;
  }

  return <ResetPasswordForm token={token} />;
}
