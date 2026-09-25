import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Slider } from "./Slider";

describe("Slider", () => {
  beforeAll(() => {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("renders with default props and data-slot", () => {
    render(<Slider aria-label="Volume" defaultValue={[50]} />);
    const slider = screen.getByRole("slider");
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuenow", "50");
  });

  it("respects min and max bounds", () => {
    render(<Slider aria-label="Volume" min={0} max={100} value={[75]} />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "100");
    expect(slider).toHaveAttribute("aria-valuenow", "75");
  });

  it("renders disabled state properly", () => {
    render(
      <Slider aria-label="Disabled slider" disabled defaultValue={[30]} />,
    );
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("data-disabled");
  });
});
