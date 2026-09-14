import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { RunResult } from "../model/types";
import { useSandboxStore } from "../model/useSandboxStore";
import { SandboxConsolePanel } from "./SandboxConsolePanel";

describe("SandboxConsolePanel", () => {
  beforeEach(() => {
    useSandboxStore.getState().resetStore();
  });

  it("should render placeholder when code execution is disabled", () => {
    render(<SandboxConsolePanel />);

    expect(
      screen.getByText(/Запуск кода временно недоступен/i),
    ).toBeInTheDocument();
  });

  it("should render test results correctly", () => {
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

    expect(
      screen.getByText(/Все тест-кейсы успешно пройдены!/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Тест-кейс 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Тест-кейс 2/i)).toBeInTheDocument();
    expect(screen.getByText("24 ms")).toBeInTheDocument();
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
});
