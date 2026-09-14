import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSandboxStore } from "../model/useSandboxStore";
import { SandboxHeader } from "./SandboxHeader";

describe("SandboxHeader", () => {
  beforeEach(() => {
    useSandboxStore.getState().resetStore();
  });

  it("should render task selector, difficulty badge, invite button and timer", () => {
    const onCopyInviteMock = vi.fn();

    render(
      <SandboxHeader
        peerCount={2}
        isInCall={false}
        onCopyInvite={onCopyInviteMock}
        isInviteCopied={false}
      />,
    );

    const firstTask = useSandboxStore.getState().tasks[0];
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
    expect(useSandboxStore.getState().isTimerRunning).toBe(true);

    const runBtn = screen.getByRole("button", { name: /Run Code/i });
    expect(runBtn).toBeDisabled();
  });
});
