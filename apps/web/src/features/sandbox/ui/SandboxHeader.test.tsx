import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MOCK_INTERVIEW_TASKS } from "../model/tasks";
import { SandboxHeader } from "./SandboxHeader";

describe("SandboxHeader", () => {
  it("should render task selector, difficulty badge, invite button and timer", () => {
    const onToggleTimerMock = vi.fn();
    const onRunCodeMock = vi.fn();
    const onCopyInviteMock = vi.fn();

    render(
      <SandboxHeader
        tasks={MOCK_INTERVIEW_TASKS}
        currentTaskId="two-sum"
        onTaskChange={vi.fn()}
        language="typescript"
        onLanguageChange={vi.fn()}
        theme="dark"
        onThemeToggle={vi.fn()}
        timerSeconds={45 * 60}
        isTimerRunning={false}
        onToggleTimer={onToggleTimerMock}
        onResetTimer={vi.fn()}
        onResetCode={vi.fn()}
        onRunCode={onRunCodeMock}
        isRunning={false}
        isVideoOpen={false}
        onToggleVideo={vi.fn()}
        peerCount={2}
        isInCall={false}
        onCopyInvite={onCopyInviteMock}
        isInviteCopied={false}
      />,
    );

    expect(screen.getByText(MOCK_INTERVIEW_TASKS[0].title)).toBeInTheDocument();
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
    expect(onToggleTimerMock).toHaveBeenCalledTimes(1);

    const runBtn = screen.getByRole("button", { name: /Run Code/i });
    fireEvent.click(runBtn);
    expect(onRunCodeMock).toHaveBeenCalledTimes(1);
  });
});
