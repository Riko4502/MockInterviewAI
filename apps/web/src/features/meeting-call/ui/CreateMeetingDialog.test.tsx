import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateMeetingDialog } from "./CreateMeetingDialog";

const mockCreateMeeting = vi.fn();
vi.mock("@packages/api", () => ({
  useSessionsControllerCreateMeeting: () => ({
    mutateAsync: mockCreateMeeting,
    isPending: false,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("CreateMeetingDialog", () => {
  beforeEach(() => {
    mockCreateMeeting.mockResolvedValue({ sessionId: "meeting-uuid-123" });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("вызывает создание встречи и показывает сгенерированную ссылку", async () => {
    const user = userEvent.setup();
    render(<CreateMeetingDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Создать мгновенную встречу")).toBeInTheDocument();

    const startBtn = screen.getByText("Начать встречу");
    await user.click(startBtn);

    expect(mockCreateMeeting).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Встреча создана!")).toBeInTheDocument();
    expect(screen.getByText("Перейти в комнату")).toBeInTheDocument();
  });
});
