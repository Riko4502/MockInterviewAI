import { Badge, Table } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Components/Table",
  component: Table,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
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

export const Default: Story = {
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
