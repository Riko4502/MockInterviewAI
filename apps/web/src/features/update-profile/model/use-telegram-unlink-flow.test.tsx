import { SECURITY_UNLINK_ERROR_CODES } from "@packages/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/shared/api";
import {
  TELEGRAM_UNLINK_RESEND_COOLDOWN_S,
  useTelegramUnlinkFlow,
} from "./use-telegram-unlink-flow";

const { requestMutateMock, confirmMutateMock } = vi.hoisted(() => ({
  requestMutateMock: vi.fn(),
  confirmMutateMock: vi.fn(),
}));

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/api")>();
  return {
    ...actual,
    useProfileControllerRequestTelegramUnlink: () => ({
      mutate: requestMutateMock,
      isPending: false,
    }),
    useProfileControllerConfirmTelegramUnlink: () => ({
      mutate: confirmMutateMock,
      isPending: false,
    }),
  };
});

/** Стабильная обёртка с QueryClient — хуки мутаций требуют провайдер. */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

type RequestOptions = {
  onSuccess?: (res: { sent: boolean; expiresAt: string }) => void;
  onError?: (error: unknown) => void;
};

type ConfirmOptions = {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};

/** Переводит флоу в состояние ожидания кода с заданным TTL. */
function startAwaitingCode(
  result: { current: ReturnType<typeof useTelegramUnlinkFlow> },
  ttlMs = 10 * 60 * 1000,
) {
  requestMutateMock.mockImplementation(
    (_args: unknown, options?: RequestOptions) => {
      options?.onSuccess?.({
        sent: true,
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      });
    },
  );

  act(() => {
    result.current.requestCode();
  });
}

describe("useTelegramUnlinkFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("после успешного запроса кода переходит в ожидание с TTL и cooldown", () => {
    const { result } = renderHook(() => useTelegramUnlinkFlow(), {
      wrapper: createWrapper(),
    });

    expect(result.current.step).toBe("idle");

    startAwaitingCode(result);

    expect(result.current.step).toBe("awaitingCode");
    expect(result.current.codeTtlSeconds).toBe(600);
    expect(result.current.resendIn).toBe(TELEGRAM_UNLINK_RESEND_COOLDOWN_S);
    expect(result.current.isCodeExpired).toBe(false);
    expect(result.current.errorKey).toBeNull();
  });

  it("уменьшает TTL и cooldown по мере течения времени", () => {
    const { result } = renderHook(() => useTelegramUnlinkFlow(), {
      wrapper: createWrapper(),
    });

    startAwaitingCode(result);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.codeTtlSeconds).toBe(570);
    expect(result.current.resendIn).toBe(
      TELEGRAM_UNLINK_RESEND_COOLDOWN_S - 30,
    );

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.resendIn).toBe(0);
    expect(result.current.codeTtlSeconds).toBe(540);

    // По истечении TTL код помечается как истёкший.
    act(() => {
      vi.advanceTimersByTime(540_000);
    });

    expect(result.current.codeTtlSeconds).toBe(0);
    expect(result.current.isCodeExpired).toBe(true);
  });

  it("при ошибке запроса возвращает флоу в idle и отдаёт ключ ошибки", () => {
    const { result } = renderHook(() => useTelegramUnlinkFlow(), {
      wrapper: createWrapper(),
    });

    requestMutateMock.mockImplementation(
      (_args: unknown, options?: RequestOptions) => {
        options?.onError?.(new HttpError("Too many requests", 429));
      },
    );

    act(() => {
      result.current.requestCode();
    });

    expect(result.current.step).toBe("idle");
    expect(result.current.errorKey).toBe(
      "profile.telegramUnlinkErrorRateLimited",
    );
  });

  it("на успешный сабмит вызывает onSuccess и сбрасывает шаг", () => {
    const { result } = renderHook(() => useTelegramUnlinkFlow(), {
      wrapper: createWrapper(),
    });

    startAwaitingCode(result);

    const onSuccess = vi.fn();
    confirmMutateMock.mockImplementation(
      (_args: unknown, options?: ConfirmOptions) => {
        options?.onSuccess?.();
      },
    );

    act(() => {
      result.current.submitCode("123456", onSuccess);
    });

    expect(confirmMutateMock).toHaveBeenCalledWith(
      { data: { code: "123456" } },
      expect.anything(),
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.step).toBe("idle");
  });

  it("при INVALID_CODE остаётся в ожидании кода и отдаёт ключ ошибки", () => {
    const { result } = renderHook(() => useTelegramUnlinkFlow(), {
      wrapper: createWrapper(),
    });

    startAwaitingCode(result);

    confirmMutateMock.mockImplementation(
      (_args: unknown, options?: ConfirmOptions) => {
        options?.onError?.(
          new HttpError("invalid", 400, {
            code: SECURITY_UNLINK_ERROR_CODES.INVALID_CODE,
          }),
        );
      },
    );

    act(() => {
      result.current.submitCode("000000");
    });

    expect(result.current.step).toBe("awaitingCode");
    expect(result.current.errorKey).toBe(
      "profile.telegramUnlinkErrorInvalidCode",
    );
    expect(result.current.isCodeExpired).toBe(false);
  });

  it("при CODE_EXPIRED помечает код истёкшим, чтобы требовать новый запрос", () => {
    const { result } = renderHook(() => useTelegramUnlinkFlow(), {
      wrapper: createWrapper(),
    });

    startAwaitingCode(result);

    confirmMutateMock.mockImplementation(
      (_args: unknown, options?: ConfirmOptions) => {
        options?.onError?.(
          new HttpError("expired", 410, {
            code: SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED,
          }),
        );
      },
    );

    act(() => {
      result.current.submitCode("123456");
    });

    expect(result.current.step).toBe("idle");
    expect(result.current.errorKey).toBe("profile.telegramUnlinkErrorExpired");
    expect(result.current.isCodeExpired).toBe(true);
  });

  it("при CODE_EXPIRED продолжает отсчёт cooldown, чтобы повторная отправка разблокировалась", () => {
    const { result } = renderHook(() => useTelegramUnlinkFlow(), {
      wrapper: createWrapper(),
    });

    startAwaitingCode(result);

    // Код инвалидируется сразу после запроса, когда cooldown ещё активен.
    confirmMutateMock.mockImplementation(
      (_args: unknown, options?: ConfirmOptions) => {
        options?.onError?.(
          new HttpError("expired", 410, {
            code: SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED,
          }),
        );
      },
    );

    act(() => {
      result.current.submitCode("123456");
    });

    expect(result.current.isCodeExpired).toBe(true);
    expect(result.current.resendIn).toBe(TELEGRAM_UNLINK_RESEND_COOLDOWN_S);

    act(() => {
      vi.advanceTimersByTime(TELEGRAM_UNLINK_RESEND_COOLDOWN_S * 1000);
    });

    expect(result.current.resendIn).toBe(0);
  });

  it("reset очищает состояние флоу", () => {
    const { result } = renderHook(() => useTelegramUnlinkFlow(), {
      wrapper: createWrapper(),
    });

    startAwaitingCode(result);

    act(() => {
      result.current.reset();
    });

    expect(result.current.step).toBe("idle");
    expect(result.current.codeTtlSeconds).toBeNull();
    expect(result.current.resendIn).toBe(0);
    expect(result.current.errorKey).toBeNull();
  });

  it("считает флоу занятым от момента запроса кода до его завершения", () => {
    const { result } = renderHook(() => useTelegramUnlinkFlow(), {
      wrapper: createWrapper(),
    });

    // Запрос не завершается: ни onSuccess, ни onError не вызываются.
    requestMutateMock.mockImplementation(() => undefined);

    act(() => {
      result.current.requestCode();
    });

    expect(result.current.step).toBe("requestingCode");
    expect(result.current.isBusy).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.isBusy).toBe(false);
  });
});
