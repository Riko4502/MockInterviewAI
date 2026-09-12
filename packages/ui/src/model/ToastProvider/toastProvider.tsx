"use client";

import { Toast } from "@components/Toast";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  InfoIcon,
} from "@packages/icons";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
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
          <AlertCircleIcon className="size-3.5" />
        </div>
      );
    case "warning":
      return (
        <div className="mt-0.5 shrink-0 rounded-full bg-amber-500/15 p-1 text-amber-500 dark:text-amber-400">
          <AlertTriangleIcon className="size-3.5" />
        </div>
      );
    case "info":
      return (
        <div className="mt-0.5 shrink-0 rounded-full bg-chart-4/15 p-1 text-chart-4">
          <InfoIcon className="size-3.5" />
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

  const removeToast = useCallback((predicate: (item: ToastData) => boolean) => {
    setToasts((prev) => {
      const remaining: ToastData[] = [];
      const closing: ToastData[] = [];

      for (const item of prev) {
        if (predicate(item)) {
          closing.push(item);
        } else {
          remaining.push(item);
        }
      }

      if (closing.length === 0) {
        return prev;
      }

      for (const item of closing) {
        item.onClose?.();
      }

      return remaining;
    });
  }, []);

  const dismiss = useCallback(
    (id?: string) => {
      removeToast((item) => id === undefined || item.id === id);
    },
    [removeToast],
  );

  const allDismiss = useCallback(() => {
    removeToast(() => true);
  }, [removeToast]);

  const push = useCallback(
    ({
      id,
      status = "default",
      title,
      description,
      duration = 5000,
      showCloseButton = true,
      action,
      onClose,
    }: ToastPushOptions) => {
      const toastId = id ?? crypto.randomUUID();

      const newToast: ToastData = {
        id: toastId,
        status,
        title,
        description,
        duration,
        showCloseButton,
        action,
        open: true,
        onClose,
      };

      setToasts((prev) => [...prev.filter((t) => t.id !== toastId), newToast]);
      return toastId;
    },
    [],
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
            showCloseButton={item.showCloseButton}
            open={item.open}
            onOpenChange={(open) => {
              if (!open) {
                removeToast((t) => t.id === item.id);
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
