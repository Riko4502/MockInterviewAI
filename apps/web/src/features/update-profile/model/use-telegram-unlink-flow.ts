"use client";

import {
  useProfileControllerConfirmTelegramUnlink,
  useProfileControllerRequestTelegramUnlink,
} from "@packages/api";
import { useCallback, useEffect, useState } from "react";
import { getUnlinkErrorKey, isCodeInvalidatingError } from "./unlink-error";

/** Пауза между запросами кода — повтор серверного rate limit 1/60 с (D5). */
export const TELEGRAM_UNLINK_RESEND_COOLDOWN_S = 60;

/** Запасной TTL кода, если ответ сервера не дал корректного `expiresAt` (D5). */
const CODE_TTL_FALLBACK_MS = 10 * 60 * 1000;

/**
 * Маркер «код уже недействителен» (TTL истёк или исчерпан лимит попыток).
 *
 * Хранится вместо `null`, чтобы код оставался в состоянии «сессия кода активна»:
 * обратный отсчёт cooldown повторной отправки должен продолжаться, иначе кнопка
 * «Отправить код повторно» осталась бы заблокированной навсегда.
 */
const CODE_EXPIRED_AT = 0;

/** Период обновления обратного отсчёта. */
const TICK_MS = 1000;

/**
 * Шаги флоу отвязки Telegram (F3): `request` → `awaitingCode` → `confirm`.
 *
 * `submittingCode` неявно возникает на время проверки кода; после успеха шаг
 * сбрасывается в `idle` — дальше ревокация сессий и редирект решает вызывающая
 * сторона, компонент на этом шаге уже не нужен.
 */
export type TelegramUnlinkStep =
  | "idle"
  | "requestingCode"
  | "awaitingCode"
  | "submittingCode";

/** Публичное состояние флоу отвязки Telegram. */
export interface TelegramUnlinkFlow {
  /** Текущий шаг флоу. */
  step: TelegramUnlinkStep;
  /** true, пока идёт сетевой запрос (запрос кода или проверка). */
  isBusy: boolean;
  /** Осталось секунд до истечения действия кода (null, если кода нет). */
  codeTtlSeconds: number | null;
  /** true, если введённый код истёк — нужен новый запрос. */
  isCodeExpired: boolean;
  /** Сколько секунд осталось ждать повторную отправку кода (0 — можно). */
  resendIn: number;
  /** i18n-ключ последней ошибки либо null. */
  errorKey: string | null;
  /** Запрашивает одноразовый код отвязки (D5). */
  requestCode: () => void;
  /** Подтверждает отвязку кодом и вызывает `onSuccess` на успехе (F3). */
  submitCode: (code: string, onSuccess?: () => void) => void;
  /** Полностью сбрасывает флоу (закрытие диалога). */
  reset: () => void;
}

/**
 * UI-флоу подтверждаемой отвязки Telegram одноразовым кодом (ADR-005, F3).
 *
 * Хранит состояние шагов, обратные отсчёты TTL кода и cooldown повторной
 * отправки, мапит коды ошибок сервера на i18n-ключи (F7). Сама ревокация
 * сессий выполняется на сервере — фронт её не эмулирует (F4).
 */
export function useTelegramUnlinkFlow(): TelegramUnlinkFlow {
  const requestMutation = useProfileControllerRequestTelegramUnlink();
  const confirmMutation = useProfileControllerConfirmTelegramUnlink();

  const [step, setStep] = useState<TelegramUnlinkStep>("idle");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [resendAllowedAt, setResendAllowedAt] = useState<number | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Отсчёт идёт, пока активна сессия кода (запрошен и не сброшен/не подтверждён).
    if (expiresAt === null) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [expiresAt]);

  const requestCode = useCallback(() => {
    setErrorKey(null);
    setStep("requestingCode");

    requestMutation.mutate(undefined, {
      onSuccess: (response) => {
        const at = Date.now();
        const parsed = Date.parse(response.expiresAt);
        setExpiresAt(Number.isNaN(parsed) ? at + CODE_TTL_FALLBACK_MS : parsed);
        setResendAllowedAt(at + TELEGRAM_UNLINK_RESEND_COOLDOWN_S * 1000);
        setNow(at);
        setStep("awaitingCode");
      },
      onError: (error) => {
        setErrorKey(getUnlinkErrorKey(error, "telegram"));
        setStep("idle");
      },
    });
  }, [requestMutation]);

  const submitCode = useCallback(
    (code: string, onSuccess?: () => void) => {
      setErrorKey(null);
      setStep("submittingCode");

      confirmMutation.mutate(
        { data: { code } },
        {
          onSuccess: () => {
            setStep("idle");
            onSuccess?.();
          },
          onError: (error) => {
            setErrorKey(getUnlinkErrorKey(error, "telegram"));
            if (isCodeInvalidatingError(error)) {
              // Сервер инвалидировал запись кода (TTL/лимит попыток) — нужен
              // новый запрос; помечаем код истёкшим, чтобы сабмит был недоступен.
              setExpiresAt(CODE_EXPIRED_AT);
              setStep("idle");
              return;
            }
            setStep("awaitingCode");
          },
        },
      );
    },
    [confirmMutation],
  );

  const reset = useCallback(() => {
    setStep("idle");
    setExpiresAt(null);
    setResendAllowedAt(null);
    setErrorKey(null);
  }, []);

  const codeTtlSeconds =
    expiresAt === null
      ? null
      : Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendIn =
    resendAllowedAt === null
      ? 0
      : Math.max(0, Math.ceil((resendAllowedAt - now) / 1000));

  return {
    step,
    isBusy: step === "requestingCode" || step === "submittingCode",
    codeTtlSeconds,
    isCodeExpired: codeTtlSeconds === 0,
    resendIn,
    errorKey,
    requestCode,
    submitCode,
    reset,
  };
}
