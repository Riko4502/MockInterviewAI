import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { useSandboxStore } from "../model/useSandboxStore";
import { SandboxHeader } from "./SandboxHeader";

const { onCopyInviteMock, setAppThemeMock } = vi.hoisted(() => ({
  onCopyInviteMock: vi.fn(),
  setAppThemeMock: vi.fn(),
}));

vi.mock("@packages/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/ui")>();
  return {
    ...actual,
    useTheme: () => ({
      theme: "dark",
      resolvedTheme: "dark",
      setTheme: setAppThemeMock,
    }),
  };
});

vi.mock("../model/SandboxMediaContext", () => ({
  useSandboxMedia: () => ({
    peerCount: 2,
    isCallConnected: false,
    isInCall: false,
    isInviteCopied: false,
    onCopyInvite: onCopyInviteMock,
  }),
}));

describe("SandboxHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage("ru");
    useSandboxStore.getState().resetStore();
  });

  it("should render task selector, difficulty badge, invite button and timer in Russian", () => {
    render(<SandboxHeader />);

    const firstTask = useSandboxStore.getState().tasks[0];
    expect(screen.getByText("Задача:")).toBeInTheDocument();
    expect(screen.getByText(firstTask.title)).toBeInTheDocument();
    expect(screen.getByText("Easy")).toBeInTheDocument();
    expect(screen.getByText("45:00")).toBeInTheDocument();
    expect(screen.getByText("Онлайн: 2")).toBeInTheDocument();

    const inviteBtn = screen.getByRole("button", {
      name: /Пригласить собеседника/i,
    });
    fireEvent.click(inviteBtn);
    expect(onCopyInviteMock).toHaveBeenCalledTimes(1);

    const timerToggleBtn = screen.getByRole("button", { name: /Старт/i });
    fireEvent.click(timerToggleBtn);
    expect(screen.getByRole("button", { name: /Пауза/i })).toBeInTheDocument();

    const runBtn = screen.getByRole("button", { name: /Запуск кода/i });
    expect(runBtn).toBeDisabled();

    expect(
      screen.getByRole("button", { name: /^Сброс$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Видеозвонок/i }),
    ).toBeInTheDocument();
  });

  it("should render localized elements in English when locale is en", () => {
    i18n.changeLanguage("en");
    render(<SandboxHeader />);

    expect(screen.getByText("Task:")).toBeInTheDocument();
    expect(screen.getByText("Online: 2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Invite participant/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Start$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Reset$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Video call/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run Code/i })).toBeDisabled();
  });

  it("should trigger onRunCode when button is clicked and not running", () => {
    const handleRunCodeMock = vi.fn();
    render(<SandboxHeader onRunCode={handleRunCodeMock} />);

    const runBtn = screen.getByRole("button", { name: /Запуск кода/i });
    expect(runBtn).not.toBeDisabled();

    fireEvent.click(runBtn);
    expect(handleRunCodeMock).toHaveBeenCalledTimes(1);
  });

  it("should disable run button and display spinner when isRunning is true", () => {
    const handleRunCodeMock = vi.fn();
    useSandboxStore.setState({ isRunning: true });

    render(<SandboxHeader onRunCode={handleRunCodeMock} />);

    const runBtn = screen.getByRole("button", { name: /Выполнение/i });
    expect(runBtn).toBeDisabled();
    expect(screen.getByTestId("run-code-spinner")).toBeInTheDocument();

    fireEvent.click(runBtn);
    expect(handleRunCodeMock).not.toHaveBeenCalled();
  });

  it("should toggle editor theme when theme switch button is clicked", () => {
    useSandboxStore.setState({ theme: "dark" });
    render(<SandboxHeader />);

    const themeBtn = screen.getByRole("button", {
      name: /Текущая тема редактора: dark/i,
    });
    expect(themeBtn).toBeInTheDocument();

    fireEvent.click(themeBtn);
    expect(useSandboxStore.getState().theme).toBe("light");
    expect(setAppThemeMock).toHaveBeenCalledWith("light");
  });
});
