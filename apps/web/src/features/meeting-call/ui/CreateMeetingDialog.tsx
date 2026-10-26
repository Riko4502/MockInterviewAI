"use client";

import { useSessionsControllerCreateMeeting } from "@packages/api";
import { CheckIcon, CopyIcon } from "@packages/icons";
import { Button, Dialog, Input, Label } from "@packages/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { paths } from "@/shared/config";

/** Пропсы модального окна создания быстрой встречи */
export interface CreateMeetingDialogProps {
  /** Открыт ли диалог */
  open: boolean;
  /** Callback изменения состояния открытия */
  onOpenChange: (open: boolean) => void;
}

/**
 * Диалог создания новой быстрой видеовстречи (Instant Call).
 * Вызывает API создания встречи и генерирует готовую инвайт-ссылку.
 */
export function CreateMeetingDialog({
  open,
  onOpenChange,
}: CreateMeetingDialogProps) {
  const router = useRouter();
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const { mutateAsync: createMeeting, isPending: isCreating } =
    useSessionsControllerCreateMeeting();

  const handleCreate = async () => {
    try {
      const result = await createMeeting({
        data: {
          title: "Быстрая встреча",
          isPrivate: false,
        },
      });
      setCreatedSessionId(result.sessionId);
    } catch {
      // Ошибка обрабатывается через транспорт/тост
    }
  };

  const inviteUrl =
    typeof window !== "undefined" && createdSessionId
      ? `${window.location.origin}${paths.meet(createdSessionId)}`
      : "";

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleGoToRoom = () => {
    if (!createdSessionId) return;
    onOpenChange(false);
    router.push(paths.meet(createdSessionId));
  };

  const handleClose = () => {
    setCreatedSessionId(null);
    setIsCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <Dialog.Content className="max-w-md">
        <Dialog.Header>
          <Dialog.Title>
            {createdSessionId
              ? "Встреча создана!"
              : "Создать мгновенную встречу"}
          </Dialog.Title>
          <Dialog.Description>
            {createdSessionId
              ? "Поделитесь ссылкой с участниками. Вход доступен без обязательной регистрации."
              : "Создайте персональную видеокомнату для созвона или код-ревью в один клик."}
          </Dialog.Description>
        </Dialog.Header>

        {!createdSessionId ? (
          <div className="py-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Все участники получат доступ к аудио, видео, показу экрана и
              текстовому чату в реальном времени.
            </p>
            <Button
              className="w-full font-semibold"
              onClick={handleCreate}
              disabled={isCreating}
            >
              {isCreating ? "Создание комнаты..." : "Начать встречу"}
            </Button>
          </div>
        ) : (
          <div className="py-3 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="meetingLink" className="text-xs font-medium">
                Ссылка на встречу
              </Label>
              <div className="flex gap-2">
                <Input
                  id="meetingLink"
                  value={inviteUrl}
                  readOnly
                  className="font-mono text-xs select-all"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  aria-label="Скопировать ссылку"
                  className="shrink-0"
                >
                  {isCopied ? (
                    <CheckIcon size="sm" className="text-emerald-500" />
                  ) : (
                    <CopyIcon size="sm" />
                  )}
                </Button>
              </div>
              {isCopied && (
                <p className="text-[11px] font-medium text-emerald-500">
                  Ссылка скопирована в буфер обмена!
                </p>
              )}
            </div>

            <Dialog.Footer className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose}>
                Закрыть
              </Button>
              <Button onClick={handleGoToRoom}>Перейти в комнату</Button>
            </Dialog.Footer>
          </div>
        )}
      </Dialog.Content>
    </Dialog>
  );
}
