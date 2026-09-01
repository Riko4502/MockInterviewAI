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
      <div className="flex flex-col items-center gap-4">
        <span className="text-xs text-muted-foreground">
          Текущая страница: <strong>{page}</strong> из {totalPages}
        </span>

        <Pagination>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                className="cursor-pointer"
                onClick={(e: { preventDefault: () => void }) => {
                  e.preventDefault();
                  if (page > 1) setPage((p) => p - 1);
                }}
              />
            </Pagination.Item>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Pagination.Item key={p}>
                <Pagination.Link
                  className="cursor-pointer"
                  isActive={p === page}
                  onClick={(e) => {
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
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  if (page < totalPages) setPage((p) => p + 1);
                }}
              />
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </div>
    );
  },
};

/**
 * Компактный режим с иконками без подписей (отлично для мобильных экранов).
 */
export const Compact: Story = {
  render: () => (
    <Pagination>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous href="#" label={null} size="icon" />
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#">1</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#" isActive>
            2
          </Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#">3</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Next href="#" label={null} size="icon" />
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  ),
};

/**
 * Состояние первой страницы с заблокированной кнопкой «Назад».
 */
export const DisabledEdges: Story = {
  render: () => (
    <Pagination>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous
            href="#"
            className="pointer-events-none opacity-50"
            aria-disabled="true"
          />
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
          <Pagination.Next href="#" />
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  ),
};
