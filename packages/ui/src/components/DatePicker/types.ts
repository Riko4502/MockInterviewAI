/**
 * Свойства компонента интерактивного календаря (Calendar).
 */
export interface CalendarProps {
  /**
   * Выбранная дата.
   */
  selected?: Date | null;
  /**
   * Колбэк при выборе даты пользователем.
   */
  onSelect?: (date: Date) => void;
  /**
   * Месяц, открытый по умолчанию.
   */
  defaultMonth?: Date;
  /**
   * Минимально допустимая дата для выбора.
   */
  minDate?: Date;
  /**
   * Максимально допустимая дата для выбора.
   */
  maxDate?: Date;
  /**
   * Функция пользовательской блокировки конкретных дат.
   */
  disabledDate?: (date: Date) => boolean;
  /**
   * Дополнительные CSS-классы контейнера календаря.
   */
  className?: string;
}

/**
 * Свойства выпадающего компонента выбора даты (DatePicker).
 */
export interface DatePickerProps {
  /**
   * Выбранное значение даты.
   */
  value?: Date | null;
  /**
   * Колбэк при изменении выбранной даты.
   */
  onChange?: (date: Date | null) => void;
  /**
   * Текст плейсхолдера, когда дата не выбрана.
   * @default "Выберите дату"
   */
  placeholder?: string;
  /**
   * Заблокировано ли поле выбора.
   * @default false
   */
  disabled?: boolean;
  /**
   * Минимально допустимая дата для выбора.
   */
  minDate?: Date;
  /**
   * Максимально допустимая дата для выбора.
   */
  maxDate?: Date;
  /**
   * Функция пользовательской блокировки конкретных дат.
   */
  disabledDate?: (date: Date) => boolean;
  /**
   * Кастомная функция форматирования даты в строку.
   */
  formatDate?: (date: Date) => string;
  /**
   * Возможность сброса (очистки) даты.
   * @default true
   */
  clearable?: boolean;
  /**
   * Дополнительные CSS-классы обертки.
   */
  className?: string;
  /**
   * Дополнительные CSS-классы триггера (кнопки инпута).
   */
  triggerClassName?: string;
}
