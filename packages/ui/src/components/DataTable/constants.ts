/**
 * Доступные по умолчанию варианты количества элементов на странице (неизменяемый массив).
 */
export const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = Object.freeze([
  10, 20, 50,
]);

/**
 * Токены стилей для компонента DataTable.
 */
export const DATA_TABLE_STYLES = {
  wrapper: "space-y-4 w-full",
  toolbar: "flex flex-wrap items-center justify-between gap-3",
  tableContainer:
    "relative rounded-xl border border-border bg-card overflow-x-auto shadow-xs",
  tableContainerSticky:
    "relative rounded-xl border border-border bg-card overflow-auto shadow-xs",
  headSticky:
    "sticky top-0 z-20 bg-card/95 backdrop-blur-[2px] shadow-[0_1px_0_0_hsl(var(--border))]",
  sortButton:
    "inline-flex items-center gap-1.5 font-medium hover:text-foreground transition-colors cursor-pointer select-none -ml-1 px-1.5 py-0.5 rounded-md hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  paginationContainer:
    "flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-muted-foreground select-none",
  loadingOverlay:
    "absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-[1px] transition-all",
} as const;
