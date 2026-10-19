import type * as React from "react";

/**
 * Вариант выбора для Combobox.
 */
export interface ComboboxOption {
  /** Уникальное значение опции. */
  value: string;
  /** Отображаемая подпись. */
  label: string;
  /** Дополнительные строки, участвующие в поиске (например, IANA-id зоны). */
  keywords?: string[];
  /** Заблокированная опция не выбирается и пропускается клавиатурой. */
  disabled?: boolean;
}

/**
 * Группа опций с заголовком.
 */
export interface ComboboxGroup {
  /** Стабильный ключ группы. */
  key?: string;
  /** Заголовок группы (может быть узлом). */
  label: React.ReactNode;
  options: ComboboxOption[];
}

export interface ComboboxProps {
  /** Текущее выбранное значение (controlled). */
  value?: string;
  onValueChange?: (value: string) => void;
  /**
   * Плоский список опций. Используется, если не передан `groups`.
   * Рендерится одной группой без заголовка.
   */
  options?: readonly ComboboxOption[];
  /** Сгруппированный список опций. Имеет приоритет над `options`. */
  groups?: readonly ComboboxGroup[];
  /** Текст триггера при отсутствии выбранного значения. */
  placeholder?: string;
  /** Плейсхолдер поля поиска. */
  searchPlaceholder?: string;
  /** Текст при пустом результате фильтрации. */
  emptyText?: string;
  disabled?: boolean;
  /** Дополнительный класс корневого контейнера. */
  className?: string;
  /** Дополнительный класс выпадающей панели. */
  contentClassName?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /**
   * Кастомный предикат поиска. По умолчанию ищет подстроку в
   * `label`, `value` и `keywords` без учёта регистра.
   */
  filter?: (option: ComboboxOption, query: string) => boolean;
}
