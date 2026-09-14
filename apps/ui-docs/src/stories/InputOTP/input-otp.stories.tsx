import { Button, InputOTP, Label } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

interface StoryInputOTPProps {
  maxLength?: number;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  textAlign?: "left" | "center" | "right";
  pattern?: string;
  inputMode?:
    | "none"
    | "text"
    | "tel"
    | "url"
    | "email"
    | "numeric"
    | "decimal"
    | "search";
  pushPasswordManagerStrategy?: "increase-width" | "none";
  containerClassName?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
}

/**
 * Метаданные компонента InputOTP для Storybook.
 */
const meta: Meta<StoryInputOTPProps> = {
  title: "Components/InputOTP",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **InputOTP** — ввод одноразовых кодов подтверждения (PIN / OTP)

Составной компонент: **InputOTP** (корень) + **InputOTP.Group** + **InputOTP.Slot** + **InputOTP.Separator**.
Предназначен для ввода одноразовых цифровых кодов из SMS, Email, Telegram и двухфакторной аутентификации (2FA).

---

### **Установка и импорт**
\`\`\`tsx
import { InputOTP } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<InputOTP maxLength={6}>
  <InputOTP.Group>
    <InputOTP.Slot index={0} />
    <InputOTP.Slot index={1} />
    <InputOTP.Slot index={2} />
  </InputOTP.Group>
  <InputOTP.Separator />
  <InputOTP.Group>
    <InputOTP.Slot index={3} />
    <InputOTP.Slot index={4} />
    <InputOTP.Slot index={5} />
  </InputOTP.Group>
</InputOTP>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    maxLength: {
      control: { type: "number", min: 1, max: 12 },
      description: "Максимальная длина кода (количество символов/ячеек).",
      table: {
        type: { summary: "number" },
        defaultValue: { summary: "6" },
      },
    },
    value: {
      control: "text",
      description: "Текущее строковое значение кода (в управляемом режиме).",
      table: {
        type: { summary: "string" },
      },
    },
    defaultValue: {
      control: "text",
      description:
        "Начальное строковое значение кода (в неуправляемом режиме).",
      table: {
        type: { summary: "string" },
      },
    },
    disabled: {
      control: "boolean",
      description: "Отключение ввода кода и блокировка всех взаимодействий.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    readOnly: {
      control: "boolean",
      description: "Режим только для чтения (запрет редактирования).",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    autoFocus: {
      control: "boolean",
      description: "Автоматический фокус на первой ячейке при монтировании.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    textAlign: {
      control: "select",
      options: ["left", "center", "right"],
      description: "Выравнивание текста внутри ячейки.",
      table: {
        type: { summary: '"left" | "center" | "right"' },
        defaultValue: { summary: '"center"' },
      },
    },
    pattern: {
      control: "text",
      description:
        "Регулярное выражение (строка) для фильтрации допустимых символов.",
      table: {
        type: { summary: "string" },
      },
    },
    inputMode: {
      control: "select",
      options: [
        "numeric",
        "text",
        "tel",
        "url",
        "email",
        "decimal",
        "search",
        "none",
      ],
      description: "Тип виртуальной клавиатуры на мобильных устройствах.",
      table: {
        type: {
          summary:
            '"numeric" | "text" | "tel" | "url" | "email" | "decimal" | "search" | "none"',
        },
        defaultValue: { summary: '"numeric"' },
      },
    },
    pushPasswordManagerStrategy: {
      control: "select",
      options: ["increase-width", "none"],
      description:
        "Стратегия взаимодействия со встроенными менеджерами паролей браузера/расширений.",
      table: {
        type: { summary: '"increase-width" | "none"' },
        defaultValue: { summary: '"increase-width"' },
      },
    },
    containerClassName: {
      control: "text",
      description: "Дополнительный CSS-класс для внешнего контейнера-обертки.",
      table: {
        type: { summary: "string" },
      },
    },
    onChange: {
      action: "changed",
      description: "Обработчик изменения значения.",
      table: {
        type: { summary: "(value: string) => void" },
      },
    },
    onComplete: {
      action: "completed",
      description: "Колбэк при полном заполнении всех символов кода.",
      table: {
        type: { summary: "(value: string) => void" },
      },
    },
  },
  args: {
    maxLength: 6,
    disabled: false,
    readOnly: false,
    autoFocus: false,
    textAlign: "center",
    inputMode: "numeric",
    pushPasswordManagerStrategy: "increase-width",
  },
};

export default meta;
type Story = StoryObj<StoryInputOTPProps>;

/**
 * Стандартный 6-значный код подтверждения с разделителем (3 + 3).
 */
export const Default: Story = {
  render: ({
    maxLength = 6,
    disabled,
    readOnly,
    autoFocus,
    textAlign,
    pattern,
    inputMode,
    pushPasswordManagerStrategy,
    containerClassName,
    defaultValue,
    onChange,
    onComplete,
  }) => {
    const mid = Math.ceil(maxLength / 2);

    return (
      <div className="flex flex-col items-center gap-3">
        <Label htmlFor="otp-input-default" className="text-sm font-medium">
          Код подтверждения из письма
        </Label>
        <InputOTP
          id="otp-input-default"
          maxLength={maxLength}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          textAlign={textAlign}
          pattern={pattern}
          inputMode={inputMode}
          pushPasswordManagerStrategy={pushPasswordManagerStrategy}
          containerClassName={containerClassName}
          defaultValue={defaultValue}
          onChange={onChange}
          onComplete={onComplete}
        >
          {maxLength > 3 ? (
            <>
              <InputOTP.Group>
                {Array.from({ length: mid }, (_, i) => (
                  <InputOTP.Slot key={crypto.randomUUID()} index={i} />
                ))}
              </InputOTP.Group>
              <InputOTP.Separator />
              <InputOTP.Group>
                {Array.from({ length: maxLength - mid }, (_, i) => (
                  <InputOTP.Slot key={crypto.randomUUID()} index={mid + i} />
                ))}
              </InputOTP.Group>
            </>
          ) : (
            <InputOTP.Group>
              {Array.from({ length: maxLength }, (_, i) => (
                <InputOTP.Slot key={crypto.randomUUID()} index={i} />
              ))}
            </InputOTP.Group>
          )}
        </InputOTP>
        <p className="text-xs text-muted-foreground">
          Введите {maxLength}-значный код или вставьте его через Ctrl+V
        </p>
      </div>
    );
  },
};

/**
 * 4-значный PIN-код (например, для быстрых подтверждений).
 */
export const FourDigits: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-3">
      <Label htmlFor="otp-four-digits" className="text-sm font-medium">
        Введите 4-значный PIN-код
      </Label>
      <InputOTP id="otp-four-digits" maxLength={4}>
        <InputOTP.Group>
          <InputOTP.Slot index={0} />
          <InputOTP.Slot index={1} />
          <InputOTP.Slot index={2} />
          <InputOTP.Slot index={3} />
        </InputOTP.Group>
      </InputOTP>
    </div>
  ),
};

/**
 * Управляемый режим с обработкой полного ввода (Controlled Component).
 */
export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState("");

    return (
      <div className="flex flex-col items-center gap-4 w-80 p-6 rounded-xl border border-border bg-card shadow-sm text-center">
        <div className="space-y-1">
          <Label
            htmlFor="otp-controlled"
            className="font-semibold text-base block cursor-pointer"
          >
            Подтверждение Email
          </Label>
          <p className="text-xs text-muted-foreground">
            Мы отправили код на почту <strong>user@example.com</strong>
          </p>
        </div>

        <InputOTP
          id="otp-controlled"
          maxLength={6}
          value={value}
          onChange={setValue}
          autoFocus
        >
          <InputOTP.Group>
            <InputOTP.Slot index={0} />
            <InputOTP.Slot index={1} />
            <InputOTP.Slot index={2} />
          </InputOTP.Group>
          <InputOTP.Separator />
          <InputOTP.Group>
            <InputOTP.Slot index={3} />
            <InputOTP.Slot index={4} />
            <InputOTP.Slot index={5} />
          </InputOTP.Group>
        </InputOTP>

        <div className="w-full space-y-2">
          <Button
            className="w-full"
            disabled={value.length < 6}
            onClick={() => alert(`Код подтвержден: ${value}`)}
          >
            Подтвердить
          </Button>
          <p className="text-xs text-muted-foreground">
            Текущее значение:{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono">
              {value || "пусто"}
            </code>
          </p>
        </div>
      </div>
    );
  },
};

/**
 * Состояние ошибки ввода (Invalid / Error State).
 */
export const WithErrorState: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-2">
      <Label
        htmlFor="otp-error-state"
        className="text-sm font-medium text-destructive"
      >
        Неверный код подтверждения
      </Label>
      <InputOTP
        id="otp-error-state"
        maxLength={6}
        defaultValue="123456"
        aria-invalid="true"
      >
        <InputOTP.Group>
          <InputOTP.Slot index={0} data-invalid="true" />
          <InputOTP.Slot index={1} data-invalid="true" />
          <InputOTP.Slot index={2} data-invalid="true" />
        </InputOTP.Group>
        <InputOTP.Separator />
        <InputOTP.Group>
          <InputOTP.Slot index={3} data-invalid="true" />
          <InputOTP.Slot index={4} data-invalid="true" />
          <InputOTP.Slot index={5} data-invalid="true" />
        </InputOTP.Group>
      </InputOTP>
      <p className="text-xs text-destructive">
        Код не совпадает или срок его действия истек.
      </p>
    </div>
  ),
};

/**
 * Отключенное состояние (Disabled).
 */
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-3">
      <Label
        htmlFor="otp-disabled"
        className="text-sm font-medium text-muted-foreground"
      >
        Поле заблокировано (таймаут 60 сек)
      </Label>
      <InputOTP id="otp-disabled" maxLength={6} defaultValue="987654" disabled>
        <InputOTP.Group>
          <InputOTP.Slot index={0} />
          <InputOTP.Slot index={1} />
          <InputOTP.Slot index={2} />
        </InputOTP.Group>
        <InputOTP.Separator />
        <InputOTP.Group>
          <InputOTP.Slot index={3} />
          <InputOTP.Slot index={4} />
          <InputOTP.Slot index={5} />
        </InputOTP.Group>
      </InputOTP>
    </div>
  ),
};
