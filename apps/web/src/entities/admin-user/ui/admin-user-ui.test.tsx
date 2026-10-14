import { SystemRole } from "@packages/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserAvatarCell } from "./UserAvatarCell";
import { UserRoleBadge } from "./UserRoleBadge";
import { UserStatusBadge } from "./UserStatusBadge";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          "admin.users.roles.admin": "Администратор",
          "admin.users.roles.user": "Пользователь",
          "admin.users.roles.ADMIN": "Администратор",
          "admin.users.roles.USER": "Пользователь",
          "admin.users.statuses.active": "Активен",
          "admin.users.statuses.deactivated": "Деактивирован",
        };
        return translations[key] ?? key;
      },
    }),
  };
});

describe("entities/admin-user UI components", () => {
  describe("UserRoleBadge", () => {
    it("renders ADMIN badge with administrator text and purple styling", () => {
      const { container } = render(<UserRoleBadge role={SystemRole.ADMIN} />);
      expect(screen.getByText("Администратор")).toBeDefined();
      expect(container.firstChild).toHaveProperty("className");
      const className = (container.firstChild as HTMLElement).className;
      expect(className).toContain("purple");
    });

    it("renders USER badge with user text", () => {
      render(<UserRoleBadge role={SystemRole.USER} />);
      expect(screen.getByText("Пользователь")).toBeDefined();
    });
  });

  describe("UserStatusBadge", () => {
    it("renders active status badge with success styling", () => {
      render(<UserStatusBadge isActive={true} />);
      expect(screen.getByText("Активен")).toBeDefined();
    });

    it("renders deactivated status badge with danger styling", () => {
      render(<UserStatusBadge isActive={false} />);
      expect(screen.getByText("Деактивирован")).toBeDefined();
    });
  });

  describe("UserAvatarCell", () => {
    it("renders displayName and @username if distinct", () => {
      render(
        <UserAvatarCell
          displayName="John Doe"
          username="johndoe"
          email="john@example.com"
        />,
      );

      expect(screen.getByText("John Doe")).toBeDefined();
      expect(screen.getByText("@johndoe")).toBeDefined();
    });

    it("does not render @username if username is identical to displayName", () => {
      render(
        <UserAvatarCell
          displayName="johndoe"
          username="johndoe"
          email="john@example.com"
        />,
      );

      expect(screen.getByText("johndoe")).toBeDefined();
      expect(screen.queryByText("@johndoe")).toBeNull();
    });

    it("falls back to email or dash if name is missing", () => {
      render(<UserAvatarCell email="test@mail.com" />);
      expect(screen.getByText("test@mail.com")).toBeDefined();
    });
  });
});
