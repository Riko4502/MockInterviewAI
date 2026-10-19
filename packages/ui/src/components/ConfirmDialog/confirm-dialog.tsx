"use client";

import { Button, type ButtonProps } from "@components/Button";
import { Dialog } from "@components/Dialog";
import { Spin } from "@components/Spin";
import { type ReactNode, useState } from "react";

export interface ConfirmDialogProps {
  /** Управляемое состояние открытия. */
  open: boolean;
  /** Колбэк смены состояния. Пока идёт подтверждение — игнорируется. */
  onOpenChange: (open: boolean) => void;
  /** Заголовок диалога. */
  title: ReactNode;
  /** Пояснение последствий действия. */
  description?: ReactNode;
  /** Текст кнопки подтверждения. */
  confirmLabel: ReactNode;
  /** Текст кнопки отмены. `actions.cancel` задаётся вызывающей стороной. */
  cancelLabel: ReactNode;
  /** Вариант кнопки подтверждения. Для деструктивных действий — `destructive`. */
  confirmVariant?: ButtonProps["variant"];
  /**
   * Внешний признак выполнения действия (например, `mutation.isPending`).
   * Пока `true`, диалог нельзя закрыть, кнопки дизейблятся.
   */
  isPending?: boolean;
  /** Обработчик подтверждения. Может быть асинхронным. */
  onConfirm: () => void | Promise<void>;
  /** Дополнительное содержимое между описанием и футером. */
  children?: ReactNode;
  /** Класс для `Dialog.Content`. */
  className?: string;
}

/**
 * Общий подтверждающий диалог (ADR-005).
 *
 * Показывает предупреждение и вызывает `onConfirm` только после явного
 * подтверждения. Пока действие выполняется (`isPending` или асинхронный
 * `onConfirm`), диалог заблокирован: нельзя закрыть по `Esc`/оверлею/крестику,
 * кнопки дизейблятся. Вызывающая сторона закрывает диалог сама в `onSuccess`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = "destructive",
  isPending = false,
  onConfirm,
  children,
  className,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const isBusy = isPending || isConfirming;

  const handleConfirm = () => {
    const result = onConfirm();

    if (result && typeof (result as Promise<void>).then === "function") {
      setIsConfirming(true);
      void Promise.resolve(result).finally(() => setIsConfirming(false));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isBusy) onOpenChange(next);
      }}
    >
      <Dialog.Content className={className}>
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
          {description ? (
            <Dialog.Description>{description}</Dialog.Description>
          ) : null}
        </Dialog.Header>

        {children}

        <Dialog.Footer>
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={isBusy}
            aria-busy={isBusy}
            onClick={handleConfirm}
          >
            {isBusy ? (
              <Spin size="sm" variant="current" aria-hidden="true" />
            ) : null}
            {confirmLabel}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
