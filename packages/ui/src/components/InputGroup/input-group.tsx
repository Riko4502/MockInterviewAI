import { cn } from "@packages/utils";
import { INPUT_GROUP_STYLES } from "./constants";
import type {
  InputGroupAddonProps,
  InputGroupPrefixProps,
  InputGroupProps,
  InputGroupSuffixProps,
} from "./types";

/**
 * Корневой контейнер группы поля ввода (InputGroup).
 *
 * Поддерживает:
 * - Внутренние префиксы/суффиксы через compound-компоненты (`InputGroup.Prefix`, `InputGroup.Suffix`) или пропсы (`prefix`, `suffix`);
 * - Внешние прикрепленные текстовые блоки (`InputGroup.Addon`);
 * - Бесшовную склейку с кнопками и аддонами при `attached={true}`.
 */
function InputGroupRoot({
  className,
  attached = false,
  prefix,
  suffix,
  children,
  ...props
}: InputGroupProps) {
  return (
    <div
      data-slot="input-group"
      data-attached={attached}
      className={cn(
        INPUT_GROUP_STYLES.root,
        attached && INPUT_GROUP_STYLES.attached,
        className,
      )}
      {...props}
    >
      {prefix && <InputGroupPrefix>{prefix}</InputGroupPrefix>}
      {children}
      {suffix && <InputGroupSuffix>{suffix}</InputGroupSuffix>}
    </div>
  );
}

/**
 * Внутренний префикс поля ввода (иконка или текст слева внутри инпута).
 */
function InputGroupPrefix({ className, ...props }: InputGroupPrefixProps) {
  return (
    <div
      data-slot="input-prefix"
      className={cn(INPUT_GROUP_STYLES.prefix, className)}
      {...props}
    />
  );
}

/**
 * Внутренний суффикс поля ввода (иконка, кнопка или текст справа внутри инпута).
 */
function InputGroupSuffix({ className, ...props }: InputGroupSuffixProps) {
  return (
    <div
      data-slot="input-suffix"
      className={cn(INPUT_GROUP_STYLES.suffix, className)}
      {...props}
    />
  );
}

/**
 * Внешний прикрепляемый аддон поля ввода (текстовый блок).
 */
function InputGroupAddon({ className, ...props }: InputGroupAddonProps) {
  return (
    <div
      data-slot="input-addon"
      className={cn(INPUT_GROUP_STYLES.addon, className)}
      {...props}
    />
  );
}

export const InputGroup = Object.assign(InputGroupRoot, {
  Prefix: InputGroupPrefix,
  Suffix: InputGroupSuffix,
  Addon: InputGroupAddon,
  Text: InputGroupAddon,
});
