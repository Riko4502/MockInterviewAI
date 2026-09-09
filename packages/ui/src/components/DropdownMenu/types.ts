import type { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type * as React from "react";

/** Пропсы корневого компонента DropdownMenu. */
export type DropdownMenuProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Root
>;

/** Пропсы портала — выносит содержимое меню в конец `<body>`. */
export type DropdownMenuPortalProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Portal
>;

/** Пропсы триггера — элемент, по клику на который открывается меню. */
export type DropdownMenuTriggerProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Trigger
>;

/** Пропсы содержимого меню (список пунктов). */
export type DropdownMenuContentProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Content
>;

/** Пропсы группы пунктов меню (визуальное объединение без рамки). */
export type DropdownMenuGroupProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Group
>;

/** Пропсы обычного пункта меню. */
export interface DropdownMenuItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Item> {
  /** Добавляет отступ слева, как будто рядом есть иконка. */
  inset?: boolean;
  /** "destructive" — для опасных действий, например "Удалить". */
  variant?: "default" | "destructive";
}

/** Пропсы пункта меню с чекбоксом (можно включить/выключить, не закрывая меню). */
export interface DropdownMenuCheckboxItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> {
  inset?: boolean;
}

/** Пропсы группы радио-пунктов (выбрать можно только один). */
export type DropdownMenuRadioGroupProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.RadioGroup
>;

/** Пропсы одного радио-пункта. */
export interface DropdownMenuRadioItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> {
  inset?: boolean;
}

/** Пропсы текстовой метки-заголовка внутри меню (например, "Мой аккаунт"). */
export interface DropdownMenuLabelProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Label> {
  inset?: boolean;
}

/** Пропсы разделителя между группами пунктов. */
export type DropdownMenuSeparatorProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Separator
>;

/** Пропсы подсказки горячей клавиши справа от пункта меню (например, "⌘K"). */
export type DropdownMenuShortcutProps = React.ComponentProps<"span">;

/** Пропсы вложенного подменю. */
export type DropdownMenuSubProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Sub
>;

/** Пропсы пункта-триггера, при наведении на который раскрывается подменю. */
export interface DropdownMenuSubTriggerProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> {
  inset?: boolean;
}

/** Пропсы содержимого подменю. */
export type DropdownMenuSubContentProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.SubContent
>;
