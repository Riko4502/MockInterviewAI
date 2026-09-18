// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "./input";

describe("Input Component", () => {
  afterEach(cleanup);

  describe("Базовый рендеринг и стандартные атрибуты", () => {
    it("рендерит обычный текстовый input с data-slot и базовыми классами", () => {
      render(<Input placeholder="Введите текст" />);
      const input = screen.getByPlaceholderText(
        "Введите текст",
      ) as HTMLInputElement;

      expect(input).toBeDefined();
      expect(input.getAttribute("data-slot")).toBe("input");
      expect(input.className).toContain("h-[46px]");
    });

    it("объединяет переданный className с дефолтными классами", () => {
      render(<Input placeholder="Custom" className="custom-test-class" />);
      const input = screen.getByPlaceholderText("Custom");
      expect(input.className).toContain("custom-test-class");
      expect(input.className).toContain("border");
    });

    it("поддерживает передачу различных HTML-типов (email, text, search)", () => {
      const { rerender } = render(<Input type="email" placeholder="Email" />);
      expect(screen.getByPlaceholderText("Email").getAttribute("type")).toBe(
        "email",
      );

      rerender(<Input type="search" placeholder="Search" />);
      expect(screen.getByPlaceholderText("Search").getAttribute("type")).toBe(
        "search",
      );
    });

    it("поддерживает состояния disabled и readOnly", () => {
      const { rerender } = render(<Input placeholder="State" disabled />);
      const input = screen.getByPlaceholderText("State") as HTMLInputElement;
      expect(input.disabled).toBe(true);

      rerender(<Input placeholder="State" readOnly />);
      expect(input.readOnly).toBe(true);
    });

    it("поддерживает aria-invalid", () => {
      render(<Input placeholder="Valid" aria-invalid={true} />);
      const input = screen.getByPlaceholderText("Valid");
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });

    it("корректно пробрасывает ref на HTMLInputElement", () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Input ref={ref} placeholder="Ref test" />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.placeholder).toBe("Ref test");
    });

    it("вызывает обработчики onChange, onFocus, onBlur", () => {
      const handleChange = vi.fn();
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();

      render(
        <Input
          placeholder="Events"
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />,
      );
      const input = screen.getByPlaceholderText("Events");

      fireEvent.focus(input);
      expect(handleFocus).toHaveBeenCalledTimes(1);

      fireEvent.change(input, { target: { value: "Hello" } });
      expect(handleChange).toHaveBeenCalledTimes(1);

      fireEvent.blur(input);
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('Поле пароля (type="password")', () => {
    it("рендерит кнопку переключения видимости пароля с дефолтными подписями", () => {
      render(<Input type="password" placeholder="Password" />);
      const input = screen.getByPlaceholderText("Password") as HTMLInputElement;
      const toggleBtn = screen.getByRole("button", { name: "Show password" });

      expect(input.getAttribute("type")).toBe("password");
      expect(toggleBtn).toBeDefined();
    });

    it("поддерживает кастомные подписи showPasswordLabel и hidePasswordLabel", () => {
      render(
        <Input
          type="password"
          placeholder="Password"
          showPasswordLabel="Показать пароль"
          hidePasswordLabel="Скрыть пароль"
        />,
      );

      const showBtn = screen.getByRole("button", { name: "Показать пароль" });
      expect(showBtn).toBeDefined();

      fireEvent.click(showBtn);
      const hideBtn = screen.getByRole("button", { name: "Скрыть пароль" });
      expect(hideBtn).toBeDefined();
    });

    it("переключает тип поля между password и text при клике на кнопку", () => {
      render(<Input type="password" placeholder="Password" />);
      const input = screen.getByPlaceholderText("Password") as HTMLInputElement;
      const toggleBtn = screen.getByRole("button", { name: "Show password" });

      fireEvent.click(toggleBtn);
      expect(input.getAttribute("type")).toBe("text");
      expect(
        screen.getByRole("button", { name: "Hide password" }),
      ).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
      expect(input.getAttribute("type")).toBe("password");
      expect(
        screen.getByRole("button", { name: "Show password" }),
      ).toBeDefined();
    });

    it("сохраняет кнопку в порядке клавиатурной навигации (не имеет tabindex=-1)", () => {
      render(<Input type="password" placeholder="Password" />);
      const toggleBtn = screen.getByRole("button", {
        name: "Show password",
      }) as HTMLButtonElement;

      expect(toggleBtn.getAttribute("tabindex")).toBeNull();
      expect(toggleBtn.tabIndex).toBe(0);

      toggleBtn.focus();
      expect(document.activeElement).toBe(toggleBtn);
    });

    it("блокирует кнопку переключения пароля при disabled={true}", () => {
      render(<Input type="password" placeholder="Password" disabled />);
      const toggleBtn = screen.getByRole("button", {
        name: "Show password",
      }) as HTMLButtonElement;

      expect(toggleBtn.disabled).toBe(true);
    });

    it("добавляет класс отступа pr-10 для предотвращения наложения текста на иконку", () => {
      render(<Input type="password" placeholder="Password" />);
      const input = screen.getByPlaceholderText("Password");
      expect(input.className).toContain("pr-10");
    });
  });

  describe('Числовое поле (type="number") и stepper', () => {
    it("по умолчанию рендерит кастомный stepper со стрелками увеличения и уменьшения", () => {
      render(<Input type="number" placeholder="Count" />);
      const input = screen.getByPlaceholderText("Count");
      const upBtn = screen.getByRole("button", { name: "Увеличить значение" });
      const downBtn = screen.getByRole("button", {
        name: "Уменьшить значение",
      });

      expect(upBtn).toBeDefined();
      expect(downBtn).toBeDefined();
      expect(input.className).toContain("pr-8");
      // Стрелки степпера исключены из Tab-навигации
      expect(upBtn.getAttribute("tabindex")).toBe("-1");
      expect(downBtn.getAttribute("tabindex")).toBe("-1");
    });

    it("не рендерит stepper, если showStepper={false}", () => {
      render(<Input type="number" placeholder="Count" showStepper={false} />);
      expect(
        screen.queryByRole("button", { name: "Увеличить значение" }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Уменьшить значение" }),
      ).toBeNull();
      expect(screen.getByPlaceholderText("Count").className).not.toContain(
        "pr-8",
      );
    });

    it("увеличивает и уменьшает значение при клике на стрелки stepper", () => {
      const handleInput = vi.fn();
      const handleChange = vi.fn();

      render(
        <Input
          type="number"
          placeholder="Count"
          defaultValue="10"
          onInput={handleInput}
          onChange={handleChange}
        />,
      );
      const input = screen.getByPlaceholderText("Count") as HTMLInputElement;
      const upBtn = screen.getByRole("button", { name: "Увеличить значение" });
      const downBtn = screen.getByRole("button", {
        name: "Уменьшить значение",
      });

      fireEvent.click(upBtn);
      expect(input.value).toBe("11");
      expect(handleInput).toHaveBeenCalled();
      expect(handleChange).toHaveBeenCalled();

      fireEvent.click(downBtn);
      expect(input.value).toBe("10");
    });

    it("при пустом значении stepper начинает отсчет от 0", () => {
      render(<Input type="number" placeholder="Count" />);
      const input = screen.getByPlaceholderText("Count") as HTMLInputElement;
      const upBtn = screen.getByRole("button", { name: "Увеличить значение" });

      fireEvent.click(upBtn);
      expect(input.value).toBe("1");
    });

    it("учитывает кастомный шаг step", () => {
      render(
        <Input type="number" placeholder="Count" defaultValue="10" step={5} />,
      );
      const input = screen.getByPlaceholderText("Count") as HTMLInputElement;
      const upBtn = screen.getByRole("button", { name: "Увеличить значение" });
      const downBtn = screen.getByRole("button", {
        name: "Уменьшить значение",
      });

      fireEvent.click(upBtn);
      expect(input.value).toBe("15");

      fireEvent.click(downBtn);
      fireEvent.click(downBtn);
      expect(input.value).toBe("5");
    });

    it("ограничивает значение рамками min и max", () => {
      render(
        <Input
          type="number"
          placeholder="Count"
          defaultValue="9"
          min={0}
          max={10}
        />,
      );
      const input = screen.getByPlaceholderText("Count") as HTMLInputElement;
      const upBtn = screen.getByRole("button", { name: "Увеличить значение" });
      const downBtn = screen.getByRole("button", {
        name: "Уменьшить значение",
      });

      fireEvent.click(upBtn);
      expect(input.value).toBe("10");

      // Не может превысить max
      fireEvent.click(upBtn);
      expect(input.value).toBe("10");

      // Уменьшаем до min
      for (let i = 0; i < 15; i++) {
        fireEvent.click(downBtn);
      }
      expect(input.value).toBe("0");
    });

    it("stepper отключен при disabled={true} или readOnly={true}", () => {
      const { rerender } = render(
        <Input type="number" placeholder="Count" defaultValue="5" disabled />,
      );
      const input = screen.getByPlaceholderText("Count") as HTMLInputElement;
      const upBtn = screen.getByRole("button", {
        name: "Увеличить значение",
      }) as HTMLButtonElement;
      const downBtn = screen.getByRole("button", {
        name: "Уменьшить значение",
      }) as HTMLButtonElement;

      expect(upBtn.disabled).toBe(true);
      expect(downBtn.disabled).toBe(true);
      fireEvent.click(upBtn);
      expect(input.value).toBe("5");

      rerender(
        <Input type="number" placeholder="Count" defaultValue="5" readOnly />,
      );
      expect(upBtn.disabled).toBe(true);
      expect(downBtn.disabled).toBe(true);
      fireEvent.click(upBtn);
      expect(input.value).toBe("5");
    });
  });

  describe('Валидация клавиатурного ввода и вставки при type="number"', () => {
    it("разрешает ввод цифр и навигационных клавиш", () => {
      const handleKeyDown = vi.fn();
      render(
        <Input type="number" placeholder="Number" onKeyDown={handleKeyDown} />,
      );
      const input = screen.getByPlaceholderText("Number");

      const digitEvent = fireEvent.keyDown(input, { key: "5" });
      expect(digitEvent).toBe(true);

      const backspaceEvent = fireEvent.keyDown(input, { key: "Backspace" });
      expect(backspaceEvent).toBe(true);

      const arrowEvent = fireEvent.keyDown(input, { key: "ArrowLeft" });
      expect(arrowEvent).toBe(true);

      const tabEvent = fireEvent.keyDown(input, { key: "Tab" });
      expect(tabEvent).toBe(true);

      expect(handleKeyDown).toHaveBeenCalledTimes(4);
    });

    it("блокирует ввод нечисловых символов (букв, спецсимволов)", () => {
      render(<Input type="number" placeholder="Number" />);
      const input = screen.getByPlaceholderText("Number");

      const letterEvent = fireEvent.keyDown(input, { key: "a" });
      expect(letterEvent).toBe(false); // defaultPrevented

      const specialEvent = fireEvent.keyDown(input, { key: "!" });
      expect(specialEvent).toBe(false);
    });

    it("разрешает знак минус только если min отрицательный или не задан", () => {
      const { rerender } = render(<Input type="number" placeholder="Number" />);
      const input = screen.getByPlaceholderText("Number");

      // Без min - минус разрешен
      expect(fireEvent.keyDown(input, { key: "-" })).toBe(true);

      // min < 0 - минус разрешен
      rerender(<Input type="number" placeholder="Number" min={-10} />);
      expect(fireEvent.keyDown(input, { key: "-" })).toBe(true);

      // min >= 0 - минус заблокирован
      rerender(<Input type="number" placeholder="Number" min={0} />);
      expect(fireEvent.keyDown(input, { key: "-" })).toBe(false);
    });

    it("разрешает точку/запятую только если step допускает дробные числа", () => {
      const { rerender } = render(<Input type="number" placeholder="Number" />);
      const input = screen.getByPlaceholderText("Number");

      // step не задан - дробные разрешены
      expect(fireEvent.keyDown(input, { key: "." })).toBe(true);
      expect(fireEvent.keyDown(input, { key: "," })).toBe(true);

      // step с точкой (0.5) - разрешены
      rerender(<Input type="number" placeholder="Number" step={0.5} />);
      expect(fireEvent.keyDown(input, { key: "." })).toBe(true);

      // step целочисленный (1) - заблокированы
      rerender(<Input type="number" placeholder="Number" step={1} />);
      expect(fireEvent.keyDown(input, { key: "." })).toBe(false);
      expect(fireEvent.keyDown(input, { key: "," })).toBe(false);
    });

    it("разрешает сочетания клавиш с Ctrl / Meta (Ctrl+A, Ctrl+C, Ctrl+V)", () => {
      render(<Input type="number" placeholder="Number" />);
      const input = screen.getByPlaceholderText("Number");

      expect(fireEvent.keyDown(input, { key: "a", ctrlKey: true })).toBe(true);
      expect(fireEvent.keyDown(input, { key: "c", metaKey: true })).toBe(true);
    });

    it('валидирует вставку из буфера (handlePaste) для type="number"', () => {
      const handlePaste = vi.fn();
      render(
        <Input type="number" placeholder="Number" onPaste={handlePaste} />,
      );
      const input = screen.getByPlaceholderText("Number");

      // Валидное число
      const validPaste = fireEvent.paste(input, {
        clipboardData: { getData: () => "123.45" },
      });
      expect(validPaste).toBe(true);
      expect(handlePaste).toHaveBeenCalledTimes(1);

      // Невалидная строка (с буквами)
      const invalidPaste = fireEvent.paste(input, {
        clipboardData: { getData: () => "12abc34" },
      });
      expect(invalidPaste).toBe(false); // defaultPrevented
    });
  });
});
