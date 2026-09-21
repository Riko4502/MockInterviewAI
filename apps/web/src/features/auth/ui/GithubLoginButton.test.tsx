import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initApiTransport, resetApiTransportState } from "@/shared/api/init";
import i18n from "@/shared/lib/i18n";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/entities/session", () => ({
  useSession: () => ({ startSession: vi.fn() }),
}));

describe("Переход к авторизации через GitHub", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ github: true })),
    );
    resetApiTransportState();
    initApiTransport();
  });
  afterEach(async () => {
    cleanup();
    resetApiTransportState();
    await i18n.changeLanguage("ru");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([
    ["login", LoginForm, "ru", "Продолжить через GitHub"],
    ["register", RegisterForm, "ru", "Продолжить через GitHub"],
    ["login", LoginForm, "en", "Continue with GitHub"],
    ["register", RegisterForm, "en", "Continue with GitHub"],
  ] as const)("форма %s предлагает браузерный переход к OAuth", async (_page, Form, locale, label) => {
    await i18n.changeLanguage(locale);
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <Form />
      </QueryClientProvider>,
    );
    const link = await screen.findByRole("link", { name: label });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute(
      "href",
      "https://api.example.com/api/v1/auth/github",
    );
    expect(link).not.toHaveAttribute("target");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/auth/oauth/providers",
      expect.objectContaining({ method: "GET" }),
    );
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    client.clear();
  });
  describe.each([
    LoginForm,
    RegisterForm,
  ])("availability on both forms", (Form) => {
    it.each([
      "disabled",
      "error",
      "loading",
    ])("hides GitHub while %s", async (state) => {
      if (state === "disabled")
        vi.mocked(fetch).mockResolvedValue(Response.json({ github: false }));
      if (state === "error")
        vi.mocked(fetch).mockRejectedValue(new Error("unavailable"));
      if (state === "loading")
        vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
      const client = new QueryClient();
      render(
        <QueryClientProvider client={client}>
          <Form />
        </QueryClientProvider>,
      );
      if (state !== "loading") {
        await waitFor(() => expect(client.isFetching()).toBe(0));
      }
      expect(
        screen.queryByRole("link", { name: /GitHub/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeVisible();
      cleanup();
      client.clear();
    });
  });
});
