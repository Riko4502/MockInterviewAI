import {
  Badge,
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  type DataTableRow,
  Typography,
} from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

interface ColorTokenRow extends DataTableRow {
  id: string;
  name: string;
  cssVar: string;
  tailwindClass: string;
  value: string;
  theme: "Adaptive" | "Dark" | "Light";
  description: string;
}

interface ColorGroup {
  category: string;
  description: string;
  tokens: ColorTokenRow[];
}

const COLOR_GROUPS: ColorGroup[] = [
  {
    category: "Base & Surfaces (Поверхности и базовый текст)",
    description:
      "Основные цвета подложек страниц, контейнеров и базового текстового контраста.",
    tokens: [
      {
        id: "bg",
        name: "Background",
        cssVar: "--background",
        tailwindClass: "bg-background",
        value: "oklch(1 0 0) / oklch(0.155 0.002 286.152)",
        theme: "Adaptive",
        description: "Основной фон всего приложения (body, viewport canvas).",
      },
      {
        id: "fg",
        name: "Foreground",
        cssVar: "--foreground",
        tailwindClass: "text-foreground",
        value: "oklch(0.145 0 0) / oklch(1 0 0)",
        theme: "Adaptive",
        description: "Основной цвет текста первого уровня контрастности.",
      },
      {
        id: "card",
        name: "Card",
        cssVar: "--card",
        tailwindClass: "bg-card",
        value: "oklch(1 0 0) / oklch(0.184 0.008 285.577)",
        theme: "Adaptive",
        description: "Фон карточек, панелей, диалогов и изолированных блоков.",
      },
      {
        id: "card-fg",
        name: "Card Foreground",
        cssVar: "--card-foreground",
        tailwindClass: "text-card-foreground",
        value: "oklch(0.145 0 0) / oklch(1 0 0)",
        theme: "Adaptive",
        description: "Цвет текста и заголовков внутри поверхностей карточек.",
      },
      {
        id: "popover",
        name: "Popover",
        cssVar: "--popover",
        tailwindClass: "bg-popover",
        value: "oklch(1 0 0) / oklch(0.184 0.008 285.577)",
        theme: "Adaptive",
        description:
          "Фон всплывающих элементов: тултипов, выпадающих меню, селектов.",
      },
      {
        id: "popover-fg",
        name: "Popover Foreground",
        cssVar: "--popover-foreground",
        tailwindClass: "text-popover-foreground",
        value: "oklch(0.145 0 0) / oklch(1 0 0)",
        theme: "Adaptive",
        description: "Цвет текста внутри всплывающих меню и тултипов.",
      },
    ],
  },
  {
    category: "Interactive & Brand (Бренд и интерактивные действия)",
    description:
      "Ключевые акцентные цвета для вызова действий, вторичных контролов и подсветки.",
    tokens: [
      {
        id: "primary",
        name: "Primary",
        cssVar: "--primary",
        tailwindClass: "bg-primary",
        value: "oklch(0.55 0.22 290.953) / oklch(0.596 0.207 290.953)",
        theme: "Adaptive",
        description:
          "Главный акцентный цвет интерфейса: CTA-кнопки, активные чекбоксы, фокусы.",
      },
      {
        id: "primary-fg",
        name: "Primary Foreground",
        cssVar: "--primary-foreground",
        tailwindClass: "text-primary-foreground",
        value: "oklch(0.985 0 0) / oklch(1 0 0)",
        theme: "Adaptive",
        description: "Цвет текста на элементах с заливкой Primary.",
      },
      {
        id: "secondary",
        name: "Secondary",
        cssVar: "--secondary",
        tailwindClass: "bg-secondary",
        value: "oklch(0.96 0.005 285.12) / oklch(0.2729 0.0184 285.12)",
        theme: "Adaptive",
        description:
          "Вторичные кнопки, нейтральные бейджи и вспомогательные контролы.",
      },
      {
        id: "secondary-fg",
        name: "Secondary Foreground",
        cssVar: "--secondary-foreground",
        tailwindClass: "text-secondary-foreground",
        value: "oklch(0.205 0 0) / oklch(1 0 0)",
        theme: "Adaptive",
        description: "Цвет текста на элементах со вторичной заливкой.",
      },
      {
        id: "muted",
        name: "Muted",
        cssVar: "--muted",
        tailwindClass: "bg-muted",
        value: "oklch(0.96 0.005 285.432) / oklch(0.225 0.012 285.432)",
        theme: "Adaptive",
        description:
          "Приглушенный нейтральный фон для неактивных состояний и подложек табов.",
      },
      {
        id: "muted-fg",
        name: "Muted Foreground",
        cssVar: "--muted-foreground",
        tailwindClass: "text-muted-foreground",
        value: "oklch(0.556 0.012 285.432) / oklch(0.691 0.006 247.906)",
        theme: "Adaptive",
        description:
          "Второстепенный текст, плейсхолдеры в инпутах, подписи, мета-информация.",
      },
      {
        id: "accent",
        name: "Accent",
        cssVar: "--accent",
        tailwindClass: "bg-accent",
        value: "oklch(0.96 0.005 285.432) / oklch(0.225 0.012 285.432)",
        theme: "Adaptive",
        description:
          "Ховер-эффекты пунктов меню, интерактивных списков и строк таблиц.",
      },
      {
        id: "accent-fg",
        name: "Accent Foreground",
        cssVar: "--accent-foreground",
        tailwindClass: "text-accent-foreground",
        value: "oklch(0.205 0 0) / oklch(1 0 0)",
        theme: "Adaptive",
        description:
          "Цвет текста при наведении и выделении элементов с фоном Accent.",
      },
    ],
  },
  {
    category: "Status & Feedback (Состояния и обратная связь)",
    description:
      "Цвета валидации форм, системных уведомлений и критических операций.",
    tokens: [
      {
        id: "destructive",
        name: "Destructive",
        cssVar: "--destructive",
        tailwindClass: "bg-destructive",
        value: "oklch(0.577 0.245 27.325) / oklch(0.704 0.191 22.216)",
        theme: "Adaptive",
        description: "Ошибки валидации, критические алерты, действия удаления.",
      },
      {
        id: "success",
        name: "Success",
        cssVar: "--success",
        tailwindClass: "bg-success",
        value: "oklch(0.6 0.18 145) / oklch(0.439 0.264 165.214)",
        theme: "Adaptive",
        description:
          "Успешные операции, подтверждения, пройденные тесты и интервью.",
      },
      {
        id: "success-fg",
        name: "Success Foreground",
        cssVar: "--success-foreground",
        tailwindClass: "text-success-foreground",
        value: "oklch(0.985 0 0) / oklch(1 0 0)",
        theme: "Adaptive",
        description: "Цвет текста на блоках с заливкой Success.",
      },
    ],
  },
  {
    category: "Borders & Controls (Границы и фокусы)",
    description:
      "Разделители, контуры инпутов и кольца фокуса для доступности.",
    tokens: [
      {
        id: "border",
        name: "Border",
        cssVar: "--border",
        tailwindClass: "border-border",
        value: "oklch(0.922 0.004 285.577) / oklch(1 0 0 / 10%)",
        theme: "Adaptive",
        description:
          "Границы карточек, таблиц, сепараторов и разделительных линий.",
      },
      {
        id: "input-border",
        name: "Input",
        cssVar: "--input",
        tailwindClass: "border-input",
        value: "oklch(0.922 0.004 285.577) / oklch(1 0 0 / 15%)",
        theme: "Adaptive",
        description: "Контуры полей ввода, текстовых областей и селектов.",
      },
      {
        id: "ring",
        name: "Ring",
        cssVar: "--ring",
        tailwindClass: "ring-ring",
        value: "oklch(0.55 0.22 290.953) / oklch(0.596 0.207 290.953)",
        theme: "Adaptive",
        description:
          "Кольцо фокуса при навигации с клавиатуры (a11y focus outline).",
      },
    ],
  },
  {
    category: "Sidebar (Навигационная панель)",
    description: "Выделенная палитра для бокового меню и навигации приложения.",
    tokens: [
      {
        id: "sb",
        name: "Sidebar",
        cssVar: "--sidebar",
        tailwindClass: "bg-sidebar",
        value: "oklch(0.985 0 0) / oklch(0.155 0.002 286.152)",
        theme: "Adaptive",
        description: "Фон боковой панели.",
      },
      {
        id: "sb-fg",
        name: "Sidebar Foreground",
        cssVar: "--sidebar-foreground",
        tailwindClass: "text-sidebar-foreground",
        value: "oklch(0.145 0 0) / oklch(1 0 0)",
        theme: "Adaptive",
        description: "Основной текст боковой панели.",
      },
      {
        id: "sb-primary",
        name: "Sidebar Primary",
        cssVar: "--sidebar-primary",
        tailwindClass: "bg-sidebar-primary",
        value: "oklch(0.55 0.22 290.953) / oklch(0.596 0.207 290.953)",
        theme: "Adaptive",
        description: "Активный пункт навигации в боковой панели.",
      },
      {
        id: "sb-primary-fg",
        name: "Sidebar Primary Foreground",
        cssVar: "--sidebar-primary-foreground",
        tailwindClass: "text-sidebar-primary-foreground",
        value: "oklch(0.985 0 0) / oklch(1 0 0)",
        theme: "Adaptive",
        description: "Текст активного пункта навигации.",
      },
      {
        id: "sb-accent",
        name: "Sidebar Accent",
        cssVar: "--sidebar-accent",
        tailwindClass: "bg-sidebar-accent",
        value: "oklch(0.96 0.005 285.432) / oklch(0.225 0.012 285.432)",
        theme: "Adaptive",
        description: "Ховер пункта боковой панели.",
      },
      {
        id: "sb-accent-fg",
        name: "Sidebar Accent Foreground",
        cssVar: "--sidebar-accent-foreground",
        tailwindClass: "text-sidebar-accent-foreground",
        value: "oklch(0.205 0 0) / oklch(1 0 0)",
        theme: "Adaptive",
        description: "Текст при наведении на пункт боковой панели.",
      },
      {
        id: "sb-border",
        name: "Sidebar Border",
        cssVar: "--sidebar-border",
        tailwindClass: "border-sidebar-border",
        value: "oklch(0.922 0.004 285.577) / oklch(1 0 0 / 10%)",
        theme: "Adaptive",
        description: "Граница отделения сайдбара от контентной части.",
      },
      {
        id: "sb-ring",
        name: "Sidebar Ring",
        cssVar: "--sidebar-ring",
        tailwindClass: "ring-sidebar-ring",
        value: "oklch(0.55 0.22 290.953) / oklch(0.596 0.207 290.953)",
        theme: "Adaptive",
        description: "Фокус элементов в сайдбаре.",
      },
    ],
  },
  {
    category: "Charts & Analytics (Графики и визуализация данных)",
    description:
      "Палитра для построения диаграмм, графиков прогресса и метрик собеседований.",
    tokens: [
      {
        id: "ch-1",
        name: "Chart 1",
        cssVar: "--chart-1",
        tailwindClass: "fill-[var(--chart-1)]",
        value: "oklch(0.55 0.22 290.953) / oklch(0.596 0.207 290.953)",
        theme: "Adaptive",
        description: "Основной ряд данных (Primary Purple).",
      },
      {
        id: "ch-2",
        name: "Chart 2",
        cssVar: "--chart-2",
        tailwindClass: "fill-[var(--chart-2)]",
        value: "oklch(0.637 0.139 145.572)",
        theme: "Adaptive",
        description: "Второй ряд данных (Teal / Green).",
      },
      {
        id: "ch-3",
        name: "Chart 3",
        cssVar: "--chart-3",
        tailwindClass: "fill-[var(--chart-3)]",
        value: "oklch(0.696 0.17 162.48)",
        theme: "Adaptive",
        description: "Третий ряд данных (Cyan / Mint).",
      },
      {
        id: "ch-4",
        name: "Chart 4",
        cssVar: "--chart-4",
        tailwindClass: "fill-[var(--chart-4)]",
        value: "oklch(0.627 0.265 303.9)",
        theme: "Adaptive",
        description: "Четвертый ряд данных (Violet / Pink).",
      },
      {
        id: "ch-5",
        name: "Chart 5",
        cssVar: "--chart-5",
        tailwindClass: "fill-[var(--chart-5)]",
        value: "oklch(0.645 0.246 16.439)",
        theme: "Adaptive",
        description: "Пятый ряд данных (Coral / Orange).",
      },
    ],
  },
];

function ColorsOverview() {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(text);
    setTimeout(() => {
      setCopiedVar(null);
    }, 2000);
  };

  const colorColumns: DataTableColumn<ColorTokenRow>[] = [
    {
      key: "preview",
      header: "Превью",
      width: "72px",
      align: "center",
      cell: (row) => (
        <div
          className="size-8 rounded-md border border-border shadow-sm transition-colors duration-200"
          style={{ background: `var(${row.cssVar})` }}
          title={row.value}
        />
      ),
    },
    {
      key: "cssVar",
      header: "CSS-переменная",
      width: "220px",
      cell: (row) => (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => handleCopy(`var(${row.cssVar})`)}
          className="font-mono text-xs border border-border/60 hover:bg-muted"
        >
          <span>{row.cssVar}</span>
          <span className="text-[10px] text-muted-foreground ml-1">
            {copiedVar === `var(${row.cssVar})` ? "(Скопировано)" : "(Копия)"}
          </span>
        </Button>
      ),
    },
    {
      key: "tailwindClass",
      header: "Tailwind класс",
      width: "190px",
      cell: (row) => (
        <Typography.Code className="text-xs">
          {row.tailwindClass}
        </Typography.Code>
      ),
    },
    {
      key: "theme",
      header: "Тема",
      width: "110px",
      align: "center",
      cell: (row) => (
        <Badge variant="secondary" className="text-[11px]">
          {row.theme}
        </Badge>
      ),
    },
    {
      key: "value",
      header: "Значение (OKLCH)",
      width: "240px",
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
          {row.value}
        </span>
      ),
    },
    {
      key: "description",
      header: "Назначение",
      cell: (row) => (
        <span className="text-xs text-foreground">{row.description}</span>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto w-full space-y-10">
      <div className="space-y-3 border-b border-border pb-6">
        <Typography.H1>Цветовая палитра и дизайн-токены</Typography.H1>
        <Typography.Lead>
          В проекте используется семантическая система дизайн-токенов на базе
          CSS-переменных в пространстве OKLCH. Все цвета инкапсулируют свою роль
          в интерфейсе и адаптируются при переключении светлой и тёмной тем.
        </Typography.Lead>
      </div>

      <div className="space-y-4">
        <Typography.H2>Принципы работы с цветами</Typography.H2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <Card.Header>
              <Card.Title>1. Семантические токены</Card.Title>
              <Card.Description>
                Запрещено использовать прямые HEX/RGB значения в UI. Всегда
                используйте семантические токены (bg-card, text-foreground).
              </Card.Description>
            </Card.Header>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>2. Поддержка тем</Card.Title>
              <Card.Description>
                Токены определены в theme.css. При переключении темы значения
                переменных адаптируются автоматически без изменения классов.
              </Card.Description>
            </Card.Header>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>3. Пространство OKLCH</Card.Title>
              <Card.Description>
                Формат oklch(L C H [/ alpha]) обеспечивает предсказуемый
                контраст и точную цветопередачу на любых экранах.
              </Card.Description>
            </Card.Header>
          </Card>
        </div>
      </div>

      <div className="space-y-8">
        <Typography.H2>Справочник токенов</Typography.H2>
        {COLOR_GROUPS.map((group) => (
          <Card key={group.category} className="overflow-hidden p-0 gap-0">
            <div className="p-4 border-b border-border bg-muted/30">
              <Typography.H4>{group.category}</Typography.H4>
              <Typography.Muted className="text-xs mt-1">
                {group.description}
              </Typography.Muted>
            </div>

            <DataTable<ColorTokenRow>
              data={group.tokens}
              columns={colorColumns}
            />
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <Typography.H2>Примеры использования в коде</Typography.H2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <Card.Header>
              <Card.Title>Tailwind CSS</Card.Title>
            </Card.Header>
            <Card.Content>
              <pre className="rounded bg-muted/60 p-3 font-mono text-xs text-foreground overflow-x-auto">
                <code>{`<Card>\n  <Card.Header>\n    <Card.Title>Заголовок</Card.Title>\n    <Card.Description>Описание карточки</Card.Description>\n  </Card.Header>\n  <Card.Content>\n    <Button variant="default">Действие</Button>\n  </Card.Content>\n</Card>`}</code>
              </pre>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Custom CSS</Card.Title>
            </Card.Header>
            <Card.Content>
              <pre className="rounded bg-muted/60 p-3 font-mono text-xs text-foreground overflow-x-auto">
                <code>{`.custom-interview-container {\n  background-color: var(--background);\n  color: var(--foreground);\n  border: 1px solid var(--border);\n  outline-color: var(--ring);\n}`}</code>
              </pre>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: "Documentation/Colors & Tokens",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "Справочник дизайн-токенов и цветовой палитры интерфейса.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Palette",
  render: () => <ColorsOverview />,
};
