import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShowcaseEmptyState } from "./ShowcaseEmptyState";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          "filters.emptyCatalogTitle": "Анкеты не найдены",
          "filters.emptyMyCardsTitle": "У вас пока нет анкет",
          "filters.emptyCatalogDescription":
            "Попробуйте изменить параметры поиска или фильтры",
          subtitle: "Найдите напарника для совместных тренировок",
          "filters.reset": "Сбросить фильтры",
          createCard: "Создать анкету",
        };
        return translations[key] ?? key;
      },
    }),
  };
});

describe("ShowcaseEmptyState", () => {
  it("показывает emptyCatalogTitle в нефильтрованном состоянии", () => {
    render(<ShowcaseEmptyState isFiltered={false} />);

    expect(screen.getByText("Анкеты не найдены")).toBeInTheDocument();
    expect(screen.queryByText("У вас пока нет анкет")).not.toBeInTheDocument();
  });

  it("показывает emptyCatalogTitle в отфильтрованном состоянии и кнопку сброса", () => {
    const handleReset = vi.fn();
    render(<ShowcaseEmptyState isFiltered onResetFilters={handleReset} />);

    expect(screen.getByText("Анкеты не найдены")).toBeInTheDocument();
    const resetButton = screen.getByRole("button", {
      name: "Сбросить фильтры",
    });
    expect(resetButton).toBeInTheDocument();

    fireEvent.click(resetButton);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});
