import { PlusIcon } from "@packages/icons";
import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

interface InterviewSession extends DataTableRow {
  id: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  level: string;
  score: number;
  status: "completed" | "in_progress" | "failed";
  date: string;
}

const mockSessions: InterviewSession[] = [
  {
    id: "sess-1",
    candidateName: "Алексей Смирнов",
    candidateEmail: "alex.smirnov@example.com",
    role: "Frontend Developer",
    level: "Senior",
    score: 92,
    status: "completed",
    date: "10.05.2026",
  },
  {
    id: "sess-2",
    candidateName: "Елена Васильева",
    candidateEmail: "elena.v@example.com",
    role: "Backend Developer (Go)",
    level: "Middle+",
    score: 84,
    status: "completed",
    date: "11.05.2026",
  },
  {
    id: "sess-3",
    candidateName: "Дмитрий Кузнецов",
    candidateEmail: "d.kuznetsov@example.com",
    role: "System Design",
    level: "Lead",
    score: 95,
    status: "completed",
    date: "11.05.2026",
  },
  {
    id: "sess-4",
    candidateName: "Мария Соколова",
    candidateEmail: "maria.sok@example.com",
    role: "Fullstack Developer",
    level: "Middle",
    score: 68,
    status: "failed",
    date: "12.05.2026",
  },
  {
    id: "sess-5",
    candidateName: "Иван Попов",
    candidateEmail: "ivan.popov@example.com",
    role: "DevOps Engineer",
    level: "Senior",
    score: 79,
    status: "in_progress",
    date: "12.05.2026",
  },
  {
    id: "sess-6",
    candidateName: "Ольга Морозова",
    candidateEmail: "olga.m@example.com",
    role: "QA Automation",
    level: "Middle",
    score: 88,
    status: "completed",
    date: "13.05.2026",
  },
  {
    id: "sess-7",
    candidateName: "Артем Новиков",
    candidateEmail: "artem.nov@example.com",
    role: "Frontend Developer (React)",
    level: "Junior+",
    score: 74,
    status: "completed",
    date: "14.05.2026",
  },
  {
    id: "sess-8",
    candidateName: "Константин Федоров",
    candidateEmail: "k.fedorov@example.com",
    role: "Security Engineer",
    level: "Senior",
    score: 91,
    status: "completed",
    date: "15.05.2026",
  },
  {
    id: "sess-9",
    candidateName: "Татьяна Павлова",
    candidateEmail: "t.pavlova@example.com",
    role: "Product Manager",
    level: "Lead",
    score: 86,
    status: "completed",
    date: "16.05.2026",
  },
  {
    id: "sess-10",
    candidateName: "Сергей Семенов",
    candidateEmail: "sergey.s@example.com",
    role: "Data Scientist",
    level: "Middle+",
    score: 89,
    status: "completed",
    date: "17.05.2026",
  },
  {
    id: "sess-11",
    candidateName: "Анна Кузьмина",
    candidateEmail: "anna.k@example.com",
    role: "UI/UX Designer",
    level: "Middle",
    score: 90,
    status: "completed",
    date: "18.05.2026",
  },
  {
    id: "sess-12",
    candidateName: "Павел Григорьев",
    candidateEmail: "p.grigoriev@example.com",
    role: "Mobile Developer (Flutter)",
    level: "Senior",
    score: 87,
    status: "completed",
    date: "19.05.2026",
  },
  {
    id: "sess-13",
    candidateName: "Юлия Белова",
    candidateEmail: "yulia.b@example.com",
    role: "Frontend Developer (Vue)",
    level: "Middle",
    score: 82,
    status: "completed",
    date: "20.05.2026",
  },
  {
    id: "sess-14",
    candidateName: "Максим Орлов",
    candidateEmail: "maxim.orlov@example.com",
    role: "Backend Developer (Node.js)",
    level: "Senior",
    score: 93,
    status: "completed",
    date: "21.05.2026",
  },
  {
    id: "sess-15",
    candidateName: "Виктория Тарасова",
    candidateEmail: "v.tarasova@example.com",
    role: "Tech Lead (Go)",
    level: "Lead",
    score: 96,
    status: "completed",
    date: "22.05.2026",
  },
  {
    id: "sess-16",
    candidateName: "Денис Зайцев",
    candidateEmail: "denis.z@example.com",
    role: "Site Reliability Engineer",
    level: "Senior",
    score: 85,
    status: "completed",
    date: "23.05.2026",
  },
  {
    id: "sess-17",
    candidateName: "Алина Ильина",
    candidateEmail: "alina.i@example.com",
    role: "Product Analyst",
    level: "Middle+",
    score: 78,
    status: "in_progress",
    date: "24.05.2026",
  },
  {
    id: "sess-18",
    candidateName: "Роман Воробьев",
    candidateEmail: "roman.v@example.com",
    role: "Backend Developer (Java)",
    level: "Senior",
    score: 89,
    status: "completed",
    date: "25.05.2026",
  },
  {
    id: "sess-19",
    candidateName: "Екатерина Гусева",
    candidateEmail: "ekaterina.g@example.com",
    role: "QA Automation (Python)",
    level: "Middle",
    score: 72,
    status: "failed",
    date: "26.05.2026",
  },
  {
    id: "sess-20",
    candidateName: "Николай Титов",
    candidateEmail: "nikolay.t@example.com",
    role: "System Design",
    level: "Lead",
    score: 94,
    status: "completed",
    date: "27.05.2026",
  },
  {
    id: "sess-21",
    candidateName: "Светлана Казакова",
    candidateEmail: "svetlana.k@example.com",
    role: "Frontend Developer",
    level: "Senior",
    score: 91,
    status: "completed",
    date: "28.05.2026",
  },
  {
    id: "sess-22",
    candidateName: "Григорий Медведев",
    candidateEmail: "grigory.m@example.com",
    role: "DevOps Engineer",
    level: "Middle+",
    score: 80,
    status: "completed",
    date: "29.05.2026",
  },
  {
    id: "sess-23",
    candidateName: "Анастасия Баранова",
    candidateEmail: "anastasia.b@example.com",
    role: "ML Engineer",
    level: "Senior",
    score: 95,
    status: "completed",
    date: "30.05.2026",
  },
  {
    id: "sess-24",
    candidateName: "Тимофей Жуков",
    candidateEmail: "timofey.zh@example.com",
    role: "Security Engineer",
    level: "Middle",
    score: 76,
    status: "in_progress",
    date: "31.05.2026",
  },
  {
    id: "sess-25",
    candidateName: "Полина Соловьева",
    candidateEmail: "polina.s@example.com",
    role: "Mobile Developer (iOS)",
    level: "Senior",
    score: 88,
    status: "completed",
    date: "01.06.2026",
  },
];

const columns: DataTableColumn<InterviewSession>[] = [
  {
    key: "candidate",
    header: "Кандидат",
    sortable: true,
    accessorKey: "candidateName",
    cell: (row) => (
      <div>
        <div className="font-medium text-foreground">{row.candidateName}</div>
        <div className="text-xs text-muted-foreground">
          {row.candidateEmail}
        </div>
      </div>
    ),
  },
  {
    key: "role",
    header: "Специализация",
    sortable: true,
    accessorKey: "role",
    cell: (row) => (
      <div>
        <span className="font-medium">{row.role}</span>
        <span className="ml-1.5 text-xs text-muted-foreground font-mono">
          [{row.level}]
        </span>
      </div>
    ),
  },
  {
    key: "score",
    header: "Оценка AI",
    sortable: true,
    align: "center",
    accessorKey: "score",
    cell: (row) => (
      <span
        className={
          row.score >= 85
            ? "text-success font-bold"
            : row.score >= 75
              ? "text-primary font-semibold"
              : "text-destructive font-semibold"
        }
      >
        {row.score}%
      </span>
    ),
  },
  {
    key: "status",
    header: "Статус",
    sortable: true,
    align: "center",
    accessorKey: "status",
    cell: (row) => {
      if (row.status === "completed") {
        return <Badge variant="statusSuccess">Пройдено</Badge>;
      }
      if (row.status === "in_progress") {
        return <Badge variant="statusInfo">В процессе</Badge>;
      }
      return <Badge variant="statusDanger">Не пройдено</Badge>;
    },
  },
  {
    key: "date",
    header: "Дата",
    sortable: true,
    align: "right",
    accessorKey: "date",
    cell: (row) => (
      <span className="text-xs text-muted-foreground">{row.date}</span>
    ),
  },
];

/**
 * Метаданные компонента DataTable для Storybook.
 */
const meta: Meta<typeof DataTable<InterviewSession>> = {
  title: "Components/DataTable",
  component: DataTable,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
### **DataTable** — полнофункциональная таблица данных

Компонент для отображения структурированных табличных данных с поддержкой сортировки, поиска, пагинации, выбора строк, закрепления шапки (Sticky Header), а также состояний загрузки и отсутствия данных.

---

### **Установка и импорт**
\`\`\`tsx
import { DataTable, type DataTableColumn, type DataTableRow } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
interface UserRow extends DataTableRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

const columns: DataTableColumn<UserRow>[] = [
  { key: "name", header: "Имя", accessorKey: "name", sortable: true },
  { key: "email", header: "Email", accessorKey: "email" },
  { key: "role", header: "Роль", accessorKey: "role" },
];

export function UsersTable() {
  return (
    <DataTable
      data={users}
      columns={columns}
      searchable
      searchPlaceholder="Поиск пользователя..."
      pagination={{ pageSize: 10, showPageSizeSelect: true }}
    />
  );
}
\`\`\`

---

### **Параметры конфигурации колонок (\`DataTableColumn<T>\`)**
| Свойство | Тип | Описание |
| :--- | :--- | :--- |
| **\`key\`** | \`string\` | Уникальный идентификатор колонки |
| **\`header\`** | \`ReactNode | ((ctx) => ReactNode)\` | Заголовок колонки (текст или кастомная функция) |
| **\`accessorKey\`** | \`keyof T\` | Ключ свойства строки для извлечения значения |
| **\`cell\`** | \`((row: T, index: number) => ReactNode)\` | Кастомный рендерер ячейки |
| **\`sortable\`** | \`boolean\` | Включение интерактивной сортировки по клику на шапку |
| **\`align\`** | \`"left" | "center" | "right"\` | Выравнивание текста в ячейках |
| **\`width\`** | \`string | number\` | Фиксированная ширина колонки (например, \`"150px"\` или \`"25%"\`) |
| **\`className\`** | \`string\` | Дополнительные CSS-классы для ячеек |

---

### **Параметры пагинации (\`pagination\`)**
| Свойство | Тип | По умолчанию | Описание |
| :--- | :--- | :--- | :--- |
| **\`page\`** | \`number\` | \`1\` | Номер текущей страницы |
| **\`pageSize\`** | \`number\` | \`10\` | Количество строк на одной странице |
| **\`showPageSizeSelect\`** | \`boolean\` | \`true\` | Отображение выпадающего списка «Показывать по» (10, 20, 50) |
| **\`onPageChange\`** | \`((page: number) => void)\` | — | Колбэк при переключении страницы |
| **\`onPageSizeChange\`** | \`((size: number) => void)\` | — | Колбэк при выборе количества элементов |
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    data: {
      description:
        "Массив объектов строк таблицы. Каждая строка должна иметь уникальный `id` (`id: string | number`).",
      table: {
        type: { summary: "T[]" },
      },
    },
    columns: {
      description:
        "Конфигурация колонок таблицы (`key`, `header`, `accessorKey`, `cell`, `sortable`, `align`, `width`).",
      table: {
        type: { summary: "DataTableColumn<T>[]" },
      },
    },
    stickyHeader: {
      control: "boolean",
      description:
        "Закрепление шапки таблицы сверху при вертикальной прокрутке.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    maxHeight: {
      control: "text",
      description:
        "Максимальная высота контейнера таблицы при включенном `stickyHeader` (например, `400px` или `calc(100vh - 200px)`).",
      table: {
        type: { summary: "string | number" },
        defaultValue: { summary: "400px" },
      },
    },
    searchable: {
      control: "boolean",
      description:
        "Отображение встроенной панели поиска по таблице с иконкой `SearchIcon`.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    searchPlaceholder: {
      control: "text",
      description: "Плейсхолдер поля поиска.",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "Поиск по таблице..." },
      },
    },
    selectable: {
      control: "boolean",
      description:
        "Включение первого столбца с чекбоксами для множественного выбора строк.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    selectedKeys: {
      description: "Массив выбранных идентификаторов `id` строк.",
      table: {
        type: { summary: "Array<string | number>" },
        defaultValue: { summary: "[]" },
      },
    },
    onSelectionChange: {
      action: "selectionChanged",
      description:
        "Колбэк при изменении набора выбранных строк: `(keys, selectedRows) => void`.",
      table: {
        type: {
          summary: "(keys: (string | number)[], selectedRows: T[]) => void",
        },
      },
    },
    pagination: {
      description:
        "Настройки пагинации (`pageSize`, `showPageSizeSelect`, `onPageChange`, `onPageSizeChange`) или флаг `true`/`false`.",
      table: {
        type: { summary: "boolean | DataTablePaginationConfig" },
        defaultValue: { summary: "false" },
      },
    },
    loading: {
      control: "boolean",
      description:
        "Флаг состояния загрузки данных. Отображает затемняющий оверлей с анимированным компонентом `Spin`.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    emptyText: {
      control: "text",
      description:
        "Текст сообщения при отсутствии записей (использует компонент `Empty`).",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "Нет данных для отображения" },
      },
    },
    toolbarExtra: {
      description:
        "Дополнительные элементы управления в верхней панели тулбара (справа от строки поиска).",
      table: {
        type: { summary: "ReactNode" },
      },
    },
    className: {
      control: "text",
      description:
        "Дополнительные CSS-классы для корневого контейнера таблицы.",
      table: {
        type: { summary: "string" },
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DataTable<InterviewSession>>;

/**
 * Стандартная таблица со стилизацией, бейджами статусов, сортировкой и форматированием ячеек.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Базовое использование таблицы данных. Нажмите на заголовки «Кандидат», «Специализация», «Оценка AI», «Статус» или «Дата» для интерактивной сортировки.",
      },
    },
  },
  render: () => (
    <div className="w-full max-w-4xl mx-auto">
      <DataTable data={mockSessions} columns={columns} />
    </div>
  ),
};

/**
 * Фиксированная шапка при вертикальном скролле (Sticky Header).
 */
export const StickyHeader: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'При установке `stickyHeader={true}` и `maxHeight="260px"` шапка таблицы остается жестко зафиксированной сверху при прокрутке длинного списка строк.',
      },
    },
  },
  render: () => (
    <div className="w-full max-w-4xl mx-auto space-y-2">
      <span className="text-xs text-muted-foreground">
        Прокрутите таблицу вниз — шапка остается закрепленной сверху:
      </span>
      <DataTable
        data={mockSessions}
        columns={columns}
        stickyHeader
        maxHeight="260px"
      />
    </div>
  ),
};

/**
 * Таблица с активным поиском, пагинацией и селектом количества элементов (10, 20, 50).
 */
export const WithSearchAndPagination: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Встроенная панель поиска через `InputGroup` + `SearchIcon`, постраничная пагинация через `Pagination` и выпадающий селектор `Select` для выбора количества записей на странице (`10`, `20`, `50`).",
      },
    },
  },
  render: () => (
    <div className="w-full max-w-4xl mx-auto">
      <DataTable
        data={mockSessions}
        columns={columns}
        searchable
        searchPlaceholder="Поиск кандидата или роли..."
        pagination={{
          pageSize: 10,
          showPageSizeSelect: true,
        }}
        toolbarExtra={
          <Button size="sm">
            <PlusIcon size="xs" />
            Назначить интервью
          </Button>
        }
      />
    </div>
  ),
};

/**
 * Таблица с возможностью множественного выбора строк (Row Selection).
 */
export const WithRowSelection: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Включение флага `selectable={true}` добавляет первый столбец с чекбоксами `Checkbox`, поддержку выбора всех строк страницы (`selectAll` / `indeterminate`) и счетчик выбранных строк.",
      },
    },
  },
  render: () => {
    const [selected, setSelected] = React.useState<Array<string | number>>([
      "sess-1",
    ]);

    return (
      <div className="w-full max-w-4xl mx-auto space-y-3">
        <DataTable
          data={mockSessions}
          columns={columns}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
          searchable
          pagination={{ pageSize: 10, showPageSizeSelect: true }}
        />
      </div>
    );
  },
};

/**
 * Состояние загрузки данных (Loading overlay).
 */
export const LoadingState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Флаг `loading={true}` активирует полупрозрачный блюр-оверлей с анимированным спиннером `Spin size="lg"`.',
      },
    },
  },
  render: () => (
    <div className="w-full max-w-4xl mx-auto">
      <DataTable data={mockSessions} columns={columns} loading />
    </div>
  ),
};

/**
 * Пустое состояние таблицы (Empty state).
 */
export const EmptyState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "При передаче пустого массива `data={[]}` или когда в результате поиска не найдено совпадений, рендерится компонент `Empty` с настраиваемым сообщением `emptyText`.",
      },
    },
  },
  render: () => (
    <div className="w-full max-w-4xl mx-auto">
      <DataTable
        data={[]}
        columns={columns}
        searchable
        emptyText="Интервью не найдены"
      />
    </div>
  ),
};
