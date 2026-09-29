import "@testing-library/jest-dom/vitest";
import { SystemPermission, SystemRole } from "@packages/types";
import { cleanup, render, screen } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_STATUS } from "@/entities/session";
import {
  SessionContext,
  type SessionContextValue,
} from "@/entities/session/model/context";

import { RequirePermission } from "./RequirePermission";

const router = { replace: vi.fn(), back: vi.fn() };
let pathname = "/restricted";
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
beforeEach(() => {
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
});
afterEach(cleanup);

const secret = <div>Protected content</div>;
const denied = <div>Fallback content</div>;
function expectHidden() {
  expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
}

describe("RequirePermission", () => {
  it("Показывает содержимое при наличии нужного разрешения", () => {
    session.permissions =
      SystemPermission.USERS_READ | SystemPermission.USERS_MANAGE;
    mount(
      <RequirePermission permission={SystemPermission.USERS_READ}>
        {secret}
      </RequirePermission>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("Скрывает содержимое при отсутствии нужного разрешения", () => {
    mount(
      <RequirePermission permission={SystemPermission.USERS_MANAGE}>
        {secret}
      </RequirePermission>,
    );
    expectHidden();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("Показывает fallback без перенаправления при отказе в доступе", () => {
    mount(
      <RequirePermission
        permission={SystemPermission.USERS_MANAGE}
        fallback={denied}
      >
        {secret}
      </RequirePermission>,
    );
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("Разрешает доступ при наличии разрешения администратора", () => {
    session.permissions = SystemPermission.ADMINISTRATOR;
    mount(
      <RequirePermission permission={SystemPermission.ROLES_MANAGE}>
        {secret}
      </RequirePermission>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
  it("Не монтирует защищённый компонент без нужного разрешения", () => {
    const Child = vi.fn(() => secret);
    const { container } = mount(
      <RequirePermission permission={SystemPermission.USERS_READ}>
        <Child />
      </RequirePermission>,
    );
    expect(Child).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("Не монтирует fallback при разрешённом доступе", () => {
    session.permissions = SystemPermission.USERS_READ;
    const Fallback = vi.fn(() => denied);
    mount(
      <RequirePermission
        permission={SystemPermission.USERS_READ}
        fallback={<Fallback />}
      >
        {secret}
      </RequirePermission>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(Fallback).not.toHaveBeenCalled();
  });

  it("Ничего не отображает при отказе в доступе и fallback={null}", () => {
    const { container } = mount(
      <RequirePermission
        permission={SystemPermission.USERS_READ}
        fallback={null}
      >
        {secret}
      </RequirePermission>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("Требует все разрешения составной маски", () => {
    const permission =
      SystemPermission.USERS_READ | SystemPermission.USERS_MANAGE;
    session.permissions = SystemPermission.USERS_READ;
    const ui = (
      <RequirePermission permission={permission} fallback={denied}>
        {secret}
      </RequirePermission>
    );
    const view = mount(ui);
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();

    session = { ...session, permissions: permission };
    view.rerender(ui);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByText("Fallback content")).not.toBeInTheDocument();

    session = { ...session, permissions: SystemPermission.USERS_MANAGE };
    view.rerender(ui);
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
  });

  it("Роль администратора без разрешений не открывает доступ", () => {
    session.role = SystemRole.ADMIN;
    mount(
      <RequirePermission
        permission={SystemPermission.USERS_READ}
        fallback={denied}
      >
        {secret}
      </RequirePermission>,
    );
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
  });

  it.each([
    SESSION_STATUS.INITIALIZING,
    SESSION_STATUS.UNAUTHENTICATED,
    SESSION_STATUS.ERROR,
  ])("Не монтирует защищённый контент без авторизации при статусе %s даже с сохранёнными правами администратора", (status) => {
    session = {
      ...session,
      status,
      isAuthenticated: false,
      permissions: SystemPermission.ADMINISTRATOR,
    };
    const Child = vi.fn(() => secret);
    mount(
      <RequirePermission
        permission={SystemPermission.USERS_READ}
        fallback={denied}
      >
        <Child />
      </RequirePermission>,
    );
    expect(Child).not.toHaveBeenCalled();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("Пускает с пустой требуемой маской только авторизованного пользователя", () => {
    const ui = (
      <RequirePermission permission={SystemPermission.NONE} fallback={denied}>
        {secret}
      </RequirePermission>
    );
    const view = mount(ui);
    expect(screen.getByText("Protected content")).toBeInTheDocument();

    session = {
      ...session,
      status: SESSION_STATUS.UNAUTHENTICATED,
      isAuthenticated: false,
    };
    view.rerender(ui);
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
  });

  it("Обновляет доступ при изменении требуемого разрешения", () => {
    session.permissions = SystemPermission.USERS_READ;
    const view = mount(
      <RequirePermission permission={SystemPermission.USERS_READ}>
        {secret}
      </RequirePermission>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();

    view.rerender(
      <RequirePermission
        permission={SystemPermission.USERS_MANAGE}
        fallback={denied}
      >
        {secret}
      </RequirePermission>,
    );
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();

    view.rerender(
      <RequirePermission
        permission={SystemPermission.USERS_READ}
        fallback={denied}
      >
        {secret}
      </RequirePermission>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByText("Fallback content")).not.toBeInTheDocument();
  });

  it("Скрывает защищённый контент после выхода даже до очистки разрешений", () => {
    session.permissions = SystemPermission.USERS_READ;
    const ui = (
      <RequirePermission
        permission={SystemPermission.USERS_READ}
        fallback={denied}
      >
        {secret}
      </RequirePermission>
    );
    const view = mount(ui);
    expect(screen.getByText("Protected content")).toBeInTheDocument();

    session = {
      ...session,
      status: SESSION_STATUS.UNAUTHENTICATED,
      isAuthenticated: false,
    };
    view.rerender(ui);
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
