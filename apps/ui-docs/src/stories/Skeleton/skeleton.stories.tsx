import {
  Card,
  DataTable,
  type DataTableColumn,
  type DataTableRow,
  Skeleton,
  Table,
} from "@packages/ui";

import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Components/Skeleton",
  component: Skeleton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Skeleton** — заглушка состояния загрузки

Компонент для отображения "скелетона" контента, пока данные ещё не загружены (вместо аватарки, строки текста, карточки, таблицы и т.д.). Форма задаётся через проп \`shape\` (\`rectangular\`, \`circle\`, \`text\`), а точный размер — через \`className\`.

---

### **Установка и импорт**
\`\`\`tsx
import { Skeleton } from "@packages/ui";
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    shape: {
      control: "select",
      options: ["rectangular", "circle", "text"],
      description: "Задаёт базовую форму заглушки (скругление углов).",
      table: {
        type: { summary: '"rectangular" | "circle" | "text"' },
        defaultValue: { summary: '"rectangular"' },
      },
    },
    className: {
      control: "text",
      description:
        "Точечная донастройка размера и отступов (например, `h-4 w-32`).",
      table: { type: { summary: "string" } },
    },
  },
  args: {
    shape: "rectangular",
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартная прямоугольная заглушка (например, вместо блока контента).
 */
export const Default: Story = {
  args: {
    className: "h-24 w-64",
  },
};

/**
 * Заглушка строки текста — узкая полоса фиксированной высоты.
 */
export const Text: Story = {
  args: {
    shape: "text",
    className: "w-64",
  },
};

/**
 * Круглая заглушка — например, вместо аватарки пользователя.
 */
export const Circle: Story = {
  args: {
    shape: "circle",
    className: "size-12",
  },
};

/**
 * Составной пример: заглушка карточки собеседования (аватар + строки текста).
 */
export const CardExample: Story = {
  render: () => (
    <div className="flex items-center gap-4 w-80">
      <Skeleton shape="circle" className="size-12" />
      <div className="space-y-2 flex-1">
        <Skeleton shape="text" className="w-3/4" />
        <Skeleton shape="text" className="h-3 w-1/2" />
      </div>
    </div>
  ),
};

/**
 * Пример использования внутри карточки Card (загрузка карточки собеседования).
 */
export const InCard: Story = {
  render: () => (
    <Card className="w-80">
      <Card.Header>
        <Skeleton shape="text" className="w-2/3" />
        <Skeleton shape="text" className="h-3 w-1/3" />
      </Card.Header>
      <Card.Content className="space-y-2">
        <Skeleton shape="text" />
        <Skeleton shape="text" className="w-5/6" />
        <Skeleton shape="text" className="w-4/6" />
      </Card.Content>
    </Card>
  ),
};

interface SkeletonRow extends DataTableRow {
  id: string;
  candidateName?: string;
  status?: string;
  date?: string;
  isLoading?: boolean;
}

const skeletonRows: SkeletonRow[] = [
  {
    id: "row-1",
    candidateName: "Алексей Смирнов",
    status: "Завершено",
    date: "19.08.2026",
  },
  {
    id: "row-2",
    candidateName: "Елена Васильева",
    status: "Завершено",
    date: "29.07.2026",
  },
  { id: "row-3", isLoading: true },
  { id: "row-4", isLoading: true },
];

const skeletonColumns: DataTableColumn<SkeletonRow>[] = [
  {
    key: "candidate",
    header: "Кандидат",
    cell: (row) =>
      row.isLoading ? (
        <Skeleton shape="text" />
      ) : (
        <span className="font-medium text-foreground">{row.candidateName}</span>
      ),
  },
  {
    key: "status",
    header: "Статус",
    align: "center",
    cell: (row) =>
      row.isLoading ? (
        <Skeleton shape="text" className="w-16 mx-auto" />
      ) : (
        <span>{row.status}</span>
      ),
  },
  {
    key: "date",
    header: "Дата",
    align: "center",
    cell: (row) =>
      row.isLoading ? (
        <Skeleton shape="text" className="w-20 mx-auto" />
      ) : (
        <span>{row.date}</span>
      ),
  },
];

/**
 * Пример использования внутри компонента DataTable — заглушки вместо ячеек
 * на время загрузки данных (альтернатива встроенному оверлею `loading` со спиннером).
 */
export const InDataTable: Story = {
  render: () => (
    <div className="w-[480px]">
      <DataTable data={skeletonRows} columns={skeletonColumns} />
    </div>
  ),
};
