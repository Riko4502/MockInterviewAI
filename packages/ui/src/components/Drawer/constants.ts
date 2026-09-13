import { cva } from "@packages/utils";

export const drawerContentVariants = cva(
  "fixed z-50 flex flex-col bg-background shadow-2xl transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out duration-300",
  {
    variants: {
      side: {
        bottom:
          "inset-x-0 bottom-0 max-h-[85vh] rounded-t-[16px] border-t border-border data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        top: "inset-x-0 top-0 max-h-[85vh] rounded-b-[16px] border-b border-border data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        left: "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        right:
          "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      },
    },
    defaultVariants: {
      side: "bottom",
    },
  },
);

export const DRAWER_STYLES = {
  overlay:
    "fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  handle:
    "mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted-foreground/20 shrink-0",
  header: "flex flex-col gap-1.5 p-4 text-center sm:text-left",
  footer: "mt-auto flex flex-col gap-2 p-4",
  title: "text-lg font-semibold leading-none tracking-tight text-foreground",
  description: "text-sm text-muted-foreground",
  close:
    "absolute right-4 top-4 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none cursor-pointer",
} as const;
