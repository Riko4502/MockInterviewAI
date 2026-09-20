import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import i18n from "@/shared/lib/i18n";
import type { RunResult } from "../model/types";
import { useSandboxStore } from "../model/useSandboxStore";
import { SandboxConsolePanel } from "./SandboxConsolePanel";

describe("SandboxConsolePanel", () => {
  beforeEach(() => {
    i18n.changeLanguage("ru");
    useSandboxStore.getState().resetStore();
  });

  it("should render placeholder when code execution is disabled", () => {
    render(<SandboxConsolePanel />);

    expect(
      screen.getByText(/Запуск кода временно недоступен/i),
    ).toBeInTheDocument();
  });

  it("should render test results correctly in Russian", () => {
    const mockResult: RunResult = {
      success: true,
      totalTests: 2,
      passedTests: 2,
      totalTimeMs: 24,
      logs: ["Log output 1"],
      results: [
        {
          testCaseId: "tc-1",
          passed: true,
          input: "nums = [2, 7], target = 9",
          expectedOutput: "[0, 1]",
          actualOutput: "[0, 1]",
          executionTimeMs: 5,
        },
        {
          testCaseId: "tc-2",
          passed: true,
          input: "nums = [3, 2, 4], target = 6",
          expectedOutput: "[1, 2]",
          actualOutput: "[1, 2]",
          executionTimeMs: 4,
        },
      ],
    };

    useSandboxStore.setState({ runResult: mockResult });

    render(<SandboxConsolePanel />);

    expect(screen.getByText(/Результаты тестов/i)).toBeInTheDocument();
    expect(screen.getByText(/Консоль \(Logs\)/i)).toBeInTheDocument();
    expect(screen.getByText("Время: 24 ms")).toBeInTheDocument();
    expect(
      screen.getByText(/Все тест-кейсы успешно пройдены!/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Тест-кейс 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Тест-кейс 2/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Вход:/i)).toHaveLength(2);
    expect(screen.getAllByText(/Ожидалось:/i)).toHaveLength(2);
    expect(screen.getAllByText(/Получено:/i)).toHaveLength(2);
  });

  it("should render empty console logs placeholder in Russian", () => {
    useSandboxStore.setState({ consoleTab: "logs" });

    render(<SandboxConsolePanel />);

    expect(
      screen.getByText(
        /Нет записей в консоли\. Используйте console\.log\(\) в коде\./i,
      ),
    ).toBeInTheDocument();
  });

  it("should render console logs tab output", () => {
    const mockResult: RunResult = {
      success: false,
      totalTests: 1,
      passedTests: 0,
      totalTimeMs: 12,
      logs: ["[ERROR] Something failed", "Regular log message"],
      results: [],
    };

    useSandboxStore.setState({ consoleTab: "logs", runResult: mockResult });

    render(<SandboxConsolePanel />);

    expect(screen.getByText(/\[ERROR\] Something failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Regular log message/i)).toBeInTheDocument();
  });

  it("should render properly with English locale", () => {
    i18n.changeLanguage("en");

    const mockResult: RunResult = {
      success: true,
      totalTests: 1,
      passedTests: 1,
      totalTimeMs: 18,
      logs: [],
      results: [
        {
          testCaseId: "tc-1",
          passed: true,
          input: "head = [1, 2]",
          expectedOutput: "[2, 1]",
          actualOutput: "[2, 1]",
          executionTimeMs: 6,
        },
      ],
    };

    useSandboxStore.setState({ runResult: mockResult });

    render(<SandboxConsolePanel />);

    expect(screen.getByText(/Test Results/i)).toBeInTheDocument();
    expect(screen.getByText(/Console \(Logs\)/i)).toBeInTheDocument();
    expect(screen.getByText("Time: 18 ms")).toBeInTheDocument();
    expect(
      screen.getByText(/All test cases passed successfully!/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Test case 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Input:/i)).toBeInTheDocument();
    expect(screen.getByText(/Expected:/i)).toBeInTheDocument();
    expect(screen.getByText(/Actual:/i)).toBeInTheDocument();
  });
});
