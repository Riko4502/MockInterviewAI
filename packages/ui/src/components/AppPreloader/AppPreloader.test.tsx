// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppPreloader } from "./AppPreloader";

describe("AppPreloader Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
  });

  it("renders loader initially and children in background", () => {
    render(
      <AppPreloader
        title="Loading"
        description="Please wait..."
        minDuration={1000}
        fadeDuration={500}
      >
        <div data-testid="page-content">Landing Content</div>
      </AppPreloader>,
    );

    expect(screen.getByTestId("page-content")).toBeDefined();
    expect(screen.getByTestId("app-preloader")).toBeDefined();
  });

  it("fades out after minDuration when isReady is true", () => {
    const onComplete = vi.fn();

    render(
      <AppPreloader
        title="Loading"
        description="Please wait..."
        isReady={true}
        minDuration={1000}
        fadeDuration={500}
        onComplete={onComplete}
      >
        <div data-testid="page-content">Landing Content</div>
      </AppPreloader>,
    );

    const preloader = screen.getByTestId("app-preloader");
    expect(preloader.className).toContain("opacity-100");

    // Advance past minDuration
    act(() => {
      vi.advanceTimersByTime(1001);
    });

    expect(preloader.className).toContain("opacity-0");
    expect(onComplete).not.toHaveBeenCalled();

    // Advance past fadeDuration
    act(() => {
      vi.advanceTimersByTime(501);
    });

    expect(screen.queryByTestId("app-preloader")).toBeNull();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not unmount if isReady is false even after minDuration", () => {
    const { rerender } = render(
      <AppPreloader
        title="Loading"
        description="Please wait..."
        isReady={false}
        minDuration={1000}
        fadeDuration={500}
      >
        <div data-testid="page-content">Content</div>
      </AppPreloader>,
    );

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    const preloader = screen.getByTestId("app-preloader");
    // Still rendered and visible because chunks/session are not ready yet
    expect(preloader.className).toContain("opacity-100");

    // Now chunks become ready
    rerender(
      <AppPreloader
        title="Loading"
        description="Please wait..."
        isReady={true}
        minDuration={1000}
        fadeDuration={500}
      >
        <div data-testid="page-content">Content</div>
      </AppPreloader>,
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(preloader.className).toContain("opacity-0");

    act(() => {
      vi.advanceTimersByTime(501);
    });
    expect(screen.queryByTestId("app-preloader")).toBeNull();
  });

  it("blocks user interaction on children using inert until unmounted", () => {
    render(
      <AppPreloader
        title="Loading"
        description="Please wait..."
        isReady={true}
        minDuration={500}
        fadeDuration={200}
      >
        <button type="button" data-testid="action-btn">
          Action
        </button>
      </AppPreloader>,
    );

    const btn = screen.getByTestId("action-btn");
    expect(btn.parentElement?.hasAttribute("inert")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(501);
    });
    expect(btn.parentElement?.hasAttribute("inert")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(201);
    });
    expect(btn.parentElement?.hasAttribute("inert")).toBe(false);
  });
});
