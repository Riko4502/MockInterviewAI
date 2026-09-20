import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import i18n from "@/shared/lib/i18n";
import { useSandboxStore } from "../model/useSandboxStore";
import { SandboxTaskPanel } from "./SandboxTaskPanel";

describe("SandboxTaskPanel", () => {
  beforeEach(() => {
    i18n.changeLanguage("ru");
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

    expect(screen.getAllByText(/Открыта ✓/i)).toHaveLength(2);
  });

  it("should render notes tab and handle textarea changes", () => {
    useSandboxStore.setState({ leftTab: "notes", notes: "My test note" });

    render(<SandboxTaskPanel />);

    const textarea = screen.getByDisplayValue("My test note");
    fireEvent.change(textarea, { target: { value: "Updated note" } });

    expect(screen.getByDisplayValue("Updated note")).toBeInTheDocument();
  });

  it("should render English localized strings when locale is set to en", () => {
    i18n.changeLanguage("en");

    render(<SandboxTaskPanel />);

    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("AI Hints")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();

    expect(screen.getByText(/Category:/i)).toBeInTheDocument();
    expect(screen.getByText(/Examples:/i)).toBeInTheDocument();
    expect(screen.getByText(/Example 1:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Input:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Output:/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Constraints:/i)).toBeInTheDocument();
  });
});
