import { cva } from "@packages/utils";

/**
 * Варианты стилизации списка вкладок (Tabs.List).
 */
export const tabsListVariants = cva(
  "inline-flex items-center text-muted-foreground select-none data-[orientation=vertical]:flex-col data-[orientation=vertical]:h-auto data-[orientation=vertical]:items-stretch data-[orientation=vertical]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "rounded-xl bg-muted/80 p-1 shadow-xs justify-center data-[orientation=vertical]:w-44 data-[orientation=vertical]:justify-start",
        line: "border-b border-border bg-transparent p-0 gap-4 justify-start w-full data-[orientation=vertical]:border-b-0 data-[orientation=vertical]:border-r data-[orientation=vertical]:w-44 data-[orientation=vertical]:gap-1",
        card: "bg-transparent p-0 gap-1 justify-start data-[orientation=vertical]:w-44",
      },
      size: {
        sm: "h-8 text-xs",
        default: "h-9.5 text-sm",
        lg: "h-11 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * Варианты стилизации кнопки переключения вкладки (Tabs.Trigger).
 */
export const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[orientation=vertical]:justify-start",
  {
    variants: {
      variant: {
        default:
          "rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs hover:text-foreground",
        line: "border-b-2 border-transparent rounded-none data-[state=active]:border-primary data-[state=active]:text-foreground hover:text-foreground -mb-[1px] data-[orientation=vertical]:border-b-0 data-[orientation=vertical]:border-r-2 data-[orientation=vertical]:-mb-0 data-[orientation=vertical]:-mr-[1px] data-[orientation=vertical]:pb-0 data-[orientation=vertical]:py-2",
        card: "rounded-t-lg border border-transparent data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground hover:bg-muted/40 data-[orientation=vertical]:rounded-r-none data-[orientation=vertical]:rounded-l-lg",
      },
      size: {
        sm: "px-2.5 py-1 text-xs gap-1.5",
        default: "px-3 py-1.5 text-sm gap-2",
        lg: "px-4 py-2 text-base gap-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * Стили контентной панели вкладки (Tabs.Content).
 */
export const TABS_CONTENT_STYLES =
  "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-in fade-in-50 duration-200 data-[orientation=vertical]:mt-0 data-[orientation=vertical]:flex-1";
