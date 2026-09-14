import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MOCK_INTERVIEW_TASKS } from "../model/tasks";
import { SandboxTaskPanel } from "./SandboxTaskPanel";

describe("SandboxTaskPanel", () => {
  const sampleTask = MOCK_INTERVIEW_TASKS[0]; // Two Sum

  it("should render task description, difficulty, examples and constraints", () => {
    render(
      <SandboxTaskPanel
        task={sampleTask}
        activeTab="description"
        onTabChange={vi.fn()}
        notes=""
        onNotesChange={vi.fn()}
        revealedHints={0}
        onRevealNextHint={vi.fn()}
      />,
    );

    expect(screen.getByText(sampleTask.title)).toBeInTheDocument();
    expect(screen.getByText(sampleTask.difficulty)).toBeInTheDocument();
    expect(screen.getByText(/Категория:/i)).toBeInTheDocument();
    expect(screen.getByText(/Примеры:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Ограничения \(Constraints\):/i),
    ).toBeInTheDocument();
  });

  it("should render AI hints tab and handle reveal button clicks", () => {
    const onRevealMock = vi.fn();

    render(
      <SandboxTaskPanel
        task={sampleTask}
        activeTab="hints"
        onTabChange={vi.fn()}
        notes=""
        onNotesChange={vi.fn()}
        revealedHints={1}
        onRevealNextHint={onRevealMock}
      />,
    );

    expect(screen.getByText(/Виртуальный AI-интервьюер/i)).toBeInTheDocument();
    expect(screen.getByText(/Подсказка #1/i)).toBeInTheDocument();
    expect(screen.getByText(/Открыта ✓/i)).toBeInTheDocument();

    const revealButton = screen.getByRole("button", {
      name: /Открыть следующую подсказку/i,
    });
    fireEvent.click(revealButton);

    expect(onRevealMock).toHaveBeenCalledTimes(1);
  });

  it("should render notes tab and handle textarea changes", () => {
    const onNotesChangeMock = vi.fn();

    render(
      <SandboxTaskPanel
        task={sampleTask}
        activeTab="notes"
        onTabChange={vi.fn()}
        notes="My test note"
        onNotesChange={onNotesChangeMock}
        revealedHints={0}
        onRevealNextHint={vi.fn()}
      />,
    );

    const textarea = screen.getByDisplayValue("My test note");
    fireEvent.change(textarea, { target: { value: "Updated note" } });

    expect(onNotesChangeMock).toHaveBeenCalledWith("Updated note");
  });
});
