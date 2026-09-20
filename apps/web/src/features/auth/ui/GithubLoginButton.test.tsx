import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/entities/session", () => ({
  useSession: () => ({ startSession: vi.fn() }),
}));

describe("Переход к авторизации через GitHub", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com/");
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("ru");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([
    [
      "login",
      LoginForm,
      "ru",
      "\u0412\u043e\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 GitHub",
    ],
    [
      "register",
      RegisterForm,
      "ru",
      "\u0412\u043e\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 GitHub",
    ],
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
    const link = screen.getByRole("link", { name: label });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute(
      "href",
      "https://api.example.com/api/v1/auth/github",
    );
    expect(link).not.toHaveAttribute("target");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(fetch).not.toHaveBeenCalled();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    client.clear();
  });
});
