import { CheckIcon, ChevronRightIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { DROPDOWN_MENU_STYLES } from "./constants";
import type {
  DropdownMenuCheckboxItemProps,
  DropdownMenuContentProps,
  DropdownMenuGroupProps,
  DropdownMenuItemProps,
  DropdownMenuLabelProps,
  DropdownMenuPortalProps,
  DropdownMenuProps,
  DropdownMenuRadioGroupProps,
  DropdownMenuRadioItemProps,
  DropdownMenuSeparatorProps,
  DropdownMenuShortcutProps,
  DropdownMenuSubContentProps,
  DropdownMenuSubProps,
  DropdownMenuSubTriggerProps,
  DropdownMenuTriggerProps,
} from "./types";

/** Корневой компонент — управляет состоянием открыт/закрыт для всего меню. */
function DropdownMenuRoot({ ...props }: DropdownMenuProps) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

/** Портал — выносит содержимое меню в конец `<body>`. */
function Portal({ ...props }: DropdownMenuPortalProps) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  );
}

/** Элемент, по клику на который открывается меню. */
function Trigger({ ...props }: DropdownMenuTriggerProps) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

/** Содержимое меню — список пунктов рядом с триггером. */
function Content({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        className={cn(DROPDOWN_MENU_STYLES.content, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

/** Группа пунктов меню (визуальное объединение). */
function Group({ ...props }: DropdownMenuGroupProps) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

/** Обычный кликабельный пункт меню. */
function Item({
  className,
  inset,
  variant = "default",
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(DROPDOWN_MENU_STYLES.item, className)}
      {...props}
    />
  );
}

/** Пункт меню с чекбоксом. */
function CheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(DROPDOWN_MENU_STYLES.checkboxItem, className)}
      checked={checked}
      {...props}
    >
      <span
        className={DROPDOWN_MENU_STYLES.itemIndicator}
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

/** Группа радио-пунктов — выбрать можно только один. */
function RadioGroup({ ...props }: DropdownMenuRadioGroupProps) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

/** Один пункт внутри RadioGroup. */
function RadioItem({
  className,
  children,
  inset,
  ...props
}: DropdownMenuRadioItemProps) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(DROPDOWN_MENU_STYLES.radioItem, className)}
      {...props}
    >
      <span
        className={DROPDOWN_MENU_STYLES.itemIndicator}
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

/** Текстовая метка-заголовок внутри меню. */
function Label({ className, inset, ...props }: DropdownMenuLabelProps) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(DROPDOWN_MENU_STYLES.label, className)}
      {...props}
    />
  );
}

/** Разделитель между группами пунктов. */
function Separator({ className, ...props }: DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(DROPDOWN_MENU_STYLES.separator, className)}
      {...props}
    />
  );
}

/** Подсказка горячей клавиши справа от текста пункта. */
function Shortcut({ className, ...props }: DropdownMenuShortcutProps) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(DROPDOWN_MENU_STYLES.shortcut, className)}
      {...props}
    />
  );
}

/** Вложенное подменю. */
function Sub({ ...props }: DropdownMenuSubProps) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

/** Пункт-триггер, при наведении на который раскрывается подменю. */
function SubTrigger({
  className,
  inset,
  children,
  ...props
}: DropdownMenuSubTriggerProps) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(DROPDOWN_MENU_STYLES.subTrigger, className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className={DROPDOWN_MENU_STYLES.subTriggerIcon} />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

/** Содержимое подменю. */
function SubContent({ className, ...props }: DropdownMenuSubContentProps) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(DROPDOWN_MENU_STYLES.subContent, className)}
      {...props}
    />
  );
}

export const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Portal,
  Trigger,
  Content,
  Group,
  Label,
  Item,
  CheckboxItem,
  RadioGroup,
  RadioItem,
  Separator,
  Shortcut,
  Sub,
  SubTrigger,
  SubContent,
});
