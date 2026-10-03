import "@testing-library/jest-dom/vitest";
import { SystemPermission, SystemRole } from "@packages/types";
import { cleanup, render, screen } from "@testing-library/react";
import { type PropsWithChildren, type ReactNode, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_STATUS } from "@/entities/session";
import {
  SessionContext,
  type SessionContextValue,
} from "@/entities/session/model/context";
import { paths } from "@/shared/config";
import i18n from "@/shared/lib/i18n";

import { RoleBoundary } from "./RoleBoundary";

const router = { replace: vi.fn(), back: vi.fn() };
let pathname: string | null = "/restricted";
let session: SessionContextValue;
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => pathname,
}));
function Wrapper({ children }: PropsWithChildren) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
function mount(ui: ReactNode) {
  return render(ui, { wrapper: Wrapper });
}
beforeEach(async () => {
  vi.clearAllMocks();
  pathname = "/restricted";
  session = {
    status: SESSION_STATUS.AUTHENTICATED,
    isAuthenticated: true,
    role: SystemRole.USER,
    permissions: SystemPermission.NONE,
    userId: "user-1",
    isProfileLoading: false,
    startSession: vi.fn(),
    clearSession: vi.fn(),
  };
  await i18n.changeLanguage("ru");
});
afterEach(cleanup);

const secret = <div>Protected content</div>;
const denied = <div>Fallback content</div>;
function expectHidden() {
  expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
}

describe("RoleBoundary", () => {
  it.each([
    true,
    false,
  ])("denies access when profile loading ends without a role (fallback: %s)", (withFallback) => {
    session.role = null;
    session.isProfileLoading = true;
    const ui = (
      <RoleBoundary
        allowedRoles={[SystemRole.ADMIN]}
        fallback={withFallback ? denied : undefined}
      >
        {secret}
      </RoleBoundary>
    );
    const view = mount(ui);
    expectHidden();
    expect(screen.queryByText("Fallback content")).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();

    session = { ...session, isProfileLoading: false };
    view.rerender(ui);
    expectHidden();
    if (withFallback) {
      expect(screen.getByText("Fallback content")).toBeInTheDocument();
      expect(router.replace).not.toHaveBeenCalled();
    } else {
      expect(router.replace).toHaveBeenCalledExactlyOnceWith(paths.dashboard);
    }
  });
  it("Не монтирует содержимое и fallback и не перенаправляет при инициализации", () => {
    session.status = SESSION_STATUS.INITIALIZING;
    const child = vi.fn(() => secret);
    const Child = child;
    mount(
      <RoleBoundary allowedRoles={[SystemRole.USER]} fallback={denied}>
        <Child />
      </RoleBoundary>,
    );
    expect(child).not.toHaveBeenCalled();
    expect(screen.queryByText("Fallback content")).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it.each([
    SystemRole.ADMIN,
    SystemRole.USER,
  ])("Показывает содержимое авторизованному пользователю с разрешённой ролью %s", (role) => {
    session.role = role;
    mount(
      <RoleBoundary allowedRoles={[SystemRole.ADMIN, SystemRole.USER]}>
        {secret}
      </RoleBoundary>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("Запрещает доступ по роли даже при наличии разрешения администратора", () => {
    session.permissions = SystemPermission.ADMINISTRATOR;
    mount(
      <RoleBoundary allowedRoles={[SystemRole.ADMIN]}>{secret}</RoleBoundary>,
    );
    expectHidden();
    expect(router.replace).toHaveBeenCalledWith(paths.dashboard);
  });
  it("Показывает fallback вместо перенаправления", () => {
    mount(
      <RoleBoundary
        allowedRoles={[SystemRole.ADMIN]}
        fallback={denied}
        redirectTo="/elsewhere"
      >
        {secret}
      </RoleBoundary>,
    );
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("При fallback={null} не показывает содержимое и не перенаправляет", () => {
    mount(
      <RoleBoundary allowedRoles={[]} fallback={null}>
        {secret}
      </RoleBoundary>,
    );
    expectHidden();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("Перенаправляет на заданный адрес один раз при StrictMode и повторном рендере", () => {
    const ui = (
      <StrictMode>
        <RoleBoundary allowedRoles={[SystemRole.ADMIN]} redirectTo="/profile">
          {secret}
        </RoleBoundary>
      </StrictMode>
    );
    const view = mount(ui);
    view.rerender(ui);
    expectHidden();
    expect(router.replace).toHaveBeenCalledExactlyOnceWith("/profile");
  });
  it.each([
    SESSION_STATUS.UNAUTHENTICATED,
    SESSION_STATUS.ERROR,
  ])("Перенаправляет на вход при статусе %s даже с устаревшей разрешённой ролью", (status) => {
    session.status = status;
    session.isAuthenticated = false;
    // Устаревшая роль не должна открывать доступ без авторизации.
    session.role = SystemRole.ADMIN;
    mount(
      <RoleBoundary allowedRoles={[SystemRole.ADMIN]}>{secret}</RoleBoundary>,
    );
    expectHidden();
    expect(router.replace).toHaveBeenCalledWith(paths.login);
  });
  it("Ожидает загрузки роли и обновляет доступ при её изменении", () => {
    session.role = null;
    session.isProfileLoading = true;
    const ui = (
      <RoleBoundary allowedRoles={[SystemRole.ADMIN]}>{secret}</RoleBoundary>
    );
    const view = mount(ui);
    expectHidden();
    expect(router.replace).not.toHaveBeenCalled();
    session = { ...session, role: SystemRole.ADMIN, isProfileLoading: false };
    view.rerender(ui);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
    session = { ...session, role: SystemRole.USER };
    view.rerender(ui);
    expectHidden();
    expect(router.replace).toHaveBeenCalledWith(paths.dashboard);
  });
  it.each([
    "/restricted",
    "/restricted/",
    "/restricted?tab=1",
    "/restricted#section",
    "/other/../restricted",
  ])("Показывает отказ в доступе вместо перенаправления на текущую страницу %s", (redirectTo) => {
    mount(
      <RoleBoundary allowedRoles={[SystemRole.ADMIN]} redirectTo={redirectTo}>
        {secret}
      </RoleBoundary>,
    );
    expectHidden();
    expect(router.replace).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Доступ ограничен" }),
    ).toBeInTheDocument();
  });
  it("Не перенаправляет с текущей страницы на адрес по умолчанию, совпадающий с ней", () => {
    pathname = paths.dashboard;
    mount(<RoleBoundary allowedRoles={[]}>{secret}</RoleBoundary>);
    expectHidden();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it.each([
    paths.login,
    paths.register,
  ])("Предотвращает цикл перенаправлений авторизованного пользователя через %s", (redirectTo) => {
    mount(
      <RoleBoundary allowedRoles={[]} redirectTo={redirectTo}>
        {secret}
      </RoleBoundary>,
    );
    expect(router.replace).toHaveBeenCalledWith(paths.dashboard);
  });
  it.each([
    "https://example.com",
    "//example.com",
    "javascript:alert(1)",
    "/\\example.com",
  ])("Заменяет небезопасный адрес %s на главную страницу", (redirectTo) => {
    mount(
      <RoleBoundary allowedRoles={[]} redirectTo={redirectTo}>
        {secret}
      </RoleBoundary>,
    );
    expectHidden();
    expect(router.replace).toHaveBeenCalledExactlyOnceWith(paths.dashboard);
  });

  it("Ожидает pathname перед перенаправлением", () => {
    pathname = null;
    const view = mount(<RoleBoundary allowedRoles={[]}>{secret}</RoleBoundary>);
    expectHidden();
    expect(router.replace).not.toHaveBeenCalled();

    pathname = "/restricted";
    view.rerender(<RoleBoundary allowedRoles={[]}>{secret}</RoleBoundary>);
    expect(router.replace).toHaveBeenCalledExactlyOnceWith(paths.dashboard);
  });

  it("Повторяет перенаправление после восстановления и повторной потери доступа", () => {
    const ui = (
      <RoleBoundary allowedRoles={[SystemRole.ADMIN]}>{secret}</RoleBoundary>
    );
    const view = mount(ui);
    expectHidden();
    expect(router.replace).toHaveBeenCalledExactlyOnceWith(paths.dashboard);

    session = { ...session, role: SystemRole.ADMIN, isProfileLoading: false };
    view.rerender(ui);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledTimes(1);

    session = { ...session, role: SystemRole.USER };
    view.rerender(ui);
    expectHidden();
    expect(router.replace).toHaveBeenCalledTimes(2);
    expect(router.replace).toHaveBeenLastCalledWith(paths.dashboard);
  });
});
