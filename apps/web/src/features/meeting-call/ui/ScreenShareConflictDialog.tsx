"use client";

import { Button, Dialog } from "@packages/ui";

/** Пропсы диалога подтверждения перехвата демонстрации экрана */
export interface ScreenShareConflictDialogProps {
  /** Открыт ли диалог */
  open: boolean;
  /** Имя участника, который сейчас демонстрирует экран */
  activeSharerName: string;
  /** Callback подтверждения перехвата */
  onConfirm: () => void;
  /** Callback отмены */
  onCancel: () => void;
}

/**
 * Диалог разрешения конфликта демонстрации экрана.
 * Предупреждает пользователя, что другой участник уже ведет показ,
 * и запрашивает подтверждение на принудительное переключение.
 */
export function ScreenShareConflictDialog({
  open,
  activeSharerName,
  onConfirm,
  onCancel,
}: ScreenShareConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Dialog.Content className="max-w-md">
        <Dialog.Header>
          <Dialog.Title>Перехват демонстрации экрана</Dialog.Title>
          <Dialog.Description>
            Участник{" "}
            <strong className="text-foreground">{activeSharerName}</strong> уже
            демонстрирует свой экран. В созвоне может быть активна только одна
            трансляция.
          </Dialog.Description>
        </Dialog.Header>

        <p className="text-sm text-muted-foreground mt-2">
          Вы уверены, что хотите прервать текущую демонстрацию и начать свою?
        </p>

        <Dialog.Footer className="mt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Прервать и показать свой
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
