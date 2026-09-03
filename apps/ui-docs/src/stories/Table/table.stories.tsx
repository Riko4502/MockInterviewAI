import { Badge, Table } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Components/Table",
  component: Table,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
      description: "Дополнительные CSS-классы для тега `<table>`.",
      table: { type: { summary: "string" } },
    },
    children: {
      control: false,
      description:
        "Содержимое таблицы. Используйте sub-компоненты: " +
        "`Table.Header` (`<thead>`) — шапка; " +
        "`Table.Body` (`<tbody>`) — тело; " +
        "`Table.Footer` (`<tfoot>`) — подвал; " +
        "`Table.Row` (`<tr>`) — строка; " +
        "`Table.Head` (`<th>`) — ячейка-заголовок; " +
        "`Table.Cell` (`<td>`) — ячейка данных; " +
        "`Table.Caption` (`<caption>`) — подпись таблицы.",
      table: { type: { summary: "ReactNode" } },
    },
  },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const candidates = [
  {
    name: "Анна Иванова",
    email: "anna@example.com",
    status: "ready" as const,
    statusLabel: "Готово",
  },
  {
    name: "Пётр Смирнов",
    email: "petr@example.com",
    status: "waiting" as const,
    statusLabel: "Ожидание",
  },
  {
    name: "Мария Кузнецова",
    email: "maria@example.com",
    status: "confirmed" as const,
    statusLabel: "Подтверждено",
  },
];

// ─── Table (root) stories ───

export const Default: Story = {
  name: "Table / Default",
  render: () => (
    <Table>
      <Table.Caption>Список кандидатов на собеседование.</Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head>Имя</Table.Head>
          <Table.Head>Email</Table.Head>
          <Table.Head>Статус</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {candidates.map((c) => (
          <Table.Row key={c.email}>
            <Table.Cell>{c.name}</Table.Cell>
            <Table.Cell>{c.email}</Table.Cell>
            <Table.Cell>
              <Badge variant={c.status}>{c.statusLabel}</Badge>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

export const WithFooter: Story = {
  name: "Table / With Footer",
  render: () => (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Имя</Table.Head>
          <Table.Head>Email</Table.Head>
          <Table.Head>Статус</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {candidates.map((c) => (
          <Table.Row key={c.email}>
            <Table.Cell>{c.name}</Table.Cell>
            <Table.Cell>{c.email}</Table.Cell>
            <Table.Cell>
              <Badge variant={c.status}>{c.statusLabel}</Badge>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
      <Table.Footer>
        <Table.Row>
          <Table.Cell colSpan={2}>Всего кандидатов</Table.Cell>
          <Table.Cell>{candidates.length}</Table.Cell>
        </Table.Row>
      </Table.Footer>
    </Table>
  ),
};

export const Empty: Story = {
  name: "Table / Empty",
  render: () => (
    <Table>
      <Table.Caption>Кандидатов пока нет.</Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head>Имя</Table.Head>
          <Table.Head>Email</Table.Head>
          <Table.Head>Статус</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell colSpan={3} className="text-center text-muted-foreground">
            Нет данных для отображения
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ),
};

// ─────────────────────────────────────────────
// Table.Header — отдельная история
// ─────────────────────────────────────────────

export const TableHeaderStory: Story = {
  name: "Table.Header",
  parameters: {
    docs: {
      description: {
        story:
          "`Table.Header` — обёртка над `<thead>`. Применяет стиль: фоновый цвет шапки, " +
          "закреплённое позиционирование при скролле. Внутри размещайте `Table.Row` с `Table.Head`.\n\n" +
          "Принимает все стандартные пропсы `<thead>`: `className`, `children`.",
      },
    },
  },
  render: () => (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Имя</Table.Head>
          <Table.Head>Email</Table.Head>
          <Table.Head>Роль</Table.Head>
          <Table.Head>Статус</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell className="text-muted-foreground" colSpan={4}>
            Тело таблицы...
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ),
};

// ─────────────────────────────────────────────
// Table.Head — отдельная история
// ─────────────────────────────────────────────

export const TableHeadStory: Story = {
  name: "Table.Head",
  parameters: {
    docs: {
      description: {
        story:
          "`Table.Head` — ячейка-заголовок (`<th>`) в строке шапки. " +
          "Стиль: `text-left`, `font-medium`, `text-muted-foreground`, высота `h-10`.\n\n" +
          "Принимает все стандартные пропсы `<th>`: `className`, `children`, `colSpan`, `rowSpan`, `scope`.",
      },
    },
  },
  render: () => (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Обычный</Table.Head>
          <Table.Head className="text-right">Выравнивание right</Table.Head>
          <Table.Head className="text-center">Выравнивание center</Table.Head>
          <Table.Head colSpan={2} className="text-center">
            Объединённый (colSpan=2)
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell colSpan={5} className="text-muted-foreground text-center">
            Данные...
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ),
};

// ─────────────────────────────────────────────
// Table.Row — отдельная история
// ─────────────────────────────────────────────

export const TableRowStory: Story = {
  name: "Table.Row",
  parameters: {
    docs: {
      description: {
        story:
          "`Table.Row` — строка таблицы (`<tr>`). " +
          "Стиль: граница снизу, hover-подсветка (`hover:bg-muted/50`), " +
          "подсветка при `data-selected`.\n\n" +
          "Принимает все стандартные пропсы `<tr>`: `className`, `children`, `onClick`, `data-*`.",
      },
    },
  },
  render: () => (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Имя</Table.Head>
          <Table.Head>Email</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell>Обычная строка</Table.Cell>
          <Table.Cell>anna@example.com</Table.Cell>
        </Table.Row>
        <Table.Row className="bg-muted/50">
          <Table.Cell>Строка с bg-muted</Table.Cell>
          <Table.Cell>petr@example.com</Table.Cell>
        </Table.Row>
        <Table.Row data-selected="true">
          <Table.Cell>Выделенная строка (data-selected)</Table.Cell>
          <Table.Cell>maria@example.com</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ),
};

// ─────────────────────────────────────────────
// Table.Cell — отдельная история
// ─────────────────────────────────────────────

export const TableCellStory: Story = {
  name: "Table.Cell",
  parameters: {
    docs: {
      description: {
        story:
          "`Table.Cell` — ячейка данных (`<td>`) в теле таблицы. " +
          "Стиль: `py-2 px-4`, выравнивание по вертикали `align-middle`.\n\n" +
          "Принимает все стандартные пропсы `<td>`: `className`, `children`, `colSpan`, `rowSpan`.",
      },
    },
  },
  render: () => (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Обычная</Table.Head>
          <Table.Head>Выравнивание</Table.Head>
          <Table.Head>С компонентом</Table.Head>
          <Table.Head>colSpan</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell>Текст</Table.Cell>
          <Table.Cell className="text-right font-mono">42</Table.Cell>
          <Table.Cell>
            <Badge variant="statusSuccess">Готово</Badge>
          </Table.Cell>
          <Table.Cell colSpan={1} className="text-muted-foreground italic">
            Дополнительно
          </Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell colSpan={4} className="text-center text-muted-foreground">
            Объединённая ячейка (colSpan=4)
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ),
};

// ─────────────────────────────────────────────
// Table.Caption — отдельная история
// ─────────────────────────────────────────────

export const TableCaptionStory: Story = {
  name: "Table.Caption",
  parameters: {
    docs: {
      description: {
        story:
          "`Table.Caption` — подпись к таблице (`<caption>`). " +
          "По умолчанию отображается снизу таблицы, стиль: `text-sm text-muted-foreground`.\n\n" +
          "Принимает все стандартные пропсы `<caption>`: `className`, `children`.",
      },
    },
  },
  render: () => (
    <Table>
      <Table.Caption>
        Данные актуальны на 1 сентября 2026 года. Всего записей:{" "}
        {candidates.length}.
      </Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head>Имя</Table.Head>
          <Table.Head>Email</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {candidates.map((c) => (
          <Table.Row key={c.email}>
            <Table.Cell>{c.name}</Table.Cell>
            <Table.Cell>{c.email}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

// ─────────────────────────────────────────────
// Table.Footer — отдельная история
// ─────────────────────────────────────────────

export const TableFooterStory: Story = {
  name: "Table.Footer",
  parameters: {
    docs: {
      description: {
        story:
          "`Table.Footer` — подвал таблицы (`<tfoot>`). " +
          "Стиль: фоновый цвет `bg-muted/50`, `font-medium`. " +
          "Используется для итоговых строк (суммы, счётчики).\n\n" +
          "Принимает все стандартные пропсы `<tfoot>`: `className`, `children`.",
      },
    },
  },
  render: () => (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Имя</Table.Head>
          <Table.Head>Email</Table.Head>
          <Table.Head className="text-right">Баллы</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell>Анна Иванова</Table.Cell>
          <Table.Cell>anna@example.com</Table.Cell>
          <Table.Cell className="text-right">87</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>Пётр Смирнов</Table.Cell>
          <Table.Cell>petr@example.com</Table.Cell>
          <Table.Cell className="text-right">74</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>Мария Кузнецова</Table.Cell>
          <Table.Cell>maria@example.com</Table.Cell>
          <Table.Cell className="text-right">91</Table.Cell>
        </Table.Row>
      </Table.Body>
      <Table.Footer>
        <Table.Row>
          <Table.Cell colSpan={2}>Средний балл</Table.Cell>
          <Table.Cell className="text-right">84</Table.Cell>
        </Table.Row>
      </Table.Footer>
    </Table>
  ),
};
