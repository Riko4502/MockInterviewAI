import {
  BookIcon,
  ChevronRightIcon,
  CodeIcon,
  HelpIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "@packages/icons";
import { Badge, Sidebar } from "@packages/ui";
import { cn } from "@packages/utils";
import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, type ReactNode, useState } from "react";

/**
 * Метаданные компонента Sidebar для Storybook.
 */
const meta = {
  title: "Components/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
### **Sidebar** — боковая панель навигации

Составной компонент боковой панели на базе shadcn/ui. На десктопе занимает постоянное место в layout, на мобильных экранах открывается как \`Sheet\`.

Сворачивание панели в Storybook — через \`Sidebar.Trigger\`, рельсу по краю или \`Ctrl/⌘ + B\`. Это внутреннее состояние \`Sidebar.Provider\`. Контролируемые пропсы \`open\` / \`onOpenChange\` нужны только в приложении, если состояние панели хранится снаружи.

Режим \`collapsible\`:
- \`offcanvas\` — панель уезжает за край экрана;
- \`icon\` — остаётся узкая колонка с иконками;
- \`none\` — панель нельзя свернуть.

---

### **Установка и импорт**
\`\`\`tsx
import { Sidebar } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Sidebar.Provider>
  <Sidebar>
    <Sidebar.Header>MockInterviewAI</Sidebar.Header>
    <Sidebar.Content>
      <Sidebar.Group>
        <Sidebar.GroupLabel>Навигация</Sidebar.GroupLabel>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton isActive>
                Дашборд
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </Sidebar.Content>
    <Sidebar.Rail />
  </Sidebar>
  <Sidebar.Inset>
    <Sidebar.Trigger />
    Контент страницы
  </Sidebar.Inset>
</Sidebar.Provider>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    side: {
      control: "radio",
      options: ["left", "right"],
      description: "Сторона размещения панели.",
      table: { category: "Sidebar" },
    },
    variant: {
      control: "select",
      options: ["sidebar", "floating", "inset"],
      description: "Визуальный вариант панели.",
      table: { category: "Sidebar" },
    },
    collapsible: {
      control: "select",
      options: ["offcanvas", "icon", "none"],
      description:
        "Режим сворачивания: скрытие за край, иконки или без сворачивания.",
      table: { category: "Sidebar" },
    },
  },
  args: {
    side: "left",
    variant: "sidebar",
    collapsible: "offcanvas",
  },
  render: (args) => (
    <DemoSidebar
      side={args.side}
      variant={args.variant}
      collapsible={args.collapsible}
    />
  ),
} satisfies Meta<ComponentProps<typeof Sidebar>>;

export default meta;
type Story = StoryObj<typeof meta>;

function DemoSidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  defaultOpen = true,
}: {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
  defaultOpen?: boolean;
}) {
  const [openMenus, setOpenMenus] = useState({
    interviews: false,
    partners: true,
  });

  return (
    <Sidebar.Provider
      key={`${side}-${variant}-${collapsible}-${defaultOpen}`}
      className="min-h-svh"
      defaultOpen={defaultOpen}
    >
      <Sidebar side={side} variant={variant} collapsible={collapsible}>
        <Sidebar.Header>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton size="lg" tooltip="MockInterviewAI">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
                  M
                </span>
                <span className="truncate">MockInterviewAI</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
          <Sidebar.Input placeholder="Поиск..." />
        </Sidebar.Header>

        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Платформа</Sidebar.GroupLabel>
            <Sidebar.GroupContent>
              <Sidebar.Menu>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton isActive tooltip="Дашборд">
                    <HelpIcon />
                    <span>Дашборд</span>
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
                <CollapsibleMenuItem
                  title="Собеседования"
                  tooltip="Собеседования"
                  icon={CodeIcon}
                  badge="12"
                  open={openMenus.interviews}
                  onOpenChange={(nextOpen) =>
                    setOpenMenus((current) => ({
                      ...current,
                      interviews: nextOpen,
                    }))
                  }
                >
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton href="#upcoming">
                      Предстоящие
                    </Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton href="#history">
                      История
                    </Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                </CollapsibleMenuItem>
                <CollapsibleMenuItem
                  title="Партнёры"
                  tooltip="Партнёры"
                  icon={UsersIcon}
                  open={openMenus.partners}
                  onOpenChange={(nextOpen) =>
                    setOpenMenus((current) => ({
                      ...current,
                      partners: nextOpen,
                    }))
                  }
                >
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton isActive href="#search">
                      Поиск
                    </Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton href="#invites">
                      Приглашения
                    </Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                </CollapsibleMenuItem>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton tooltip="Ресурсы">
                    <BookIcon />
                    <span>Ресурсы</span>
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              </Sidebar.Menu>
            </Sidebar.GroupContent>
          </Sidebar.Group>

          <Sidebar.Separator />

          <Sidebar.Group>
            <Sidebar.GroupLabel>Загрузка</Sidebar.GroupLabel>
            <Sidebar.GroupContent>
              <Sidebar.Menu>
                <Sidebar.MenuItem>
                  <Sidebar.MenuSkeleton showIcon />
                </Sidebar.MenuItem>
                <Sidebar.MenuItem>
                  <Sidebar.MenuSkeleton showIcon />
                </Sidebar.MenuItem>
              </Sidebar.Menu>
            </Sidebar.GroupContent>
          </Sidebar.Group>
        </Sidebar.Content>

        <Sidebar.Footer>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton tooltip="Настройки">
                <SettingsIcon />
                <span>Настройки</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Footer>
        <Sidebar.Rail />
      </Sidebar>

      <Sidebar.Inset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <Sidebar.Trigger />
          <span className="text-sm text-muted-foreground">
            Кнопка меню, рельса по краю панели или Ctrl/⌘ + B
          </span>
          <Badge className="ml-auto">Demo</Badge>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <h1 className="text-lg font-semibold">Дашборд</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Основная область приложения. На узком экране панель открывается
            поверх контента, на широком — занимает место в layout.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SearchIcon className="size-4" />
            Поиск по сессиям, партнёрам и ресурсам
          </div>
        </div>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}

function CollapsibleMenuItem({
  title,
  tooltip,
  icon: Icon,
  open,
  onOpenChange,
  badge,
  children,
}: {
  title: string;
  tooltip: string;
  icon: typeof CodeIcon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <Sidebar.MenuItem>
      <Sidebar.MenuButton
        tooltip={tooltip}
        aria-expanded={open}
        data-open={open || undefined}
        onClick={() => onOpenChange(!open)}
      >
        <Icon />
        <span>{title}</span>
        {badge ? (
          <span className="ml-auto text-xs tabular-nums text-sidebar-foreground/70">
            {badge}
          </span>
        ) : null}
        <ChevronRightIcon
          className={cn(
            !badge && "ml-auto",
            "transition-transform",
            open && "rotate-90",
          )}
        />
      </Sidebar.MenuButton>
      {open ? <Sidebar.MenuSub>{children}</Sidebar.MenuSub> : null}
    </Sidebar.MenuItem>
  );
}

/**
 * Стандартная боковая панель с режимом offcanvas.
 */
export const Default: Story = {};

/**
 * Сворачивание до иконок с подсказками на пунктах меню.
 */
export const IconCollapsed: Story = {
  args: {
    collapsible: "icon",
  },
  render: (args) => (
    <DemoSidebar
      side={args.side}
      variant={args.variant}
      collapsible={args.collapsible}
      defaultOpen={false}
    />
  ),
};

/**
 * Вариант inset: контент с отступом и скруглением.
 */
export const Inset: Story = {
  args: {
    variant: "inset",
    collapsible: "icon",
  },
};

/**
 * Плавающая панель с тенью и скруглением.
 */
export const Floating: Story = {
  args: {
    variant: "floating",
    collapsible: "icon",
  },
};

/**
 * Панель справа.
 */
export const RightSide: Story = {
  args: {
    side: "right",
  },
};

/**
 * Панель без сворачивания: Trigger и горячая клавиша не меняют ширину.
 */
export const NonCollapsible: Story = {
  args: {
    collapsible: "none",
  },
};
