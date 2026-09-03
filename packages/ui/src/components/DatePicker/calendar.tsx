import { ArrowDownIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import * as React from "react";
import {
  DATE_PICKER_STYLES,
  isSameDay,
  MONTHS_RU,
  WEEKDAYS_RU,
} from "./constants";
import type { CalendarProps } from "./types";

/**
 * Интерактивный компонент календаря (Calendar).
 */
export function Calendar({
  selected,
  onSelect,
  defaultMonth,
  minDate,
  maxDate,
  disabledDate,
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => {
    return defaultMonth || selected || new Date();
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const today = React.useMemo(() => new Date(), []);

  // Генерация сетки дней
  const days = React.useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayOffset = firstDayOfMonth.getDay() - 1;
    if (startDayOffset < 0) startDayOffset = 6; // Сдвиг на понедельник

    const daysInMonth = lastDayOfMonth.getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const result: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isDisabled: boolean;
    }> = [];

    // Дни предыдущего месяца
    for (let i = startDayOffset - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i);
      result.push({
        date,
        isCurrentMonth: false,
        isToday: isSameDay(date, today),
        isSelected: isSameDay(date, selected),
        isDisabled: isDateDisabled(date, minDate, maxDate, disabledDate),
      });
    }

    // Дни текущего месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      result.push({
        date,
        isCurrentMonth: true,
        isToday: isSameDay(date, today),
        isSelected: isSameDay(date, selected),
        isDisabled: isDateDisabled(date, minDate, maxDate, disabledDate),
      });
    }

    // Дни следующего месяца для завершения сетки (до кратного 7)
    const remainingDays = (7 - (result.length % 7)) % 7;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      result.push({
        date,
        isCurrentMonth: false,
        isToday: isSameDay(date, today),
        isSelected: isSameDay(date, selected),
        isDisabled: isDateDisabled(date, minDate, maxDate, disabledDate),
      });
    }

    return result;
  }, [year, month, selected, today, minDate, maxDate, disabledDate]);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  return (
    <div
      data-slot="calendar"
      className={cn(DATE_PICKER_STYLES.calendar, className)}
    >
      {/* Шапка календаря (Месяц Год и стрелки) */}
      <div className={DATE_PICKER_STYLES.header}>
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Предыдущий месяц"
          className={DATE_PICKER_STYLES.navButton}
        >
          <ArrowDownIcon size="xs" className="rotate-90" />
        </button>

        <span className={DATE_PICKER_STYLES.headerTitle}>
          {MONTHS_RU[month]} {year}
        </span>

        <button
          type="button"
          onClick={nextMonth}
          aria-label="Следующий месяц"
          className={DATE_PICKER_STYLES.navButton}
        >
          <ArrowDownIcon size="xs" className="-rotate-90" />
        </button>
      </div>

      {/* Дни недели (Пн-Вс) */}
      <div className={DATE_PICKER_STYLES.weekdaysRow}>
        {WEEKDAYS_RU.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      {/* Сетка дней */}
      <div className={DATE_PICKER_STYLES.daysGrid}>
        {days.map(
          (
            { date, isCurrentMonth, isToday, isSelected, isDisabled },
            index,
          ) => (
            <button
              key={`${date.toISOString()}-${index}`}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onSelect?.(date)}
              className={cn(
                DATE_PICKER_STYLES.dayButton,
                !isCurrentMonth && DATE_PICKER_STYLES.dayOutside,
                isToday && !isSelected && DATE_PICKER_STYLES.dayToday,
                isSelected && DATE_PICKER_STYLES.daySelected,
                isDisabled && DATE_PICKER_STYLES.dayDisabled,
              )}
            >
              {date.getDate()}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function isDateDisabled(
  date: Date,
  minDate?: Date,
  maxDate?: Date,
  disabledDate?: (date: Date) => boolean,
): boolean {
  if (disabledDate?.(date)) return true;

  if (minDate) {
    const min = new Date(
      minDate.getFullYear(),
      minDate.getMonth(),
      minDate.getDate(),
    );
    const current = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    if (current < min) return true;
  }

  if (maxDate) {
    const max = new Date(
      maxDate.getFullYear(),
      maxDate.getMonth(),
      maxDate.getDate(),
    );
    const current = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    if (current > max) return true;
  }

  return false;
}
