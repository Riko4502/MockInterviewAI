"use client";

import { useSessionsControllerCreateMeeting } from "@packages/api";
import { CheckIcon, CopyIcon } from "@packages/icons";
import { Button, Dialog, Input, Label, Switch } from "@packages/ui";
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
  const [title, setTitle] = useState("Быстрая встреча");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isPasswordCopied, setIsPasswordCopied] = useState(false);

  const { mutateAsync: createMeeting, isPending: isCreating } =
    useSessionsControllerCreateMeeting();

  const handleCreate = async () => {
    if (isPrivate && password.trim().length < 4) {
      setPasswordError("Пароль должен содержать не менее 4 символов");
      return;
    }
    setPasswordError(null);

    try {
      const result = await createMeeting({
        data: {
          title: title.trim() || "Быстрая встреча",
          isPrivate,
          password: isPrivate && password.trim() ? password.trim() : undefined,
        },
      });
      setCreatedSessionId(result.sessionId);
      setCreatedPassword(isPrivate && password.trim() ? password.trim() : null);
    } catch {
      // Ошибка обрабатывается через тост
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

  const handleCopyPassword = async () => {
    if (!createdPassword) return;
    try {
      await navigator.clipboard.writeText(createdPassword);
      setIsPasswordCopied(true);
      setTimeout(() => setIsPasswordCopied(false), 2000);
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
    setCreatedPassword(null);
    setIsCopied(false);
    setIsPasswordCopied(false);
    setTitle("Быстрая встреча");
    setIsPrivate(false);
    setPassword("");
    setPasswordError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <Dialog.Content className="max-w-md w-[calc(100vw-2rem)] overflow-hidden">
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
          <div className="py-3 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="meetingTitle" className="text-xs font-medium">
                Название встречи
              </Label>
              <Input
                id="meetingTitle"
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTitle(e.target.value)
                }
                placeholder="Например, Архитектурный синк"
                maxLength={120}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label
                  htmlFor="meetingIsPrivate"
                  className="text-xs font-medium cursor-pointer"
                >
                  Защитить паролем
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Участники должны будут ввести пароль перед входом
                </p>
              </div>
              <Switch
                id="meetingIsPrivate"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>

            {isPrivate && (
              <div className="space-y-1.5 animate-in fade-in-50 duration-200">
                <Label
                  htmlFor="meetingPassword"
                  className="text-xs font-medium"
                >
                  Пароль комнаты
                </Label>
                <Input
                  id="meetingPassword"
                  type="password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="Минимум 4 символа"
                  maxLength={64}
                />
                {passwordError && (
                  <p className="text-xs text-destructive">{passwordError}</p>
                )}
              </div>
            )}

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

            {createdPassword && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="createdPassword"
                  className="text-xs font-medium"
                >
                  Пароль для входа
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="createdPassword"
                    value={createdPassword}
                    readOnly
                    className="font-mono text-xs select-all"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyPassword}
                    aria-label="Скопировать пароль"
                    className="shrink-0"
                  >
                    {isPasswordCopied ? (
                      <CheckIcon size="sm" className="text-emerald-500" />
                    ) : (
                      <CopyIcon size="sm" />
                    )}
                  </Button>
                </div>
                {isPasswordCopied && (
                  <p className="text-[11px] font-medium text-emerald-500">
                    Пароль скопирован!
                  </p>
                )}
              </div>
            )}

            <Dialog.Footer className="gap-2 sm:gap-0 mt-3 flex justify-end">
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
