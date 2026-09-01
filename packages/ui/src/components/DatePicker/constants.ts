/**
 * Дни недели на русском языке (начиная с понедельника).
 */
export const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

/**
 * Названия месяцев на русском языке.
 */
export const MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

/**
 * Токены стилей для компонентов DatePicker и Calendar.
 */
export const DATE_PICKER_STYLES = {
  popover:
    "z-50 w-auto p-3.5 bg-popover text-popover-foreground rounded-xl border border-border shadow-xl outline-none select-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  calendar: "space-y-3.5 select-none w-[268px]",
  header: "flex items-center justify-between relative",
  headerTitle:
    "text-sm font-semibold text-foreground capitalize tracking-tight",
  navButton:
    "size-7 p-0 flex items-center justify-center rounded-lg border border-input bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
  weekdaysRow:
    "grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground font-medium",
  daysGrid: "grid grid-cols-7 gap-1 mt-1",
  dayButton:
    "size-8 p-0 text-xs font-normal flex items-center justify-center rounded-lg transition-colors cursor-pointer select-none hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  daySelected:
    "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-medium",
  dayToday: "border border-primary font-semibold text-primary",
  dayOutside: "text-muted-foreground/35 opacity-40 hover:opacity-100",
  dayDisabled:
    "text-muted-foreground/25 opacity-30 cursor-not-allowed pointer-events-none",
  trigger:
    "flex h-[46px] w-full items-center justify-between rounded-lg border border-input bg-background px-3.5 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer select-none",
} as const;

/**
 * Проверяет, совпадают ли два дня по календарю (год, месяц, день).
 */
export function isSameDay(date1?: Date | null, date2?: Date | null): boolean {
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Форматирует дату на русском языке (например, "12 октября 2025").
 */
export function formatDateRu(date?: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
