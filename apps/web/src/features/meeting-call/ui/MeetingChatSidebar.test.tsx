import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessageData } from "../model/types";
import { MeetingChatSidebar } from "./MeetingChatSidebar";

describe("MeetingChatSidebar", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockMessages: ChatMessageData[] = [
    {
      type: "CHAT_MESSAGE",
      id: "msg-1",
      senderId: "user-1",
      senderName: "Иван",
      text: "Привет! Ссылка на схему: https://example.com/spec",
      timestamp: new Date().toISOString(),
    },
  ];

  it("рендерит список сообщений и кликабельную ссылку", () => {
    render(
      <MeetingChatSidebar
        open={true}
        onClose={vi.fn()}
        messages={mockMessages}
        onSendMessage={vi.fn()}
      />,
    );

    expect(screen.getByText(/Иван/)).toBeInTheDocument();
    expect(screen.getByText("https://example.com/spec")).toHaveAttribute(
      "href",
      "https://example.com/spec",
    );
  });

  it("отправляет сообщение по нажатию кнопки Отправить", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(
      <MeetingChatSidebar
        open={true}
        onClose={vi.fn()}
        messages={[]}
        onSendMessage={onSend}
      />,
    );

    const input = screen.getByPlaceholderText(/Сообщение\.\.\./);
    await user.type(input, "Новое сообщение");

    const sendBtn = screen.getByText("Отправить");
    await user.click(sendBtn);

    expect(onSend).toHaveBeenCalledWith("Новое сообщение");
  });
});
