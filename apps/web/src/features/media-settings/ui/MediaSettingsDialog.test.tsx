import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { MediaSettingsDialog } from "./MediaSettingsDialog";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

describe("MediaSettingsDialog", () => {
  beforeAll(() => {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    i18n.changeLanguage("ru");
  });

  it("renders audio volume, speech volume and device selectors when open", () => {
    renderWithQueryClient(
      <MediaSettingsDialog open={true} onOpenChange={vi.fn()} />,
    );

    // Title & tabs
    expect(
      screen.getByText(/Настройки звука и видео|Audio & Video Settings/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Звук и речь|Audio & Speech/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Камера|Camera/i }),
    ).toBeInTheDocument();

    // Volume sliders
    expect(
      screen.getByLabelText(/Громкость аудио|Audio volume/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Громкость речи|Speech volume/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        /Чувствительность микрофона|Microphone sensitivity/i,
      ),
    ).toBeInTheDocument();

    // Test sound button
    expect(screen.getByText(/Проверить звук|Test sound/i)).toBeInTheDocument();
  });

  it("switches to camera tab and displays camera device selection", () => {
    renderWithQueryClient(
      <MediaSettingsDialog open={true} onOpenChange={vi.fn()} />,
    );

    const cameraTab = screen.getByRole("tab", { name: /Камера|Camera/i });
    fireEvent.click(cameraTab);

    expect(screen.getByText(/Камера|Camera/i)).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when done button is clicked", () => {
    const handleOpenChange = vi.fn();
    renderWithQueryClient(
      <MediaSettingsDialog open={true} onOpenChange={handleOpenChange} />,
    );

    const doneButton = screen.getByRole("button", { name: /Готово|Done/i });
    fireEvent.click(doneButton);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
