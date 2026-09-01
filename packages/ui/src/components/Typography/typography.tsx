import { cn } from "@packages/utils";
import { Slot } from "radix-ui";
import * as React from "react";
import { typographyVariants, VARIANT_TAG_MAP } from "./constants";
import type { TypographyProps, TypographySubComponentProps } from "./types";

/**
 * Полиморфный компонент типографики (Typography).
 *
 * Поддерживает:
 * - Стили: `h1`, `h2`, `h3`, `h4`, `p`, `lead`, `large`, `small`, `muted`, `code`, `blockquote`;
 * - Автоматический подбор семантического HTML-тега по варианту;
 * - Полиморфизм через пропс `as` или `asChild`;
 * - Составные компоненты: `Typography.H1`, `Typography.P`, `Typography.Lead` и т.д.
 */
function TypographyRoot<T extends React.ElementType = "p">({
  as,
  asChild = false,
  variant = "p",
  className,
  ...props
}: TypographyProps<T>) {
  const isSlot = asChild && React.isValidElement(props.children);
  const Component = isSlot ? Slot.Root : as || VARIANT_TAG_MAP[variant] || "p";

  return (
    <Component
      data-slot="typography"
      data-variant={variant}
      className={cn(typographyVariants({ variant, className }))}
      {...props}
    />
  );
}

/**
 * Заголовок первого уровня (H1).
 */
function TypographyH1(props: TypographySubComponentProps<"h1">) {
  return <TypographyRoot as="h1" variant="h1" {...props} />;
}

/**
 * Заголовок второго уровня (H2).
 */
function TypographyH2(props: TypographySubComponentProps<"h2">) {
  return <TypographyRoot as="h2" variant="h2" {...props} />;
}

/**
 * Заголовок третьего уровня (H3).
 */
function TypographyH3(props: TypographySubComponentProps<"h3">) {
  return <TypographyRoot as="h3" variant="h3" {...props} />;
}

/**
 * Заголовок четвертого уровня (H4).
 */
function TypographyH4(props: TypographySubComponentProps<"h4">) {
  return <TypographyRoot as="h4" variant="h4" {...props} />;
}

/**
 * Основной текст параграфа (P).
 */
function TypographyP(props: TypographySubComponentProps<"p">) {
  return <TypographyRoot as="p" variant="p" {...props} />;
}

/**
 * Лид-параграф текста (Lead).
 */
function TypographyLead(props: TypographySubComponentProps<"p">) {
  return <TypographyRoot as="p" variant="lead" {...props} />;
}

/**
 * Крупный акцентный текст (Large).
 */
function TypographyLarge(props: TypographySubComponentProps<"div">) {
  return <TypographyRoot as="div" variant="large" {...props} />;
}

/**
 * Мелкий текст подписи (Small).
 */
function TypographySmall(props: TypographySubComponentProps<"small">) {
  return <TypographyRoot as="small" variant="small" {...props} />;
}

/**
 * Приглушенный второстепенный текст (Muted).
 */
function TypographyMuted(props: TypographySubComponentProps<"p">) {
  return <TypographyRoot as="p" variant="muted" {...props} />;
}

/**
 * Инлайн фрагмент кода (Code).
 */
function TypographyCode(props: TypographySubComponentProps<"code">) {
  return <TypographyRoot as="code" variant="code" {...props} />;
}

/**
 * Блок цитаты (Blockquote).
 */
function TypographyBlockquote(
  props: TypographySubComponentProps<"blockquote">,
) {
  return <TypographyRoot as="blockquote" variant="blockquote" {...props} />;
}

export const Typography = Object.assign(TypographyRoot, {
  H1: TypographyH1,
  H2: TypographyH2,
  H3: TypographyH3,
  H4: TypographyH4,
  P: TypographyP,
  Lead: TypographyLead,
  Large: TypographyLarge,
  Small: TypographySmall,
  Muted: TypographyMuted,
  Code: TypographyCode,
  Blockquote: TypographyBlockquote,
});
