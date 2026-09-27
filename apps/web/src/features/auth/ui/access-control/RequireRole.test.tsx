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

import { RequireRole } from "./RequireRole";

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

describe("RequireRole", () => {
  it("Обновляет доступ при изменении списка разрешённых ролей", () => {
    const view = mount(
      <RequireRole allowedRoles={[SystemRole.ADMIN, SystemRole.USER]}>
        {secret}
      </RequireRole>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    view.rerender(
      <RequireRole allowedRoles={[SystemRole.ADMIN]}>{secret}</RequireRole>,
    );
    expectHidden();
    view.rerender(<RequireRole allowedRoles={[]}>{secret}</RequireRole>);
    expectHidden();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("Показывает fallback при запрещённой роли без перенаправления", () => {
    mount(
      <RequireRole allowedRoles={[SystemRole.ADMIN]} fallback={denied}>
        {secret}
      </RequireRole>,
    );
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("Скрывает содержимое, пока роль неизвестна", () => {
    session.role = null;
    mount(<RequireRole allowedRoles={[SystemRole.USER]}>{secret}</RequireRole>);
    expectHidden();
  });
  it.each([
    SystemRole.USER,
    SystemRole.ADMIN,
  ])("Показывает содержимое для разрешённой роли %s вместо fallback", (role) => {
    session = { ...session, role };
    mount(
      <RequireRole
        allowedRoles={[SystemRole.ADMIN, SystemRole.USER]}
        fallback={denied}
      >
        {secret}
      </RequireRole>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByText("Fallback content")).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("Не монтирует дочерний компонент при запрещённой роли", () => {
    const Child = vi.fn(() => secret);
    const { container } = mount(
      <RequireRole allowedRoles={[SystemRole.ADMIN]}>
        <Child />
      </RequireRole>,
    );
    expect(Child).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("Скрывает содержимое при явно заданном fallback={null}", () => {
    const { container } = mount(
      <RequireRole allowedRoles={[SystemRole.ADMIN]} fallback={null}>
        {secret}
      </RequireRole>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("Запрещает доступ при пустом списке разрешённых ролей", () => {
    mount(
      <RequireRole allowedRoles={[]} fallback={denied}>
        {secret}
      </RequireRole>,
    );
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
  });

  it("Разрешение администратора не заменяет разрешённую роль", () => {
    session = { ...session, permissions: SystemPermission.ADMINISTRATOR };
    mount(
      <RequireRole allowedRoles={[SystemRole.ADMIN]} fallback={denied}>
        {secret}
      </RequireRole>,
    );
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
  });

  it("Не монтирует защищённый контент при инициализации с неизвестной ролью", () => {
    session = {
      ...session,
      status: SESSION_STATUS.INITIALIZING,
      isAuthenticated: false,
      role: null,
    };
    const Child = vi.fn(() => secret);
    mount(
      <RequireRole allowedRoles={[SystemRole.USER]} fallback={denied}>
        <Child />
      </RequireRole>,
    );
    expect(Child).not.toHaveBeenCalled();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("Обновляет содержимое после загрузки роли и отзыва доступа", () => {
    session = { ...session, role: null };
    const ui = (
      <RequireRole allowedRoles={[SystemRole.ADMIN]} fallback={denied}>
        {secret}
      </RequireRole>
    );
    const view = mount(ui);
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();

    session = { ...session, role: SystemRole.ADMIN };
    view.rerender(ui);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByText("Fallback content")).not.toBeInTheDocument();

    session = { ...session, role: SystemRole.USER };
    view.rerender(ui);
    expectHidden();
    expect(screen.getByText("Fallback content")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
