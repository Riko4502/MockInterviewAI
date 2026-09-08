import type { editor } from "monaco-editor";
import type { LanguageId } from "@/languages/config";

/**
 * Позиция курсора и выделения текста.
 * Поля названы (line, column) для прямого совпадения с realtime-протоколом проекта.
 */
export interface CursorPosition {
  /** Номер строки (от 1) */
  line: number;
  /** Номер столбца (от 1) */
  column: number;
  /** Строка конца выделения (если есть) */
  selectionEndLine?: number;
  /** Столбец конца выделения (если есть) */
  selectionEndColumn?: number;
}

/**
 * Участник комнаты для отображения его курсора
 */
export interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: CursorPosition;
}

/**
 * Пропсы главного компонента редактора
 */
export interface CodeEditorProps {
  /** Текст кода в редакторе (управляемое состояние) */
  value: string;
  /** Коллбэк при изменении текста пользователем */
  onChange?: (value: string) => void;
  /** Язык программирования */
  language?: LanguageId | string;
  /** Тема оформления ('mockinterview-dark' по умолчанию) */
  theme?: string;
  /** Режим только для чтения */
  readOnly?: boolean;
  /**
   * Массив других участников для отображения их курсоров.
   */
  collaborators?: Collaborator[];
  /**
   * Коллбэк при перемещении курсора нашим пользователем.
   * Срабатывает с ограничением частоты (throttle).
   */
  onCursorChange?: (position: CursorPosition) => void;
  /**
   * Интервал троттлинга курсора в миллисекундах (Вариант С).
   * По умолчанию 50ms.
   */
  cursorThrottleMs?: number;
  /** Дополнительные опции Monaco Editor */
  options?: editor.IStandaloneEditorConstructionOptions;
}
