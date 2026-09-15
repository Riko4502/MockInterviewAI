import type { OTPInput } from "input-otp";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

/**
 * Свойства корневого компонента InputOTP.
 */
export interface InputOTPProps
  extends Omit<
    ComponentProps<typeof OTPInput>,
    "onChange" | "onComplete" | "render"
  > {
  /**
   * Свойство рендера не используется при compound-структуре с children.
   */
  render?: never;

  /**
   * Максимальная длина вводимого OTP-кода (количество слотов/символов).
   * @example 6
   */
  maxLength: number;

  /**
   * Текущее значение кода (для контролируемого компонента).
   */
  value?: string;

  /**
   * Начальное значение кода (для неконтролируемого компонента).
   */
  defaultValue?: string;

  /**
   * Обработчик изменения значения.
   * @param value Новая строка с введенным кодом
   */
  onChange?: (value: string) => void;

  /**
   * Обработчик успешного завершения ввода (когда введены все `maxLength` символов).
   * @param value Полный введенный код
   */
  onComplete?: (value: string) => void;

  /**
   * Отключение поля ввода и запрет редактирования.
   * @default false
   */
  disabled?: boolean;

  /**
   * Режим "только для чтения".
   * @default false
   */
  readOnly?: boolean;

  /**
   * Автоматический фокус на первой ячейке при монтировании.
   * @default false
   */
  autoFocus?: boolean;

  /**
   * Выравнивание текста внутри ячеек.
   * @default "center"
   */
  textAlign?: "left" | "center" | "right";

  /**
   * Регулярное выражение (строка) для фильтрации допустимых символов.
   * @example "^[0-9]+$" (только цифры)
   */
  pattern?: string;

  /**
   * Тип виртуальной клавиатуры на мобильных устройствах.
   * @default "numeric"
   */
  inputMode?:
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search";

  /**
   * Дополнительный CSS-класс для внешнего контейнера-обертки.
   */
  containerClassName?: string;

  /**
   * Функция для трансформации вставляемого из буфера обмена текста (paste).
   * Например, удаление пробелов, дефисов или приведение к верхнему регистру.
   */
  pasteTransformer?: (pasted: string) => string;

  /**
   * Стратегия адаптации под всплывающие окна менеджеров паролей (1Password, Bitwarden и т.д.).
   * @default "increase-width"
   */
  pushPasswordManagerStrategy?: "increase-width" | "none";

  /**
   * Дочерние элементы (группы слотов, ячейки, разделители).
   */
  children?: ReactNode;
}

/**
 * Свойства группы слотов InputOTPGroup.
 */
export interface InputOTPGroupProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Дополнительный CSS-класс контейнера группы.
   */
  className?: string;

  /**
   * Дочерние элементы группы (ячейки InputOTP.Slot).
   */
  children?: ReactNode;
}

/**
 * Свойства отдельного слота (ячейки) InputOTPSlot.
 */
export interface InputOTPSlotProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Индекс слота в последовательности ввода (начиная с 0).
   * Обязательное поле для синхронизации со скрытым полем ввода.
   */
  index: number;

  /**
   * Дополнительный CSS-класс для ячейки.
   */
  className?: string;

  /**
   * Дочерние элементы ячейки (если требуется кастомный рендер).
   */
  children?: ReactNode;
}

/**
 * Свойства разделителя между группами слотов InputOTPSeparator.
 */
export interface InputOTPSeparatorProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Дополнительный CSS-класс для разделителя.
   */
  className?: string;

  /**
   * Кастомный контент разделителя (по умолчанию отображается точка/тире).
   */
  children?: ReactNode;
}
