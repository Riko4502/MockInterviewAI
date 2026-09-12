"use client";

import { Toast } from "@components/Toast";
import { StatusIcon } from "@components/Toast/components/StatusIcon";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ToastActionItem,
  ToastController,
  ToastData,
  ToastPushOptions,
} from "./types";

const ToastContext = createContext<ToastController | null>(null);

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
  const [isHovered, setIsHovered] = useState(false);
  const toastsRef = useRef<ToastData[]>(toasts);
  toastsRef.current = toasts;

  const removeToast = useCallback((predicate: (item: ToastData) => boolean) => {
    const current = toastsRef.current;
    const closing: ToastData[] = [];

    for (const item of current) {
      if (predicate(item)) {
        closing.push(item);
      }
    }

    if (closing.length === 0) {
      return;
    }

    setToasts((prev) => prev.filter((item) => !predicate(item)));

    for (const item of closing) {
      item.onClose?.();
    }
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

  const total = toasts.length;

  return (
    <ToastContext.Provider value={controller}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toasts.map((item, index) => {
          const offset = total - 1 - index;

          let transform = "translate3d(0, 0, 0) scale(1)";
          let opacity = 1;
          const zIndex = 50 - offset;
          let pointerEvents: "auto" | "none" = "auto";

          if (total > 1) {
            if (isHovered) {
              if (offset < 5) {
                transform = `translate3d(0, calc(-${offset} * (100% + 12px)), 0) scale(1)`;
                opacity = 1;
                pointerEvents = "auto";
              } else {
                transform = `translate3d(0, calc(-${offset} * (100% + 12px)), 0) scale(0.85)`;
                opacity = 0;
                pointerEvents = "none";
              }
            } else {
              if (!offset) {
                transform = "translate3d(0, 0px, 0) scale(1)";
                opacity = 1;
                pointerEvents = "auto";
              } else if (offset === 1) {
                transform = "translate3d(0, -14px, 0) scale(0.95)";
                opacity = 0.9;
                pointerEvents = "auto";
              } else if (offset === 2) {
                transform = "translate3d(0, -28px, 0) scale(0.90)";
                opacity = 0.75;
                pointerEvents = "none";
              } else {
                transform = "translate3d(0, -42px, 0) scale(0.85)";
                opacity = 0;
                pointerEvents = "none";
              }
            }
          }

          return (
            <Toast
              key={item.id}
              status={item.status}
              duration={item.duration}
              showCloseButton={item.showCloseButton}
              open={item.open}
              className="absolute bottom-4 right-4 left-4 md:left-auto md:w-[388px] max-w-[calc(100vw-2rem)] origin-bottom"
              style={{
                position: "absolute",
                bottom: "1rem",
                right: "1rem",
                transformOrigin: "bottom center",
                transform,
                opacity,
                zIndex,
                pointerEvents,
                transition:
                  "transform 350ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease, box-shadow 300ms ease",
              }}
              onMouseEnter={() => setIsHovered(true)}
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
          );
        })}
        <Toast.Viewport
          className={isHovered ? "pointer-events-auto" : undefined}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
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
