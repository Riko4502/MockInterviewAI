import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSandboxStore } from "../model/useSandboxStore";
import { SandboxTaskPanel } from "./SandboxTaskPanel";

describe("SandboxTaskPanel", () => {
  beforeEach(() => {
    useSandboxStore.getState().resetStore();
  });

  it("should render task description, difficulty, examples and constraints", () => {
    render(<SandboxTaskPanel />);

    const sampleTask = useSandboxStore.getState().getCurrentTask();
    expect(screen.getByText(sampleTask.title)).toBeInTheDocument();
    expect(screen.getByText(sampleTask.difficulty)).toBeInTheDocument();
    expect(screen.getByText(/Категория:/i)).toBeInTheDocument();
    expect(screen.getByText(/Примеры:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Ограничения \(Constraints\):/i),
    ).toBeInTheDocument();
  });

  it("should render AI hints tab and handle reveal button clicks", () => {
    useSandboxStore.setState({ leftTab: "hints", revealedHints: 1 });

    render(<SandboxTaskPanel />);

    expect(screen.getByText(/Виртуальный AI-интервьюер/i)).toBeInTheDocument();
    expect(screen.getByText(/Подсказка #1/i)).toBeInTheDocument();
    expect(screen.getByText(/Открыта ✓/i)).toBeInTheDocument();

    const revealButton = screen.getByRole("button", {
      name: /Открыть следующую подсказку/i,
    });
    fireEvent.click(revealButton);

    expect(useSandboxStore.getState().revealedHints).toBe(2);
  });

  it("should render notes tab and handle textarea changes", () => {
    useSandboxStore.setState({ leftTab: "notes", notes: "My test note" });

    render(<SandboxTaskPanel />);

    const textarea = screen.getByDisplayValue("My test note");
    fireEvent.change(textarea, { target: { value: "Updated note" } });

    expect(useSandboxStore.getState().notes).toBe("Updated note");
  });
});
