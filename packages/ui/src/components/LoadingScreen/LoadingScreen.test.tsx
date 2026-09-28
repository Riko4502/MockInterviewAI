// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LoadingScreen } from "./LoadingScreen";

describe("LoadingScreen Component", () => {
  afterEach(cleanup);

  it("renders with default props and accessible role status", () => {
    render(<LoadingScreen />);

    const status = screen.getByRole("status");
    expect(status).toBeDefined();
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText("MockInterview AI")).toBeDefined();
    expect(
      screen.getByText("Подготовка рабочего пространства..."),
    ).toBeDefined();
    expect(screen.getByText("ПОДГОТОВКА СИСТЕМЫ")).toBeDefined();
  });

  it("renders custom title, description and steps", () => {
    const customSteps = ["Этап 1: Старт", "Этап 2: Финиш"];
    render(
      <LoadingScreen
        title="Custom Title"
        description="Custom Description"
        steps={customSteps}
        badgeText="CUSTOM BADGE"
        data-testid="my-loading-test"
      />,
    );

    expect(screen.getByTestId("my-loading-test")).toBeDefined();
    expect(screen.getByText("Custom Title")).toBeDefined();
    expect(screen.getByText("Custom Description")).toBeDefined();
    expect(screen.getByText("CUSTOM BADGE")).toBeDefined();
    expect(screen.getAllByText("Этап 1: Старт").length).toBeGreaterThan(0);
    expect(screen.getByText("Этап 2: Финиш")).toBeDefined();
  });

  it("supports contained variant", () => {
    const { container } = render(
      <LoadingScreen variant="contained" className="custom-contained" />,
    );

    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("custom-contained");
    expect(outer.className).toContain("min-h-[300px]");
  });
});
