import {
  Badge,
  Card,
  DataTable,
  type DataTableColumn,
  type DataTableRow,
  Typography,
} from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

interface PackageInfo extends DataTableRow {
  id: string;
  name: string;
  description: string;
}

const packageData: PackageInfo[] = [
  {
    id: "pkg-1",
    name: "@packages/ui",
    description:
      "Библиотека переиспользуемых React-компонентов на базе Radix UI и Tailwind CSS.",
  },
  {
    id: "pkg-2",
    name: "@packages/icons",
    description: "Библиотека стандартизированных иконок интерфейса.",
  },
  {
    id: "pkg-3",
    name: "@packages/tailwind-config",
    description:
      "Централизованная конфигурация Tailwind CSS v4 и файл theme.css.",
  },
  {
    id: "pkg-4",
    name: "apps/ui-docs",
    description: "Документация и витрина компонентов Storybook.",
  },
];

const packageColumns: DataTableColumn<PackageInfo>[] = [
  {
    key: "name",
    header: "Пакет",
    accessorKey: "name",
    cell: (row) => <Typography.Code>{row.name}</Typography.Code>,
    width: "260px",
  },
  {
    key: "description",
    header: "Назначение",
    accessorKey: "description",
    cell: (row) => <Typography.Muted>{row.description}</Typography.Muted>,
  },
];

const meta = {
  title: "Documentation/Introduction",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "Главная страница дизайн-системы MockInterview AI UI Kit.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Overview",
  render: () => (
    <div className="max-w-4xl mx-auto w-full space-y-10">
      <div className="space-y-3 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <Typography.H1>Дизайн-система MockInterview AI</Typography.H1>
          <Badge variant="secondary">v1.0.0</Badge>
        </div>
        <Typography.Lead>
          Официальная среда разработки компонентов пользовательского интерфейса
          и каталог дизайн-токенов платформы MockInterview AI.
        </Typography.Lead>
      </div>

      <div className="space-y-4">
        <Typography.H2>Назначение Storybook</Typography.H2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <Card.Header>
              <Card.Title>Изолированная разработка</Card.Title>
              <Card.Description>
                Создание, тестирование и версионирование компонентов интерфейса
                независимо от бэкенд-сервисов и клиентского роутинга.
              </Card.Description>
            </Card.Header>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Единый источник истины</Card.Title>
              <Card.Description>
                Централизованное хранилище дизайн-токенов (цветовая палитра,
                типографика, радиусы, анимации) и интерактивных компонентов.
              </Card.Description>
            </Card.Header>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Контроль доступности (a11y)</Card.Title>
              <Card.Description>
                Автоматическая проверка контрастности цветов, поддержки
                скринридеров, ARIA-атрибутов и клавиатурной навигации по WCAG.
              </Card.Description>
            </Card.Header>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Тестирование тем оформления</Card.Title>
              <Card.Description>
                Визуальная проверка корректности отображения компонентов в
                темной и светлой темах интерфейса в реальном времени.
              </Card.Description>
            </Card.Header>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <Typography.H2>Структура пакетов интерфейса</Typography.H2>
        <DataTable data={packageData} columns={packageColumns} />
      </div>

      <div className="space-y-4">
        <Typography.H2>Подключение и использование</Typography.H2>
        <div className="space-y-4">
          <Card>
            <Card.Header>
              <Card.Title>1. Установка пакетов</Card.Title>
            </Card.Header>
            <Card.Content>
              <pre className="rounded bg-muted/60 p-3 font-mono text-sm text-foreground overflow-x-auto">
                <code>pnpm add @packages/ui @packages/icons</code>
              </pre>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>
                2. Подключение базовых стилей (globals.css)
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <pre className="rounded bg-muted/60 p-3 font-mono text-sm text-foreground overflow-x-auto">
                <code>{`@import "tailwindcss";\n@import "@packages/ui/globals.css";\n@import "@packages/icons/globals.css";`}</code>
              </pre>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>3. Использование компонентов</Card.Title>
            </Card.Header>
            <Card.Content>
              <pre className="rounded bg-muted/60 p-3 font-mono text-sm text-foreground overflow-x-auto">
                <code>{`import { Button, Typography } from "@packages/ui";\n\nexport function ExampleSection() {\n  return (\n    <div>\n      <Typography.H2>Техническая секция</Typography.H2>\n      <Button variant="default">Начать собеседование</Button>\n    </div>\n  );\n}`}</code>
              </pre>
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  ),
};
