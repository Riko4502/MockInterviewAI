// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./data-table";
import type { DataTableColumn, DataTableRow } from "./types";

interface UserRow extends DataTableRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

const testColumns: DataTableColumn<UserRow>[] = [
  { key: "name", header: "Имя", sortable: true },
  { key: "email", header: "Email", sortable: true },
  { key: "role", header: "Роль", sortable: false },
];

const mockUsers: UserRow[] = [
  { id: "1", name: "Alice", email: "alice@example.com", role: "ADMIN" },
  { id: "2", name: "Bob", email: "bob@example.com", role: "USER" },
  { id: "3", name: "Charlie", email: "charlie@example.com", role: "USER" },
  { id: "4", name: "David", email: "david@example.com", role: "USER" },
  { id: "5", name: "Eve", email: "eve@example.com", role: "USER" },
];

describe("DataTable Component", () => {
  afterEach(cleanup);

  describe("Базовый рендеринг", () => {
    it("рендерит заголовки и строки данных", () => {
      render(<DataTable data={mockUsers} columns={testColumns} />);

      expect(screen.getByText("Имя")).toBeDefined();
      expect(screen.getByText("Email")).toBeDefined();
      expect(screen.getByText("Роль")).toBeDefined();

      expect(screen.getByText("Alice")).toBeDefined();
      expect(screen.getByText("bob@example.com")).toBeDefined();
    });

    it("отображает emptyText при пустом массиве данных", () => {
      render(
        <DataTable
          data={[]}
          columns={testColumns}
          emptyText="Пользователи не найдены"
        />,
      );

      expect(screen.getByText("Пользователи не найдены")).toBeDefined();
    });
  });

  describe("Клиентская пагинация (по умолчанию)", () => {
    it("выполняет локальный срез данных и переключает страницы", () => {
      const onPageChange = vi.fn();

      render(
        <DataTable
          data={mockUsers}
          columns={testColumns}
          pagination={{
            page: 1,
            pageSize: 2,
            onPageChange,
          }}
        />,
      );

      // Страница 1 с pageSize 2: должны быть Alice и Bob
      expect(screen.getByText("Alice")).toBeDefined();
      expect(screen.getByText("Bob")).toBeDefined();
      expect(screen.queryByText("Charlie")).toBeNull();

      // Проверяем отображение общего количества
      expect(screen.getByText(/Всего записей:/)).toBeDefined();

      // Кликаем по странице 2
      const page2Button = screen.getByRole("button", { name: "2" });
      fireEvent.click(page2Button);

      expect(onPageChange).toHaveBeenCalledWith(2);
    });
  });

  describe("Серверная / внешняя пагинация (totalItems / totalPages)", () => {
    it("не делает локальный slice данных и использует переданные totalItems", () => {
      const onPageChange = vi.fn();
      // Сервер вернул только 2 записи для текущей страницы 2, но всего записей 10
      const serverPageData: UserRow[] = [
        {
          id: "3",
          name: "Charlie",
          email: "charlie@example.com",
          role: "USER",
        },
        { id: "4", name: "David", email: "david@example.com", role: "USER" },
      ];

      render(
        <DataTable
          data={serverPageData}
          columns={testColumns}
          pagination={{
            page: 2,
            pageSize: 2,
            totalItems: 10,
            onPageChange,
          }}
        />,
      );

      // Серверные данные должны отображаться полностью без дополнительного slice
      expect(screen.getByText("Charlie")).toBeDefined();
      expect(screen.getByText("David")).toBeDefined();

      // Общее количество отображается из totalItems
      expect(screen.getByText("10")).toBeDefined();

      // Должно быть 5 страниц (10 total / 2 pageSize)
      expect(screen.getByRole("button", { name: "5" })).toBeDefined();

      // Клик по странице 3 вызывает onPageChange с 3
      const page3Button = screen.getByRole("button", { name: "3" });
      fireEvent.click(page3Button);

      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it("корректно обрабатывает прямой пропс totalPages", () => {
      render(
        <DataTable
          data={mockUsers.slice(0, 2)}
          columns={testColumns}
          pagination={{
            page: 1,
            pageSize: 2,
            totalPages: 8,
          }}
        />,
      );

      // При totalPages = 8 должен отображаться эллипсис
      expect(screen.getByText("...")).toBeDefined();
      expect(screen.getByRole("button", { name: "8" })).toBeDefined();
    });
  });

  describe("Серверная сортировка (onSortChange)", () => {
    it("вызывает onSortChange при клике на сортируемую колонку без локального перемешивания", () => {
      const onSortChange = vi.fn();

      render(
        <DataTable
          data={mockUsers}
          columns={testColumns}
          sortState={{ columnKey: "name", direction: "asc" }}
          onSortChange={onSortChange}
        />,
      );

      const nameHeader = screen.getByRole("button", { name: /Имя/i });
      fireEvent.click(nameHeader);

      // Переключение asc -> desc
      expect(onSortChange).toHaveBeenCalledWith({
        columnKey: "name",
        direction: "desc",
      });
    });

    it("не вызывает onSortChange для несортируемых колонок", () => {
      const onSortChange = vi.fn();

      render(
        <DataTable
          data={mockUsers}
          columns={testColumns}
          onSortChange={onSortChange}
        />,
      );

      // Колонка "Роль" имеет sortable: false
      const roleHeader = screen.getByText("Роль");
      fireEvent.click(roleHeader);

      expect(onSortChange).not.toHaveBeenCalled();
    });
  });
});
