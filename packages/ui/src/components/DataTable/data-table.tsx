"use client";

import { Checkbox } from "@components/Checkbox";
import { Empty } from "@components/Empty";
import { Input } from "@components/Input";
import { InputGroup } from "@components/InputGroup";
import { Pagination } from "@components/Pagination";
import { Select } from "@components/Select";
import { Spin } from "@components/Spin";
import { Table } from "@components/Table";
import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import * as React from "react";
import { DATA_TABLE_STYLES, DEFAULT_PAGE_SIZE_OPTIONS } from "./constants";
import type {
  DataTablePaginationConfig,
  DataTableProps,
  DataTableRow,
  DataTableSortState,
} from "./types";

function renderCellValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return "—";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (React.isValidElement(value)) {
    return value;
  }
  return "—";
}

/**
 * Мощный типобезопасный компонент таблицы данных (DataTable).
 */
export function DataTable<T extends DataTableRow = DataTableRow>({
  data,
  columns,
  loading = false,
  emptyText = "Нет данных для отображения",
  stickyHeader = false,
  maxHeight = "400px",
  searchable = false,
  searchPlaceholder = "Поиск по таблице...",
  searchValue: controlledSearchValue,
  onSearchChange,
  filterFn,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  pagination = false,
  toolbarExtra,
  className,
}: DataTableProps<T>) {
  // 1. Поиск (Search)
  const [internalSearchQuery, setInternalSearchQuery] = React.useState("");
  const searchQuery =
    controlledSearchValue !== undefined
      ? controlledSearchValue
      : internalSearchQuery;

  const handleSearchChange = (query: string) => {
    if (controlledSearchValue === undefined) {
      setInternalSearchQuery(query);
    }
    onSearchChange?.(query);
  };

  // 2. Сортировка (Sorting)
  const [sortState, setSortState] = React.useState<DataTableSortState | null>(
    null,
  );

  const toggleSort = (columnKey: string) => {
    setSortState((prev) => {
      if (!prev || prev.columnKey !== columnKey) {
        return { columnKey, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { columnKey, direction: "desc" };
      }
      return null;
    });
  };

  // 3. Пагинация (Pagination)
  const isPaginationEnabled = Boolean(pagination);
  const paginationConfig: DataTablePaginationConfig =
    typeof pagination === "object" ? pagination : {};

  const [internalPage, setInternalPage] = React.useState(
    paginationConfig.page ?? 1,
  );
  const [internalPageSize, setInternalPageSize] = React.useState(
    paginationConfig.pageSize ?? 10,
  );

  // Синхронизация при изменении внешних пропсов
  React.useEffect(() => {
    if (paginationConfig.page !== undefined) {
      setInternalPage(paginationConfig.page);
    }
  }, [paginationConfig.page]);

  React.useEffect(() => {
    if (paginationConfig.pageSize !== undefined) {
      setInternalPageSize(paginationConfig.pageSize);
    }
  }, [paginationConfig.pageSize]);

  const page = internalPage;
  const pageSize = internalPageSize;
  const showPageSizeSelect = paginationConfig.showPageSizeSelect ?? true;

  const handlePageChange = (newPage: number) => {
    setInternalPage(newPage);
    paginationConfig.onPageChange?.(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setInternalPageSize(newSize);
    setInternalPage(1);
    paginationConfig.onPageSizeChange?.(newSize);
    paginationConfig.onPageChange?.(1);
  };

  // Фильтрация данных
  const filteredData = React.useMemo(() => {
    if (!searchable || !searchQuery.trim()) return data;

    const query = searchQuery.toLowerCase().trim();

    if (filterFn) {
      return data.filter((row) => filterFn(row, query));
    }

    return data.filter((row) =>
      Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      }),
    );
  }, [data, searchable, searchQuery, filterFn]);

  // Сортировка данных
  const sortedData = React.useMemo(() => {
    if (!sortState || !sortState.direction) return filteredData;

    const { columnKey, direction } = sortState;
    const column = columns.find((col) => col.key === columnKey);
    if (!column) return filteredData;

    const propKey = String(column.accessorKey ?? column.key);

    return [...filteredData].sort((a, b) => {
      const valA = Reflect.get(a, propKey);
      const valB = Reflect.get(b, propKey);

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      let comparison = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        comparison = valA - valB;
      } else if (valA instanceof Date && valB instanceof Date) {
        comparison = valA.getTime() - valB.getTime();
      } else {
        comparison = String(valA).localeCompare(String(valB), "ru-RU", {
          numeric: true,
        });
      }

      return direction === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortState, columns]);

  // Постраничный срез данных
  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const displayData = React.useMemo(() => {
    if (!isPaginationEnabled) return sortedData;
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, isPaginationEnabled, page, pageSize]);

  // 4. Выбор строк (Row Selection)
  const isAllSelected =
    displayData.length > 0 &&
    displayData.every((row) => selectedKeys.includes(row.id));

  const isSomeSelected =
    displayData.some((row) => selectedKeys.includes(row.id)) && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      // Снимаем выбор с текущей страницы
      const keysOnPage = new Set(displayData.map((row) => row.id));
      const newSelectedKeys = selectedKeys.filter((id) => !keysOnPage.has(id));
      const newSelectedRows = data.filter((row) =>
        newSelectedKeys.includes(row.id),
      );
      onSelectionChange?.(newSelectedKeys, newSelectedRows);
    } else {
      // Добавляем все строки текущей страницы
      const keysOnPage = displayData.map((row) => row.id);
      const combinedKeys = Array.from(
        new Set([...selectedKeys, ...keysOnPage]),
      );
      const newSelectedRows = data.filter((row) =>
        combinedKeys.includes(row.id),
      );
      onSelectionChange?.(combinedKeys, newSelectedRows);
    }
  };

  const handleSelectRow = (row: T) => {
    const id = row.id;
    const isSelected = selectedKeys.includes(id);

    const newSelectedKeys = isSelected
      ? selectedKeys.filter((k) => k !== id)
      : [...selectedKeys, id];

    const newSelectedRows = data.filter((r) => newSelectedKeys.includes(r.id));

    onSelectionChange?.(newSelectedKeys, newSelectedRows);
  };

  const totalColumnsCount = columns.length + (selectable ? 1 : 0);

  return (
    <div
      data-slot="data-table-root"
      className={cn(DATA_TABLE_STYLES.wrapper, className)}
    >
      {/* Тулбар поиска и дополнительных действий */}
      {(searchable || toolbarExtra) && (
        <div
          data-slot="data-table-toolbar"
          className={DATA_TABLE_STYLES.toolbar}
        >
          {searchable ? (
            <div className="w-72 max-w-full">
              <InputGroup>
                <InputGroup.Prefix>
                  <SearchIcon size="sm" />
                </InputGroup.Prefix>
                <Input
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleSearchChange(e.target.value)
                  }
                  placeholder={searchPlaceholder}
                />
              </InputGroup>
            </div>
          ) : (
            <div />
          )}

          {toolbarExtra && (
            <div className="flex items-center gap-2">{toolbarExtra}</div>
          )}
        </div>
      )}

      {/* Обертка для таблицы и оверлея */}
      <div className="relative">
        {loading && (
          <div className={DATA_TABLE_STYLES.loadingOverlay}>
            <Spin size="lg" />
          </div>
        )}

        <Table
          containerStyle={stickyHeader ? { maxHeight } : undefined}
          containerClassName={cn(
            stickyHeader
              ? DATA_TABLE_STYLES.tableContainerSticky
              : DATA_TABLE_STYLES.tableContainer,
          )}
        >
          <Table.Header>
            <Table.Row>
              {selectable && (
                <Table.Head
                  className={cn(
                    "w-12 text-center",
                    stickyHeader && DATA_TABLE_STYLES.headSticky,
                  )}
                >
                  <Checkbox
                    checked={
                      isAllSelected ||
                      (isSomeSelected ? "indeterminate" : false)
                    }
                    onCheckedChange={handleSelectAll}
                    aria-label="Выбрать все строки"
                  />
                </Table.Head>
              )}

              {columns.map((column) => {
                const isCurrentSorted = sortState?.columnKey === column.key;
                const sortDir = isCurrentSorted ? sortState.direction : null;

                const headerContent =
                  typeof column.header === "function"
                    ? column.header({
                        column,
                        sortState: sortState || undefined,
                        toggleSort: () => toggleSort(column.key),
                      })
                    : column.header;

                return (
                  <Table.Head
                    key={column.key}
                    style={column.width ? { width: column.width } : undefined}
                    className={cn(
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right",
                      stickyHeader && DATA_TABLE_STYLES.headSticky,
                      column.className,
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={DATA_TABLE_STYLES.sortButton}
                      >
                        <span>{headerContent}</span>
                        {sortDir === "asc" ? (
                          <ArrowUpIcon size="xs" className="text-primary" />
                        ) : sortDir === "desc" ? (
                          <ArrowDownIcon size="xs" className="text-primary" />
                        ) : (
                          <ArrowDownIcon
                            size="xs"
                            className="opacity-30 hover:opacity-100"
                          />
                        )}
                      </button>
                    ) : (
                      headerContent
                    )}
                  </Table.Head>
                );
              })}
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {displayData.length > 0 ? (
              displayData.map((row, rowIndex) => {
                const isRowSelected = selectedKeys.includes(row.id);

                return (
                  <Table.Row
                    key={row.id}
                    data-state={isRowSelected ? "selected" : undefined}
                    className={cn(isRowSelected && "bg-muted/40 font-medium")}
                  >
                    {selectable && (
                      <Table.Cell className="w-12 text-center">
                        <Checkbox
                          checked={isRowSelected}
                          onCheckedChange={() => handleSelectRow(row)}
                          aria-label={`Выбрать строку ${rowIndex + 1}`}
                        />
                      </Table.Cell>
                    )}

                    {columns.map((column) => {
                      const propKey = String(column.accessorKey ?? column.key);
                      const rawValue = Reflect.get(row, propKey);

                      return (
                        <Table.Cell
                          key={column.key}
                          className={cn(
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right",
                            column.className,
                          )}
                        >
                          {column.cell
                            ? column.cell(row, rowIndex)
                            : renderCellValue(rawValue)}
                        </Table.Cell>
                      );
                    })}
                  </Table.Row>
                );
              })
            ) : (
              <Table.Row>
                <Table.Cell
                  colSpan={totalColumnsCount}
                  className="h-48 text-center"
                >
                  <Empty description={emptyText} />
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </div>

      {/* Нижняя панель с пагинацией, выбором размера страницы и счетчиком */}
      {isPaginationEnabled && (
        <div className={DATA_TABLE_STYLES.paginationContainer}>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              {selectable && selectedKeys.length > 0 ? (
                <span>
                  Выбрано: <strong>{selectedKeys.length}</strong> из{" "}
                  <strong>{totalItems}</strong>
                </span>
              ) : (
                <span>
                  Всего записей: <strong>{totalItems}</strong>
                </span>
              )}
            </div>

            {showPageSizeSelect && (
              <div className="flex items-center gap-2">
                <span>Показывать по:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => handlePageSizeChange(Number(val))}
                >
                  <Select.Trigger size="sm" className="h-7 w-[72px] text-xs">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content position="popper">
                    {DEFAULT_PAGE_SIZE_OPTIONS.map((opt) => (
                      <Select.Item
                        key={opt}
                        value={String(opt)}
                        className="text-xs"
                      >
                        {opt}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="ml-auto">
              <Pagination>
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous
                      className={cn(
                        "cursor-pointer",
                        page <= 1 && "pointer-events-none opacity-40",
                      )}
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        if (page > 1) handlePageChange(page - 1);
                      }}
                    />
                  </Pagination.Item>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <Pagination.Item key={p}>
                        <Pagination.Link
                          className="cursor-pointer"
                          isActive={p === page}
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            handlePageChange(p);
                          }}
                        >
                          {p}
                        </Pagination.Link>
                      </Pagination.Item>
                    ),
                  )}

                  <Pagination.Item>
                    <Pagination.Next
                      className={cn(
                        "cursor-pointer",
                        page >= totalPages && "pointer-events-none opacity-40",
                      )}
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        if (page < totalPages) handlePageChange(page + 1);
                      }}
                    />
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
