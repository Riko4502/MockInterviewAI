"use client";

import { Toast } from "@components/Toast";
import { CheckIcon } from "@packages/icons";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
} from "react";
import type {
  ToastActionItem,
  ToastController,
  ToastData,
  ToastPushOptions,
  ToastStatus,
} from "./types";

const ToastContext = createContext<ToastController | null>(null);

function StatusIcon({ status }: { status: ToastStatus }) {
  switch (status) {
    case "success":
      return (
        <div className="mt-0.5 shrink-0 rounded-full bg-success/15 p-1 text-success">
          <CheckIcon className="size-3.5" />
        </div>
      );
    case "destructive":
    case "error":
      return (
        <div className="mt-0.5 shrink-0 rounded-full bg-destructive/15 p-1 text-destructive">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
      );
    case "warning":
      return (
        <div className="mt-0.5 shrink-0 rounded-full bg-amber-500/15 p-1 text-amber-500 dark:text-amber-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5"
            aria-hidden="true"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
      );
    case "info":
      return (
        <div className="mt-0.5 shrink-0 rounded-full bg-chart-4/15 p-1 text-chart-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}

function isActionItem(action: unknown): action is ToastActionItem {
  return (
    typeof action === "object" &&
    action !== null &&
    "onClick" in action &&
    "label" in action
  );
}

/**
 * Провайдер очереди всплывающих уведомлений (Toast).
 */
export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const idPrefix = useId();

  const dismiss = useCallback((id?: string) => {
    setToasts((prev) =>
      prev.map((item) =>
        id === undefined || item.id === id ? { ...item, open: false } : item,
      ),
    );
  }, []);

  const allDismiss = useCallback(() => {
    setToasts((prev) => prev.map((item) => ({ ...item, open: false })));
  }, []);

  const push = useCallback(
    ({
      id,
      status = "default",
      title,
      description,
      duration = 5000,
      action,
      onClose,
    }: ToastPushOptions) => {
      const toastId =
        id ??
        `${idPrefix}-toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const newToast: ToastData = {
        id: toastId,
        status,
        title,
        description,
        duration,
        action,
        open: true,
        onClose,
      };

      setToasts((prev) => [...prev.filter((t) => t.id !== toastId), newToast]);
      return toastId;
    },
    [idPrefix],
  );

  const controller = useMemo<ToastController>(
    () => ({
      push,
      dismiss,
      allDismiss,
    }),
    [push, dismiss, allDismiss],
  );

  return (
    <ToastContext.Provider value={controller}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toasts.map((item) => (
          <Toast
            key={item.id}
            status={item.status}
            duration={item.duration}
            open={item.open}
            onOpenChange={(open) => {
              if (!open) {
                item.onClose?.();
                setToasts((prev) => prev.filter((t) => t.id !== item.id));
              }
            }}
          >
            <div className="flex w-full items-start gap-3">
              <StatusIcon status={item.status} />
              <div className="flex flex-1 flex-col gap-1 pr-4">
                <Toast.Title>{item.title}</Toast.Title>
                {item.description && (
                  <Toast.Description>{item.description}</Toast.Description>
                )}
              </div>
              {item.action && (
                <div className="shrink-0 self-center">
                  {isActionItem(item.action) ? (
                    <Toast.Action
                      altText={item.action.altText ?? "Выполнить действие"}
                      onClick={item.action.onClick}
                    >
                      {item.action.label}
                    </Toast.Action>
                  ) : (
                    item.action
                  )}
                </div>
              )}
            </div>
          </Toast>
        ))}
        <Toast.Viewport />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

/**
 * Хук для отображения всплывающих уведомлений (Toast).
 *
 * @example
 * ```tsx
 * const toast = useToast();
 *
 * toast.push({
 *   status: "success",
 *   title: "Успешно сохранено",
 *   description: "Изменения вступили в силу.",
 * });
 * ```
 */
export function useToast(): ToastController {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useToast должен использоваться внутри ToastProvider или UIProvider",
    );
  }
  return ctx;
}
