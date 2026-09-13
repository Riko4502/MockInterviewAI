import type { InputHTMLAttributes, ReactNode } from "react";

export type TagInputSize = "sm" | "md" | "lg";
export type TagVariant = "default" | "secondary" | "outline" | "tag";

export interface TagInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "defaultValue" | "size" | "prefix"
  > {
  /**
   * Массив выбранных тегов (для контролируемого режима).
   */
  value?: string[];
  /**
   * Начальные теги для неконтролируемого режима.
   */
  defaultValue?: string[];
  /**
   * Функция обратного вызова при изменении списка тегов.
   */
  onChange?: (tags: string[]) => void;
  /**
   * Функция обратного вызова при добавлении конкретного тега.
   */
  onTagAdd?: (tag: string) => void;
  /**
   * Функция обратного вызова при удалении конкретного тега.
   */
  onTagRemove?: (tag: string, index: number) => void;
  /**
   * Функция обратного вызова при нажатии кнопки очистки всех тегов.
   */
  onClear?: () => void;
  /**
   * Максимальное количество допустимых тегов.
   */
  maxTags?: number;
  /**
   * Минимальная длина одного тега (по умолчанию `1`).
   */
  minTagLength?: number;
  /**
   * Максимальная длина одного тега.
   */
  maxTagLength?: number;
  /**
   * Разрешить ли дублирующиеся теги (по умолчанию `false`).
   */
  allowDuplicates?: boolean;
  /**
   * Добавлять ли тег при потере фокуса полем ввода (по умолчанию `true`).
   */
  addOnBlur?: boolean;
  /**
   * Разделять и добавлять ли теги при вставке из буфера обмена (по умолчанию `true`).
   */
  addOnPaste?: boolean;
  /**
   * Массив клавиш/символов-разделителей для добавления тега (по умолчанию `[",", "Enter"]`).
   */
  delimiters?: string[];
  /**
   * Размер компонента (высота и отступы).
   */
  size?: TagInputSize;
  /**
   * Вариант оформления бейджей тегов.
   */
  tagVariant?: TagVariant;
  /**
   * Отображать ли кнопку быстрой очистки всех тегов.
   */
  clearable?: boolean;
  /**
   * Отображать ли индикатор счетчика `кол-во / максимум`.
   */
  showCount?: boolean;
  /**
   * Флаг ошибки валидации (подсвечивает рамку красным).
   */
  invalid?: boolean;
  /**
   * Элемент или иконка в начале поля (префикс).
   */
  prefix?: ReactNode;
  /**
   * Элемент или иконка в конце поля (суффикс).
   */
  suffix?: ReactNode;
  /**
   * Кастомная функция рендера тега.
   */
  renderTag?: (tag: string, index: number, onRemove: () => void) => ReactNode;
}
