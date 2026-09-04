import { Breadcrumb } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";

type BreadcrumbStoryArgs = ComponentProps<typeof Breadcrumb> & {
  asChild?: boolean;
  href?: string;
  separator?: "chevron" | "slash";
};

const meta: Meta<BreadcrumbStoryArgs> = {
  title: "UI/Breadcrumb",
  component: Breadcrumb,
  subcomponents: {
    List: Breadcrumb.List,
    Item: Breadcrumb.Item,
    Link: Breadcrumb.Link,
    Page: Breadcrumb.Page,
    Separator: Breadcrumb.Separator,
    Ellipsis: Breadcrumb.Ellipsis,
  },
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
Составной компонент: **Breadcrumb** (корень) + **Breadcrumb.List** + **Breadcrumb.Item** + **Breadcrumb.Link** + **Breadcrumb.Page** + **Breadcrumb.Separator** + **Breadcrumb.Ellipsis**.

Пропсы живут у частей, не у корня. Корень — это \`nav\` с \`aria-label="breadcrumb"\`.

**Как собирать:**
\`\`\`tsx
<Breadcrumb>
  <Breadcrumb.List>
    <Breadcrumb.Item>
      <Breadcrumb.Link href="/interviews">Interviews</Breadcrumb.Link>
    </Breadcrumb.Item>
    <Breadcrumb.Separator />
    <Breadcrumb.Item>
      <Breadcrumb.Page>Session</Breadcrumb.Page>
    </Breadcrumb.Item>
  </Breadcrumb.List>
</Breadcrumb>
\`\`\`

Промежуточные сегменты — \`Breadcrumb.Link\`. Текущая страница — \`Breadcrumb.Page\`, не ссылка.
        `,
      },
    },
  },
  tags: ["autodocs"],
  args: {
    separator: "chevron",
  },
  argTypes: {
    className: {
      control: "text",
      description: "Дополнительные Tailwind-классы на корневой nav.",
      table: { category: "Breadcrumb (Root)" },
    },
    "aria-label": {
      control: "text",
      description:
        'Подпись навигации для скринридера. По умолчанию "breadcrumb". Можно переопределить.',
      table: { category: "Breadcrumb (Root)" },
    },
    href: {
      control: false,
      description:
        "Адрес ссылки. Передаётся в Breadcrumb.Link, как у обычного <a>. В приложении для next/link используй asChild.",
      table: { category: "Breadcrumb.Link" },
    },
    asChild: {
      control: false,
      description:
        "Если true, Breadcrumb.Link не рендерит свой <a>, а навешивает стили на ребёнка через Slot (как Button).",
      table: { category: "Breadcrumb.Link" },
    },
    separator: {
      control: "radio",
      options: ["chevron", "slash"],
      description:
        "Разделитель между сегментами. По умолчанию иконка ChevronRight. Любые children у Breadcrumb.Separator заменяют её — например «/».",
      table: { category: "Breadcrumb.Separator" },
    },
    children: {
      control: false,
      description:
        'Текст текущей страницы внутри Breadcrumb.Page. Не ссылка — aria-current="page" ставится сам.',
      table: { category: "Breadcrumb.Page" },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: ({ separator = "chevron", className, "aria-label": ariaLabel }) => {
    const separatorContent = separator === "slash" ? "/" : undefined;

    return (
      <Breadcrumb className={className} aria-label={ariaLabel}>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link href="/dashboard">Dashboard</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator>{separatorContent}</Breadcrumb.Separator>
          <Breadcrumb.Item>
            <Breadcrumb.Link href="/interviews">Interviews</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator>{separatorContent}</Breadcrumb.Separator>
          <Breadcrumb.Item>
            <Breadcrumb.Page>Session</Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb>
    );
  },
};

export const CurrentPageOnly: Story = {
  render: () => (
    <Breadcrumb>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Page>Session</Breadcrumb.Page>
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb>
  ),
};

export const WithEllipsis: Story = {
  render: () => (
    <Breadcrumb>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/">Home</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Ellipsis />
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/interviews">Interviews</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Page>Session</Breadcrumb.Page>
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb>
  ),
};

export const LongTrail: Story = {
  render: () => (
    <Breadcrumb>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/dashboard">Dashboard</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/interviews">Interviews</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/interviews/frontend">
            Frontend
          </Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/interviews/frontend/session">
            Session
          </Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Page>Feedback</Breadcrumb.Page>
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb>
  ),
};

export const CustomSeparator: Story = {
  render: () => (
    <Breadcrumb>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/interviews">Interviews</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator>/</Breadcrumb.Separator>
        <Breadcrumb.Item>
          <Breadcrumb.Page>Session</Breadcrumb.Page>
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb>
  ),
};
