import type { IconProps, IconSize } from "@packages/icons";
import * as Icons from "@packages/icons";
import { Badge, Button, Input } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import type React from "react";
import { useMemo, useState } from "react";

type IconComponent = React.ComponentType<IconProps>;

const ICON_CATEGORIES = {
  ALL: "Все",
  UI: "Интерфейс и действия",
  TECH: "Языки и фреймворки",
  DEVOPS: "DevOps и базы данных",
  MEDIA: "Медиа и устройства",
} as const;

type IconCategory = (typeof ICON_CATEGORIES)[keyof typeof ICON_CATEGORIES];

interface IconItem {
  name: string;
  component: IconComponent;
  category: IconCategory;
}

const CATEGORY_MAP: Record<string, IconCategory> = {
  // Языки программирования и фреймворки
  CIcon: ICON_CATEGORIES.TECH,
  CppIcon: ICON_CATEGORIES.TECH,
  CsharpIcon: ICON_CATEGORIES.TECH,
  CssIcon: ICON_CATEGORIES.TECH,
  DartIcon: ICON_CATEGORIES.TECH,
  GoIcon: ICON_CATEGORIES.TECH,
  GraphqlIcon: ICON_CATEGORIES.TECH,
  HtmlIcon: ICON_CATEGORIES.TECH,
  JavaIcon: ICON_CATEGORIES.TECH,
  JavascriptIcon: ICON_CATEGORIES.TECH,
  KotlinIcon: ICON_CATEGORIES.TECH,
  NestjsIcon: ICON_CATEGORIES.TECH,
  NextjsIcon: ICON_CATEGORIES.TECH,
  NodeIcon: ICON_CATEGORIES.TECH,
  PhpIcon: ICON_CATEGORIES.TECH,
  PythonIcon: ICON_CATEGORIES.TECH,
  RIcon: ICON_CATEGORIES.TECH,
  ReactIcon: ICON_CATEGORIES.TECH,
  RubyIcon: ICON_CATEGORIES.TECH,
  RustIcon: ICON_CATEGORIES.TECH,
  ScalaIcon: ICON_CATEGORIES.TECH,
  SwiftIcon: ICON_CATEGORIES.TECH,
  TailwindIcon: ICON_CATEGORIES.TECH,
  TypescriptIcon: ICON_CATEGORIES.TECH,
  VueIcon: ICON_CATEGORIES.TECH,

  // DevOps, инструменты и базы данных
  DatabaseIcon: ICON_CATEGORIES.DEVOPS,
  DockerIcon: ICON_CATEGORIES.DEVOPS,
  GitIcon: ICON_CATEGORIES.DEVOPS,
  GithubIcon: ICON_CATEGORIES.DEVOPS,
  GoogleIcon: ICON_CATEGORIES.DEVOPS,
  KubernetesIcon: ICON_CATEGORIES.DEVOPS,
  LinuxIcon: ICON_CATEGORIES.DEVOPS,
  MongodbIcon: ICON_CATEGORIES.DEVOPS,
  PostgresIcon: ICON_CATEGORIES.DEVOPS,
  PrismaIcon: ICON_CATEGORIES.DEVOPS,
  RedisIcon: ICON_CATEGORIES.DEVOPS,
  TerminalIcon: ICON_CATEGORIES.DEVOPS,

  // Медиа и устройства
  CameraIcon: ICON_CATEGORIES.MEDIA,
  MicIcon: ICON_CATEGORIES.MEDIA,
  PhotoCameraIcon: ICON_CATEGORIES.MEDIA,
  ScreenIcon: ICON_CATEGORIES.MEDIA,

  // Интерфейс и действия
  ArrowDownIcon: ICON_CATEGORIES.UI,
  ArrowUpIcon: ICON_CATEGORIES.UI,
  BellIcon: ICON_CATEGORIES.UI,
  BookIcon: ICON_CATEGORIES.UI,
  BugIcon: ICON_CATEGORIES.UI,
  CheckIcon: ICON_CATEGORIES.UI,
  ChevronRightIcon: ICON_CATEGORIES.UI,
  ClockIcon: ICON_CATEGORIES.UI,
  CloseIcon: ICON_CATEGORIES.UI,
  CodeIcon: ICON_CATEGORIES.UI,
  CopyIcon: ICON_CATEGORIES.UI,
  EditIcon: ICON_CATEGORIES.UI,
  FileCodeIcon: ICON_CATEGORIES.UI,
  FileIcon: ICON_CATEGORIES.UI,
  FolderIcon: ICON_CATEGORIES.UI,
  FolderOpenIcon: ICON_CATEGORIES.UI,
  HelpIcon: ICON_CATEGORIES.UI,
  HubConnectionIcon: ICON_CATEGORIES.UI,
  LoginIcon: ICON_CATEGORIES.UI,
  MaximizeIcon: ICON_CATEGORIES.UI,
  MinimizeIcon: ICON_CATEGORIES.UI,
  PackageIcon: ICON_CATEGORIES.UI,
  PlayIcon: ICON_CATEGORIES.UI,
  PlusIcon: ICON_CATEGORIES.UI,
  RedoIcon: ICON_CATEGORIES.UI,
  SearchIcon: ICON_CATEGORIES.UI,
  SettingsIcon: ICON_CATEGORIES.UI,
  SlidersIcon: ICON_CATEGORIES.UI,
  SpinnerIcon: ICON_CATEGORIES.UI,
  SplitIcon: ICON_CATEGORIES.UI,
  TrashIcon: ICON_CATEGORIES.UI,
  TrendUpIcon: ICON_CATEGORIES.UI,
  UndoIcon: ICON_CATEGORIES.UI,
  UsersIcon: ICON_CATEGORIES.UI,
  WandIcon: ICON_CATEGORIES.UI,
};

// Извлекаем все экспортированные иконки
const allIcons: IconItem[] = Object.entries(Icons)
  .filter(([name]) => name.endsWith("Icon"))
  .map(([name, component]) => ({
    name,
    component: component as IconComponent,
    category: CATEGORY_MAP[name] ?? ICON_CATEGORIES.UI,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const meta = {
  title: "UI/Icons",
  component: IconGallery,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg", "xl"],
      description:
        "Размер иконки. `xs` — 12px; `sm` — 16px; `md` — 20px (по умолчанию); `lg` — 24px; `xl` — 32px.",
      table: {
        type: { summary: '"xs" | "sm" | "md" | "lg" | "xl"' },
        defaultValue: { summary: '"md"' },
      },
    },
  },
} satisfies Meta<typeof IconGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

interface IconCardGridProps {
  icons: Array<{ name: string; component: IconComponent }>;
  size?: IconSize;
}

function IconCardGrid({ icons, size = "md" }: IconCardGridProps) {
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const handleCopy = (name: string) => {
    navigator.clipboard.writeText(`<${name} size="${size}" />`);
    setCopiedName(name);
    setTimeout(() => {
      setCopiedName((curr) => (curr === name ? null : curr));
    }, 2000);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
      {icons.map(({ name, component: IconComponent }) => {
        const isCopied = copiedName === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => handleCopy(name)}
            className={`group relative flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer ${
              isCopied
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 scale-95 shadow-sm"
                : "border-neutral-200 bg-white hover:border-primary/80 hover:shadow-md text-neutral-900 shadow-xs"
            }`}
            title={`Нажмите для копирования <${name} size="${size}" />`}
          >
            <div className="h-10 w-10 flex items-center justify-center mb-2 text-neutral-900 group-hover:scale-110 transition-transform">
              <IconComponent size={size} />
            </div>
            <span className="text-[11px] font-mono truncate w-full text-neutral-700 group-hover:text-neutral-950 font-semibold">
              {name.replace(/Icon$/, "")}
            </span>

            {isCopied && (
              <span className="absolute inset-x-0 bottom-1 text-[10px] font-bold text-emerald-700">
                Скопировано!
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface IconGalleryProps {
  size?: IconSize;
}

function IconGallery({ size = "md" }: IconGalleryProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<IconCategory>(
    ICON_CATEGORIES.ALL,
  );

  const categories = Object.values(ICON_CATEGORIES);

  const filteredIcons = useMemo(() => {
    return allIcons.filter((icon) => {
      const matchesSearch = icon.name
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesCategory =
        selectedCategory === ICON_CATEGORIES.ALL ||
        icon.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 font-sans">
      {/* Шапка и поиск */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Библиотека иконок
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Всего доступно {allIcons.length} иконок в{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
              @packages/icons
            </code>
          </p>
        </div>

        <div className="w-full md:w-72">
          <Input
            type="text"
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearch(e.target.value)
            }
          />
        </div>
      </div>

      {/* Вкладки категорий */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const count =
            cat === ICON_CATEGORIES.ALL
              ? allIcons.length
              : allIcons.filter((i) => i.category === cat).length;
          const isActive = selectedCategory === cat;
          return (
            <Button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <span>{cat}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Сетка иконок */}
      {filteredIcons.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm">
            Иконки по запросу &laquo;{search}&raquo; не найдены
          </p>
        </div>
      ) : (
        <IconCardGrid icons={filteredIcons} size={size} />
      )}
    </div>
  );
}

// 1. Главная сводная галерея
export const Gallery: Story = {
  name: "Все иконки",
  args: { size: "md" },
  render: (args) => <IconGallery size={args.size as IconSize} />,
};

// 2. Размеры
export const Sizes: Story = {
  name: "Варианты размеров",
  render: () => {
    const sampleIcons = [
      { name: "Check", Component: Icons.CheckIcon },
      { name: "Code", Component: Icons.CodeIcon },
      { name: "React", Component: Icons.ReactIcon },
      { name: "Settings", Component: Icons.SettingsIcon },
      { name: "Bell", Component: Icons.BellIcon },
    ];
    const sizes: IconSize[] = ["xs", "sm", "md", "lg", "xl"];

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Доступные варианты размеров</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 px-4 font-medium">Вариант</th>
                <th className="py-2 px-4 font-medium">Класс Tailwind</th>
                <th className="py-2 px-4 font-medium">Примеры отображения</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sizes.map((s) => (
                <tr key={s}>
                  <td className="py-3 px-4 font-mono font-bold text-foreground">
                    {s}
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground text-xs">
                    size-
                    {s === "xs"
                      ? "3 (12px)"
                      : s === "sm"
                        ? "4 (16px)"
                        : s === "md"
                          ? "5 (20px)"
                          : s === "lg"
                            ? "6 (24px)"
                            : "8 (32px)"}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-4">
                      {sampleIcons.map(({ name, Component }) => (
                        <Component key={`${s}-${name}`} size={s} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
};

// 3. Цвета
export const Colors: Story = {
  name: "Кастомизация цветов",
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Кастомизация цветов</h3>
      <p className="text-sm text-muted-foreground">
        Иконки наследуют{" "}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">
          currentColor
        </code>{" "}
        или могут окрашиваться с помощью стандартных утилит Tailwind CSS.
      </p>
      <div className="flex flex-wrap items-center gap-6 p-4 rounded-lg bg-white border border-neutral-200 shadow-xs">
        <div className="flex flex-col items-center gap-1.5 text-blue-500">
          <Icons.CodeIcon size="lg" />
          <span className="text-xs font-mono">text-blue-500</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-emerald-500">
          <Icons.CheckIcon size="lg" />
          <span className="text-xs font-mono">text-emerald-500</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-rose-500">
          <Icons.BugIcon size="lg" />
          <span className="text-xs font-mono">text-rose-500</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-amber-500">
          <Icons.BellIcon size="lg" />
          <span className="text-xs font-mono">text-amber-500</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-violet-500">
          <Icons.WandIcon size="lg" />
          <span className="text-xs font-mono">text-violet-500</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
          <Icons.SettingsIcon size="lg" />
          <span className="text-xs font-mono">text-muted-foreground</span>
        </div>
      </div>
    </div>
  ),
};

// 4. Использование в компонентах
export const WithButtonsAndBadges: Story = {
  name: "Использование в компонентах",
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Использование с UI-компонентами</h3>
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="default">
          <Icons.PlusIcon size="sm" />
          <span>Новая сессия</span>
        </Button>
        <Button variant="secondary">
          <Icons.CopyIcon size="sm" />
          <span>Скопировать код</span>
        </Button>
        <Button variant="outline">
          <Icons.GithubIcon size="sm" />
          <span>GitHub</span>
        </Button>
        <Button variant="destructive">
          <Icons.TrashIcon size="sm" />
          <span>Удалить</span>
        </Button>
        <Button size="icon" variant="ghost">
          <Icons.SettingsIcon size="md" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="statusSuccess" className="gap-1.5">
          <Icons.CheckIcon size="xs" /> Проверено
        </Badge>
        <Badge variant="tag" className="gap-1.5">
          <Icons.ReactIcon size="xs" /> React
        </Badge>
        <Badge variant="statusDanger" className="gap-1.5">
          <Icons.BugIcon size="xs" /> 2 проблемы
        </Badge>
      </div>
    </div>
  ),
};
