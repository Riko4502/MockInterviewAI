import type React from "react";
import type { LoadingScreenProps } from "../LoadingScreen/types";

export interface AppPreloaderProps extends Partial<LoadingScreenProps> {
  children?: React.ReactNode;
  /** Флаг готовности приложения/чанков/сессии. Пока false — лоадер гарантированно не исчезнет */
  isReady?: boolean;
  /** Минимальное время отображения лоадера в миллисекундах (по умолчанию 1200ms) */
  minDuration?: number;
  /** Длительность анимации плавного исчезновения в мс (по умолчанию 500ms) */
  fadeDuration?: number;
  /** Показывать только один раз за сессию браузерной вкладки */
  oncePerSession?: boolean;
  /** Ключ в sessionStorage для режима oncePerSession */
  sessionKey?: string;
  /** Callback после завершения анимации скрытия лоадера */
  onComplete?: () => void;
}
