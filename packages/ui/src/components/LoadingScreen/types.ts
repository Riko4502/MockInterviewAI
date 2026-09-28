import type React from "react";

export interface LoadingScreenProps {
  /** Главный заголовок экрана загрузки (по умолчанию 'MockInterview AI') */
  title?: React.ReactNode;
  /** Подзаголовок или описание текущего действия */
  description?: React.ReactNode;
  /** Список этапов загрузки для визуального отображения процесса */
  steps?: string[];
  /** Текст статус-бейджа (например, 'ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ') */
  badgeText?: React.ReactNode;
  /** Показывать ли динамический фоновый градиент и сетку */
  showBackground?: boolean;
  /** Показывать ли анимированный логотип бренда */
  showLogo?: boolean;
  /** Отображать ли прогресс-бар */
  showProgress?: boolean;
  /** Режим отображения: полноэкранный ("fullscreen") или внутри контейнера ("contained") */
  variant?: "fullscreen" | "contained";
  /** Дополнительные CSS классы для внешнего контейнера */
  className?: string;
  /** Текст активного статуса в футере карточки */
  systemActiveText?: React.ReactNode;
  /** Текст бренда в футере карточки */
  brandLabel?: React.ReactNode;
  /** data-testid для интеграционного тестирования */
  "data-testid"?: string;
}
