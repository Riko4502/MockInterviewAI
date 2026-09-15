/**
 * Метаданные пагинации для списков сущностей.
 */
export interface PaginationMeta {
  /** Общее количество элементов */
  total: number;
  /** Текущая страница (начиная с 1) */
  page: number;
  /** Количество элементов на странице */
  limit: number;
  /** Общее количество страниц */
  totalPages: number;
  /** Флаг наличия следующей страницы */
  hasNextPage: boolean;
  /** Флаг наличия предыдущей страницы */
  hasPreviousPage: boolean;
}

/**
 * Обобщенный ответ со списком элементов и пагинацией.
 */
export interface PaginatedResponse<T> {
  /** Массив элементов */
  items: T[];
  /** Метаданные пагинации */
  meta: PaginationMeta;
}
