"use client";

import { CameraIcon, MicIcon } from "@packages/icons";
import { Avatar, Button, Card, Input, Label } from "@packages/ui";
import { cn } from "@packages/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { MeetingAudioMeter } from "./MeetingAudioMeter";

/** Параметры входа в комнату из лобби */
export interface MeetingJoinParams {
  guestName?: string;
  password?: string;
  initialMicrophoneEnabled: boolean;
  initialCameraEnabled: boolean;
}

/** Пропсы экрана предстартового лобби */
export interface MeetingPreFlightLobbyProps {
  /** Идентификатор сессии встречи */
  sessionId: string;
  /** Название встречи */
  sessionTitle?: string;
  /** Имя создателя / хоста */
  hostName?: string;
  /** Защищена ли комната паролем */
  isPasswordRequired?: boolean;
  /** Авторизован ли текущий пользователь в системе */
  isAuthenticated?: boolean;
  /** Начальное имя пользователя (если есть профиль) */
  defaultName?: string;
  /** Флаг процесса подключения к встрече */
  isJoining?: boolean;
  /** Текст ошибки входа (например, неверный пароль) */
  error?: string | null;
  /** Callback подтверждения входа */
  onJoin: (params: MeetingJoinParams) => Promise<void> | void;
  /** Дополнительные CSS классы */
  className?: string;
}

/**
 * Экран предстартового лобби встречи (MeetingPreFlightLobby).
 *
 * Позволяет проверить вебкамеру и микрофон, настроить их состояние до входа,
 * ввести отображаемое имя (для гостей) и пароль (для приватных комнат).
 *
 * Внимание: перед вызовом onJoin гарантированно останавливает локальные треки предпросмотра
 * во избежание конфликта устройств (NotReadableError: Device in use).
 */
export function MeetingPreFlightLobby({
  sessionTitle = "Видеовстреча",
  hostName,
  isPasswordRequired = false,
  isAuthenticated = false,
  defaultName = "",
  isJoining = false,
  error = null,
  onJoin,
  className,
}: MeetingPreFlightLobbyProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
  const [guestName, setGuestName] = useState(defaultName);
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Остановка всех медиадорожек предпросмотра
  const stopPreviewTracks = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  // Инициализация захвата камеры и микрофона для превью
  useEffect(() => {
    let isCancelled = false;

    async function initPreview() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        return;
      }
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (isCancelled) {
          for (const track of mediaStream.getTracks()) {
            track.stop();
          }
          return;
        }

        streamRef.current = mediaStream;
        setStream(mediaStream);

        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = mediaStream;
        }
      } catch {
        // Доступ к камере или микрофону отклонен пользователем
      }
    }

    initPreview();

    return () => {
      isCancelled = true;
      stopPreviewTracks();
    };
  }, [stopPreviewTracks]);

  // Переключение камеры на превью
  const handleToggleCamera = () => {
    const nextState = !isCameraEnabled;
    setIsCameraEnabled(nextState);
    if (streamRef.current) {
      for (const track of streamRef.current.getVideoTracks()) {
        track.enabled = nextState;
      }
    }
  };

  // Переключение микрофона на превью
  const handleToggleMicrophone = () => {
    const nextState = !isMicrophoneEnabled;
    setIsMicrophoneEnabled(nextState);
    if (streamRef.current) {
      for (const track of streamRef.current.getAudioTracks()) {
        track.enabled = nextState;
      }
    }
  };

  // Валидация и отправка формы входа
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = guestName.trim();
    if (!isAuthenticated && trimmedName.length < 2) {
      setValidationError("Имя должно содержать минимум 2 символа");
      return;
    }

    if (isPasswordRequired && !password) {
      setValidationError("Введите пароль для входа в эту встречу");
      return;
    }

    // Освобождаем устройства до коннекта к LiveKit
    stopPreviewTracks();

    await onJoin({
      guestName: !isAuthenticated ? trimmedName : undefined,
      password: isPasswordRequired ? password : undefined,
      initialMicrophoneEnabled: isMicrophoneEnabled,
      initialCameraEnabled: isCameraEnabled,
    });
  };

  return (
    <div
      data-slot="meeting-preflight-lobby"
      className={cn(
        "flex min-h-[550px] size-full items-center justify-center p-4 md:p-8",
        className,
      )}
    >
      <Card className="w-full max-w-4xl overflow-hidden border-border/80 shadow-2xl backdrop-blur-md">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          {/* Левая колонка: Превью камеры и микрофона */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center gap-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-card border border-border shadow-inner">
              {/* Превью вебкамеры */}
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                data-slot="lobby-preview-video"
                className={cn(
                  "size-full object-cover -scale-x-100",
                  (!isCameraEnabled || !stream) && "hidden",
                )}
              />

              {/* Заглушка при выключенной камере */}
              {(!isCameraEnabled || !stream) && (
                <div className="flex size-full flex-col items-center justify-center bg-gradient-to-b from-muted/50 via-card to-background p-4">
                  <Avatar
                    size="lg"
                    className="size-20 border-2 border-border shadow-md"
                  >
                    <Avatar.Fallback className="bg-primary/10 text-primary text-xl font-semibold">
                      {guestName.trim()
                        ? guestName.slice(0, 2).toUpperCase()
                        : "👤"}
                    </Avatar.Fallback>
                  </Avatar>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Камера выключена
                  </p>
                </div>
              )}

              {/* Кнопки быстрого включения/выключения на превью */}
              <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3 z-20">
                <Button
                  type="button"
                  size="icon"
                  variant={isMicrophoneEnabled ? "secondary" : "destructive"}
                  onClick={handleToggleMicrophone}
                  aria-label={
                    isMicrophoneEnabled
                      ? "Выключить микрофон"
                      : "Включить микрофон"
                  }
                  className="size-10 rounded-full shadow-lg"
                >
                  <MicIcon size="md" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant={isCameraEnabled ? "secondary" : "destructive"}
                  onClick={handleToggleCamera}
                  aria-label={
                    isCameraEnabled ? "Выключить камеру" : "Включить камеру"
                  }
                  className="size-10 rounded-full shadow-lg"
                >
                  <CameraIcon size="md" />
                </Button>
              </div>
            </div>

            {/* Индикатор микрофона */}
            <div className="w-full px-2">
              <MeetingAudioMeter
                stream={isMicrophoneEnabled ? stream : null}
                className="w-full"
              />
            </div>
          </div>

          {/* Правая колонка: Форма входа */}
          <div className="lg:col-span-5 flex flex-col justify-center space-y-5">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {sessionTitle}
              </h1>
              {hostName && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Организатор встречи:{" "}
                  <strong className="text-foreground">{hostName}</strong>
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Поле имени для гостя */}
              {!isAuthenticated && (
                <div className="space-y-1.5">
                  <Label htmlFor="guestName" className="text-xs font-medium">
                    Ваше имя для входа
                  </Label>
                  <Input
                    id="guestName"
                    value={guestName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setGuestName(e.target.value)
                    }
                    placeholder="Например: Иван Иванов"
                    autoFocus
                    disabled={isJoining}
                    required
                  />
                </div>
              )}

              {/* Поле пароля для защищенной встречи */}
              {isPasswordRequired && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="meetingPassword"
                    className="text-xs font-medium"
                  >
                    Пароль встречи
                  </Label>
                  <Input
                    id="meetingPassword"
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Введите пароль комнаты"
                    disabled={isJoining}
                    required
                  />
                </div>
              )}

              {/* Ошибки валидации или бэкенда */}
              {(validationError || error) && (
                <p className="rounded-lg bg-destructive/10 p-2 text-xs font-medium text-destructive">
                  {validationError || error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full font-semibold"
                size="lg"
                disabled={isJoining}
              >
                {isJoining ? "Подключение..." : "Присоединиться к встрече"}
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}
