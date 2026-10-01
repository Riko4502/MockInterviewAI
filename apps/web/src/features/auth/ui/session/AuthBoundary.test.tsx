import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_STATUS,
  type SessionStatus,
} from "@/entities/session/model/constants";
import { paths } from "@/shared/config";
import { AuthBoundary, getSafeReturnTo } from "./AuthBoundary";

const replaceMock = vi.fn();
let mockPathname = "/dashboard";
let mockSearchParams = new URLSearchParams();
let mockSessionValue: {
  status: SessionStatus;
  isAuthenticated: boolean;
  startSession: () => void;
  clearSession: () => void;
} = {
  status: SESSION_STATUS.INITIALIZING,
  isAuthenticated: false,
  startSession: vi.fn(),
  clearSession: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/entities/session", () => ({
  useSession: () => mockSessionValue,
}));

describe("getSafeReturnTo helper", () => {
  it("возвращает /dashboard для null/empty", () => {
    expect(getSafeReturnTo(null)).toBe(paths.dashboard);
    expect(getSafeReturnTo("")).toBe(paths.dashboard);
  });

  it("разрешает валидный локальный путь", () => {
    expect(getSafeReturnTo("/dashboard/interviews")).toBe(
      "/dashboard/interviews",
    );
    expect(getSafeReturnTo("/dashboard/statistics")).toBe(
      "/dashboard/statistics",
    );
  });

  it("отвергает внешние URL (https/http)", () => {
    expect(getSafeReturnTo("https://evil.example")).toBe(paths.dashboard);
    expect(getSafeReturnTo("http://evil.example")).toBe(paths.dashboard);
  });

  it("отвергает protocol-relative URLs (//)", () => {
    expect(getSafeReturnTo("//evil.example")).toBe(paths.dashboard);
    expect(getSafeReturnTo("//evil.example/dashboard")).toBe(paths.dashboard);
  });

  it("отвергает javascript: и data: схемы", () => {
    expect(getSafeReturnTo("javascript:alert(1)")).toBe(paths.dashboard);
  });

  it("отвергает обратные слэши", () => {
    expect(getSafeReturnTo("/\\evil.example")).toBe(paths.dashboard);
  });
});

describe("AuthBoundary Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/dashboard";
    mockSearchParams = new URLSearchParams();
  });

  describe("PROTECTED mode", () => {
    it("1. INITIALIZING: children не отображаются, отображается loading indicator", () => {
      mockSessionValue = {
        status: SESSION_STATUS.INITIALIZING,
        isAuthenticated: false,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="protected">
          <div data-testid="protected-content">Protected Dashboard Content</div>
        </AuthBoundary>,
      );

      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
      expect(screen.getByTestId("auth-boundary-loading")).toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("2. AUTHENTICATED: children отображаются, редирект не вызывается", () => {
      mockSessionValue = {
        status: SESSION_STATUS.AUTHENTICATED,
        isAuthenticated: true,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="protected">
          <div data-testid="protected-content">Protected Dashboard Content</div>
        </AuthBoundary>,
      );

      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
      expect(
        screen.queryByTestId("auth-boundary-loading"),
      ).not.toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("3. UNAUTHENTICATED: выполняется redirect на /login?returnTo=/dashboard, children не отображаются", () => {
      mockSessionValue = {
        status: SESSION_STATUS.UNAUTHENTICATED,
        isAuthenticated: false,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="protected">
          <div data-testid="protected-content">Protected Dashboard Content</div>
        </AuthBoundary>,
      );

      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
      expect(replaceMock).toHaveBeenCalledWith(
        `${paths.login}?returnTo=/dashboard`,
      );
    });

    it("4. returnTo сохраняется для вложенных роутов (/dashboard/interviews)", () => {
      mockPathname = "/dashboard/interviews";
      mockSessionValue = {
        status: SESSION_STATUS.UNAUTHENTICATED,
        isAuthenticated: false,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="protected">
          <div data-testid="protected-content">Protected Content</div>
        </AuthBoundary>,
      );

      expect(replaceMock).toHaveBeenCalledWith(
        `${paths.login}?returnTo=/dashboard/interviews`,
      );
    });

    it("5. ERROR: protected content не отображается, выполняется redirect на /login?returnTo=...", () => {
      mockSessionValue = {
        status: SESSION_STATUS.ERROR,
        isAuthenticated: false,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="protected">
          <div data-testid="protected-content">Protected Dashboard Content</div>
        </AuthBoundary>,
      );

      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
      expect(replaceMock).toHaveBeenCalledWith(
        `${paths.login}?returnTo=/dashboard`,
      );
    });
  });

  describe("GUEST mode", () => {
    it("6. INITIALIZING: children не отображаются, отображается loading indicator", () => {
      mockSessionValue = {
        status: SESSION_STATUS.INITIALIZING,
        isAuthenticated: false,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="guest">
          <div data-testid="guest-content">Login Form Content</div>
        </AuthBoundary>,
      );

      expect(screen.queryByTestId("guest-content")).not.toBeInTheDocument();
      expect(screen.getByTestId("auth-boundary-loading")).toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("7. UNAUTHENTICATED: guest children отображаются, редирект не вызывается", () => {
      mockSessionValue = {
        status: SESSION_STATUS.UNAUTHENTICATED,
        isAuthenticated: false,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="guest">
          <div data-testid="guest-content">Login Form Content</div>
        </AuthBoundary>,
      );

      expect(screen.getByTestId("guest-content")).toBeInTheDocument();
      expect(
        screen.queryByTestId("auth-boundary-loading"),
      ).not.toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("8. AUTHENTICATED: редирект на /dashboard, guest content скрыт", () => {
      mockSessionValue = {
        status: SESSION_STATUS.AUTHENTICATED,
        isAuthenticated: true,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="guest">
          <div data-testid="guest-content">Login Form Content</div>
        </AuthBoundary>,
      );

      expect(screen.queryByTestId("guest-content")).not.toBeInTheDocument();
      expect(replaceMock).toHaveBeenCalledWith(paths.dashboard);
    });

    it("9. AUTHENTICATED с валидным returnTo: редирект на returnTo", () => {
      mockSearchParams = new URLSearchParams({
        returnTo: "/dashboard/interviews",
      });
      mockSessionValue = {
        status: SESSION_STATUS.AUTHENTICATED,
        isAuthenticated: true,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="guest">
          <div data-testid="guest-content">Login Form Content</div>
        </AuthBoundary>,
      );

      expect(replaceMock).toHaveBeenCalledWith("/dashboard/interviews");
    });

    it("10. AUTHENTICATED с внешним/небезопасным returnTo: редирект на fallback /dashboard", () => {
      mockSearchParams = new URLSearchParams({
        returnTo: "https://evil.example.com",
      });
      mockSessionValue = {
        status: SESSION_STATUS.AUTHENTICATED,
        isAuthenticated: true,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="guest">
          <div data-testid="guest-content">Login Form Content</div>
        </AuthBoundary>,
      );

      expect(replaceMock).toHaveBeenCalledWith(paths.dashboard);
    });

    it("11. ERROR: guest content отображается (пользователь может повторить логин)", () => {
      mockSessionValue = {
        status: SESSION_STATUS.ERROR,
        isAuthenticated: false,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="guest">
          <div data-testid="guest-content">Login Form Content</div>
        </AuthBoundary>,
      );

      expect(screen.getByTestId("guest-content")).toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });
  });

  describe("OPTIONAL mode", () => {
    it("12. INITIALIZING: children не отображаются, отображается loading indicator, редирект не вызывается", () => {
      mockSessionValue = {
        status: SESSION_STATUS.INITIALIZING,
        isAuthenticated: false,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="optional">
          <div data-testid="optional-content">
            Optional Public/Protected Page
          </div>
        </AuthBoundary>,
      );

      expect(screen.queryByTestId("optional-content")).not.toBeInTheDocument();
      expect(screen.getByTestId("auth-boundary-loading")).toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("13. AUTHENTICATED: children отображаются, редирект НЕ вызывается (ни на /login, ни на /dashboard)", () => {
      mockSessionValue = {
        status: SESSION_STATUS.AUTHENTICATED,
        isAuthenticated: true,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="optional">
          <div data-testid="optional-content">
            Optional Public/Protected Page
          </div>
        </AuthBoundary>,
      );

      expect(screen.getByTestId("optional-content")).toBeInTheDocument();
      expect(
        screen.queryByTestId("auth-boundary-loading"),
      ).not.toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("14. UNAUTHENTICATED: children отображаются, редирект НЕ вызывается (ни на /login, ни на /dashboard)", () => {
      mockSessionValue = {
        status: SESSION_STATUS.UNAUTHENTICATED,
        isAuthenticated: false,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="optional">
          <div data-testid="optional-content">
            Optional Public/Protected Page
          </div>
        </AuthBoundary>,
      );

      expect(screen.getByTestId("optional-content")).toBeInTheDocument();
      expect(
        screen.queryByTestId("auth-boundary-loading"),
      ).not.toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("15. ERROR: children отображаются, редирект НЕ вызывается", () => {
      mockSessionValue = {
        status: SESSION_STATUS.ERROR,
        isAuthenticated: false,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="optional">
          <div data-testid="optional-content">
            Optional Public/Protected Page
          </div>
        </AuthBoundary>,
      );

      expect(screen.getByTestId("optional-content")).toBeInTheDocument();
      expect(
        screen.queryByTestId("auth-boundary-loading"),
      ).not.toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it("16. Наличие returnTo в URL не вызывает redirect в optional режиме", () => {
      mockSearchParams = new URLSearchParams({
        returnTo: "/dashboard/interviews",
      });
      mockSessionValue = {
        status: SESSION_STATUS.AUTHENTICATED,
        isAuthenticated: true,
        startSession: vi.fn(),
        clearSession: vi.fn(),
      };

      render(
        <AuthBoundary mode="optional">
          <div data-testid="optional-content">
            Optional Public/Protected Page
          </div>
        </AuthBoundary>,
      );

      expect(screen.getByTestId("optional-content")).toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });
  });
});
