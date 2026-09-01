import { Pagination } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

/**
 * Метаданные компонента Pagination для Storybook.
 */
const meta = {
  title: "Components/Pagination",
  component: Pagination,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Pagination** — постраничная навигация

Набор компонентов для построения постраничной навигации по спискам, таблицам и каталогам. Состоит из \`Pagination\`, \`Pagination.Content\`, \`Pagination.Item\`, \`Pagination.Link\`, \`Pagination.Previous\`, \`Pagination.Next\`, \`Pagination.Ellipsis\`.

---

### **Установка и импорт**
\`\`\`tsx
import { Pagination } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Pagination>
  <Pagination.Content>
    <Pagination.Item>
      <Pagination.Previous onClick={() => setPage(p => p - 1)} />
    </Pagination.Item>
    <Pagination.Item>
      <Pagination.Link isActive={page === 1} onClick={() => setPage(1)}>1</Pagination.Link>
    </Pagination.Item>
    <Pagination.Item>
      <Pagination.Link isActive={page === 2} onClick={() => setPage(2)}>2</Pagination.Link>
    </Pagination.Item>
    <Pagination.Item>
      <Pagination.Next onClick={() => setPage(p => p + 1)} />
    </Pagination.Item>
  </Pagination.Content>
</Pagination>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартная пагинация с многоточием и кнопками «Назад» / «Вперед».
 */
export const Default: Story = {
  render: () => (
    <Pagination>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous href="#" />
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#" isActive>
            1
          </Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#">2</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#">3</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Ellipsis />
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#">10</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Next href="#" />
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  ),
};

/**
 * Интерактивный пример с переключением активной страницы.
 */
export const InteractiveControlled: Story = {
  render: () => {
    const [page, setPage] = React.useState(3);
    const totalPages = 8;

    return (
      <div className="space-y-4 text-center">
        <div className="text-xs text-muted-foreground">
          Текущая активная страница:{" "}
          <strong className="text-foreground">{page}</strong> из {totalPages}
        </div>

        <Pagination>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                className={
                  page === 1
                    ? "pointer-events-none opacity-40"
                    : "cursor-pointer"
                }
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  if (page > 1) setPage(page - 1);
                }}
              />
            </Pagination.Item>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Pagination.Item key={p}>
                <Pagination.Link
                  className="cursor-pointer"
                  isActive={p === page}
                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.preventDefault();
                    setPage(p);
                  }}
                >
                  {p}
                </Pagination.Link>
              </Pagination.Item>
            ))}

            <Pagination.Item>
              <Pagination.Next
                className={
                  page === totalPages
                    ? "pointer-events-none opacity-40"
                    : "cursor-pointer"
                }
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.preventDefault();
                  if (page < totalPages) setPage(page + 1);
                }}
              />
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </div>
    );
  },
};
