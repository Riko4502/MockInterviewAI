import type * as React from "react";

export type DataTableSortDirection = "asc" | "desc" | null;

/**
 * Состояние сортировки таблицы данных.
 */
export interface DataTableSortState {
  columnKey: string;
  direction: DataTableSortDirection;
}

/**
 * Базовый интерфейс строки таблицы, содержащий обязательный идентификатор id.
 */
export interface DataTableRow {
  id: string | number;
}

/**
 * Описание отдельной колонки таблицы данных DataTable.
 */
export interface DataTableColumn<T extends DataTableRow = DataTableRow> {
  /**
   * Уникальный ключ колонки.
   */
  key: string;
  /**
   * Заголовок колонки (текст, кастомный узел или функция).
   */
  header:
    | React.ReactNode
    | ((context: {
        column: DataTableColumn<T>;
        sortState?: DataTableSortState;
        toggleSort: () => void;
      }) => React.ReactNode);
  /**
   * Ключ свойства объекта строки для извлечения данных.
   */
  accessorKey?: keyof T | (string & {});
  /**
   * Кастомная функция рендера содержимого ячейки.
   */
  cell?: (row: T, index: number) => React.ReactNode;
  /**
   * Включена ли сортировка по данной колонке.
   * @default false
   */
  sortable?: boolean;
  /**
   * Выравнивание контента в ячейках.
   * @default "left"
   */
  align?: "left" | "center" | "right";
  /**
   * Фиксированная ширина колонки (например, "150px" или "20%").
   */
  width?: string | number;
  /**
   * Дополнительные CSS-классы для ячеек колонки.
   */
  className?: string;
}

/**
 * Настройки пагинации таблицы данных.
 */
export interface DataTablePaginationConfig {
  /**
   * Текущий номер страницы (начиная с 1).
   * @default 1
   */
  page?: number;
  /**
   * Количество элементов на странице.
   * @default 10
   */
  pageSize?: number;
  /**
   * Отображать ли выпадающий список выбора количества элементов (10, 20, 50).
   * @default true
   */
  showPageSizeSelect?: boolean;
  /**
   * Колбэк при изменении номера страницы.
   */
  onPageChange?: (page: number) => void;
  /**
   * Колбэк при изменении количества элементов на странице.
   */
  onPageSizeChange?: (pageSize: number) => void;
}

/**
 * Свойства компонента таблицы данных (DataTable).
 */
export interface DataTableProps<T extends DataTableRow = DataTableRow> {
  /**
   * Массив данных для отображения в строках таблицы (каждая строка содержит обязательный id).
   */
  data: T[];
  /**
   * Конфигурация колонок таблицы.
   */
  columns: DataTableColumn<T>[];
  /**
   * Флаг состояния загрузки данных.
   * @default false
   */
  loading?: boolean;
  /**
   * Текст сообщения при отсутствии данных.
   * @default "Нет данных для отображения"
   */
  emptyText?: string;
  /**
   * Закреплять ли шапку таблицы при вертикальном скролле (Sticky Header).
   * @default false
   */
  stickyHeader?: boolean;
  /**
   * Максимальная высота контейнера таблицы со скроллом (например, "400px").
   * @default "400px" (при stickyHeader: true)
   */
  maxHeight?: string | number;
  /**
   * Отображать ли строку поиска по таблице.
   * @default false
   */
  searchable?: boolean;
  /**
   * Плейсхолдер для поля поиска.
   * @default "Поиск..."
   */
  searchPlaceholder?: string;
  /**
   * Текущее значение строки поиска (для контролируемого режима).
   */
  searchValue?: string;
  /**
   * Колбэк при изменении поискового запроса.
   */
  onSearchChange?: (query: string) => void;
  /**
   * Кастомная функция фильтрации строк по поисковому запросу.
   */
  filterFn?: (row: T, query: string) => boolean;
  /**
   * Включить ли возможность выбора строк чекбоксами.
   * @default false
   */
  selectable?: boolean;
  /**
   * Массив выбранных идентификаторов id строк.
   */
  selectedKeys?: Array<string | number>;
  /**
   * Колбэк при изменении набора выбранных строк.
   */
  onSelectionChange?: (keys: Array<string | number>, selectedRows: T[]) => void;
  /**
   * Настройки или флаг постраничной пагинации.
   * @default false
   */
  pagination?: boolean | DataTablePaginationConfig;
  /**
   * Дополнительные элементы управления в верхней панели тулбара (справа от поиска).
   */
  toolbarExtra?: React.ReactNode;
  /**
   * Дополнительные CSS-классы корневого контейнера.
   */
  className?: string;
}
