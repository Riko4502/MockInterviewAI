import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { AccessDenied } from "./AccessDenied";

const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));
beforeEach(async () => {
  back.mockClear();
  await i18n.changeLanguage("ru");
});
afterEach(cleanup);
describe("AccessDenied", () => {
  it("Показывает сообщение об ограничении доступа без провайдера сессии", () => {
    render(<AccessDenied />);
    expect(
      screen.getByText("У вас нет доступа к этому разделу."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Доступ ограничен" }),
    ).toBeInTheDocument();
  });
  it("Возвращает на предыдущую страницу через роутер Next.js по нажатию кнопки «Назад»", async () => {
    const user = userEvent.setup();
    render(<AccessDenied />);
    await user.click(screen.getByRole("button", { name: "Назад" }));
    expect(back).toHaveBeenCalledTimes(1);
  });
  it("Отображает заголовок и кнопку на выбранном языке", async () => {
    await i18n.changeLanguage("en");
    render(<AccessDenied />);
    expect(
      screen.getByRole("heading", { name: "Access restricted" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
  });
});
