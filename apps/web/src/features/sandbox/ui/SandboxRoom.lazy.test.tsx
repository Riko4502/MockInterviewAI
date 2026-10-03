import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SandboxRoomLazy } from "./SandboxRoom.lazy";

vi.mock("./SandboxRoom", () => ({
  SandboxRoom: () => <div data-testid="sandbox-room-content">Sandbox Room</div>,
}));

describe("SandboxRoomLazy", () => {
  it("renders lazy loaded SandboxRoom component", async () => {
    render(<SandboxRoomLazy />);

    expect(
      await screen.findByTestId("sandbox-room-content", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});
