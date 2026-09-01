import { Calendar, DatePicker } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

/**
 * Метаданные компонента DatePicker для Storybook.
 */
const meta = {
  title: "Components/DatePicker",
  component: DatePicker,
  subcomponents: {
    Calendar: Calendar,
  },
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    placeholder: {
      control: "text",
      description: "Текст плейсхолдера",
    },
    disabled: {
      control: "boolean",
      description: "Заблокировано ли поле",
    },
    clearable: {
      control: "boolean",
      description: "Возможность быстрой очистки даты",
    },
  },
  args: {
    placeholder: "Выберите дату собеседования",
    disabled: false,
    clearable: true,
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Интерактивный выпадающий календарь выбора даты (DatePicker).
 */
export const Default: Story = {
  render: (args) => {
    const [date, setDate] = React.useState<Date | null>(new Date());

    return (
      <div className="w-80 space-y-2">
        <span className="text-xs text-muted-foreground block">
          Дата собеседования:
        </span>
        <DatePicker {...args} value={date} onChange={setDate} />
      </div>
    );
  },
};

/**
 * Интерактивный календарь как самостоятельный встраиваемый виджет (Calendar).
 */
export const StandaloneCalendar: Story = {
  render: () => {
    const [selected, setSelected] = React.useState<Date | null>(new Date());

    return (
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
        <Calendar selected={selected} onSelect={setSelected} />
        {selected && (
          <div className="text-xs text-center text-muted-foreground pt-2 border-t border-border">
            Выбрано: <strong>{selected.toLocaleDateString("ru-RU")}</strong>
          </div>
        )}
      </div>
    );
  },
};

/**
 * Выбор даты с ограничением диапазона (только будущие даты, начиная с сегодняшнего дня).
 */
export const FutureDatesOnly: Story = {
  render: () => {
    const [date, setDate] = React.useState<Date | null>(null);
    const today = new Date();

    return (
      <div className="w-80 space-y-2">
        <span className="text-xs text-muted-foreground block">
          Запланировать интервью (только будущие даты):
        </span>
        <DatePicker
          value={date}
          onChange={setDate}
          minDate={today}
          placeholder="Выберите дату в будущем"
        />
      </div>
    );
  },
};

/**
 * Состояние заблокированного поля (Disabled).
 */
export const DisabledState: Story = {
  render: () => (
    <div className="w-80">
      <DatePicker disabled value={new Date(2026, 4, 15)} />
    </div>
  ),
};
