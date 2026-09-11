import { CodeIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { Slot } from "radix-ui";
import * as React from "react";

export type LogoVariant = "full" | "icon";
export type LogoSize = "sm" | "md" | "lg";

export interface LogoProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: LogoVariant;
  size?: LogoSize;
  href?: string;
  asChild?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    container: "w-8 h-8 rounded-lg",
    icon: "w-4 h-4",
    title: "text-lg",
    subtitle: "text-[8px]",
    gap: "gap-2",
  },
  md: {
    container: "w-10 h-10 rounded-xl",
    icon: "w-5 h-5",
    title: "text-xl",
    subtitle: "text-[9px]",
    gap: "gap-3",
  },
  lg: {
    container: "w-12 h-12 rounded-2xl",
    icon: "w-6 h-6",
    title: "text-2xl",
    subtitle: "text-[10px]",
    gap: "gap-3.5",
  },
} as const;

export function Logo({
  variant = "full",
  size = "md",
  href = "/",
  asChild = false,
  className,
  children,
  ...props
}: LogoProps) {
  const config = sizeConfig[size] ?? sizeConfig.md;

  const content = (
    <>
      <div
        className={cn(
          config.container,
          "bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/25 group-hover:scale-105 group-hover:shadow-violet-500/40 transition-all duration-300",
        )}
      >
        <CodeIcon className={cn(config.icon, "text-white shrink-0")} />
      </div>

      {variant === "full" && (
        <div className="flex flex-col">
          <span
            className={cn(
              config.title,
              "font-extrabold tracking-tight text-white group-hover:text-violet-400 transition-colors leading-none",
            )}
          >
            DEVSYNC
          </span>
          <span
            className={cn(
              config.subtitle,
              "font-mono tracking-widest text-slate-400 uppercase leading-tight mt-0.5",
            )}
          >
            Interview AI
          </span>
        </div>
      )}
    </>
  );

  const sharedClassName = cn(
    "flex items-center group text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-lg",
    config.gap,
    className,
  );

  const resolvedAriaLabel =
    variant === "icon"
      ? "DEVSYNC Interview AI"
      : (props["aria-label"] ?? undefined);

  if (asChild && React.isValidElement(children)) {
    const childElement = children as React.ReactElement<{
      children?: React.ReactNode;
    }>;
    return (
      <Slot.Root
        aria-label={resolvedAriaLabel}
        className={sharedClassName}
        {...props}
      >
        {React.cloneElement(childElement, {
          children: childElement.props.children ?? content,
        })}
      </Slot.Root>
    );
  }

  return (
    <a
      href={href}
      aria-label={resolvedAriaLabel}
      className={sharedClassName}
      {...props}
    >
      {children ?? content}
    </a>
  );
}
