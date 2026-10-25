import type { TrackPublication } from "livekit-client";

/** Роль участника встречи */
export type MeetingRole = "HOST" | "PARTICIPANT";

/** Состояние участника видеовстречи для интерфейса сетки и контролов */
export interface MeetingParticipantState {
  /** Уникальный ID участника в комнате LiveKit */
  id: string;
  /** Идентификатор участника (UUID пользователя или guest_<uuid>) */
  identity: string;
  /** Отображаемое имя */
  name: string;
  /** Является ли участник локальным пользователем (текущий браузер) */
  isLocal: boolean;
  /** Роль участника (HOST или PARTICIPANT) */
  role: MeetingRole;
  /** Говорит ли участник в данный момент (активный спикер) */
  isSpeaking: boolean;
  /** Включен ли микрофон */
  isMicrophoneEnabled: boolean;
  /** Включена ли вебкамера */
  isCameraEnabled: boolean;
  /** Демонстрирует ли экран */
  isScreenSharing: boolean;
  /** Поднята ли рука */
  isHandRaised: boolean;
  /** Публикация видеотрека вебкамеры (если включена) */
  videoTrack: TrackPublication | null;
  /** Публикация аудиотрека микрофона (если включен) */
  audioTrack: TrackPublication | null;
  /** Публикация видеотрека демонстрации экрана (если активна) */
  screenShareTrack: TrackPublication | null;
}
