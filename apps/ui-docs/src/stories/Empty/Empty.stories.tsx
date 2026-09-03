import {
  FileIcon,
  FolderOpenIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
} from "@packages/icons";

import { Button, Empty } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Empty для Storybook.
 */
const meta = {
  title: "UI/Empty",
  component: Empty,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "card", "dashed"],
      description: "Стиль оформления контейнера",
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
      description: "Размер компонента",
    },
    title: {
      control: "text",
      description: "Заголовок (shorthand)",
    },
    description: {
      control: "text",
      description: "Описание (shorthand)",
    },
  },
  args: {
    variant: "default",
    size: "default",
  },
} satisfies Meta<typeof Empty>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Базовое состояние отсутствия данных по умолчанию.
 */
export const Default: Story = {
  args: {
    title: "Список собеседований пуст",
    description:
      "На данный момент у вас нет запланированных или завершенных собеседований.",
  },
};

/**
 * Пустое состояние с кнопкой целевого действия (Action).
 */
export const WithAction: Story = {
  render: () => (
    <div className="w-[450px]">
      <Empty>
        <Empty.Media>
          <FolderOpenIcon />
        </Empty.Media>
        <Empty.Title>Интервью не созданы</Empty.Title>
        <Empty.Description>
          Создайте ваше первое AI-интервью для практики ответов на технические
          вопросы.
        </Empty.Description>
        <Empty.Action>
          <Button>
            <PlusIcon />
            Создать интервью
          </Button>
        </Empty.Action>
      </Empty>
    </div>
  ),
};

/**
 * Состояние, когда ничего не найдено по результатам поиска или фильтрам.
 */
export const SearchNotFound: Story = {
  render: () => (
    <div className="w-[450px]">
      <Empty>
        <Empty.Media>
          <SearchIcon />
        </Empty.Media>
        <Empty.Title>Ничего не найдено</Empty.Title>
        <Empty.Description>
          По вашему запросу не найдено ни одного совпадения. Попробуйте изменить
          параметры поиска.
        </Empty.Description>
        <Empty.Action>
          <Button variant="outline">Сбросить фильтры</Button>
        </Empty.Action>
      </Empty>
    </div>
  ),
};

/**
 * Вариант с пунктирной рамкой (Dashed), отлично подходящий для пустых списков или зон загрузки.
 */
export const DashedVariant: Story = {
  render: () => (
    <div className="w-[480px]">
      <Empty variant="dashed">
        <Empty.Media>
          <FileIcon />
        </Empty.Media>
        <Empty.Title>Нет загруженных резюме</Empty.Title>
        <Empty.Description>
          Загрузите PDF или DOCX файл вашего резюме для генерации
          персонализированных вопросов.
        </Empty.Description>
        <Empty.Action>
          <Button variant="secondary">Загрузить резюме</Button>
        </Empty.Action>
      </Empty>
    </div>
  ),
};

/**
 * Вариант в виде карточки (Card) с фоном и границей.
 */
export const CardVariant: Story = {
  render: () => (
    <div className="w-[480px]">
      <Empty variant="card">
        <Empty.Media>
          <PackageIcon />
        </Empty.Media>
        <Empty.Title>Нет активных сессий</Empty.Title>
        <Empty.Description>
          Все сессии собеседований были успешно завершены и отправлены на оценку
          AI.
        </Empty.Description>
        <Empty.Action>
          <Button>Начать новую сессию</Button>
        </Empty.Action>
      </Empty>
    </div>
  ),
};

/**
 * Сравнение всех доступных размеров (sm, default, lg).
 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6 w-[500px]">
      <Empty
        size="sm"
        variant="outline"
        title="Компактный размер (SM)"
        description="Подходит для небольших модалок или сайдбаров."
      />
      <Empty
        size="default"
        variant="outline"
        title="Стандартный размер (Default)"
        description="Оптимален для основных разделов и списков."
      />
      <Empty
        size="lg"
        variant="outline"
        title="Крупный размер (LG)"
        description="Идеально для главных экранов пустых разделов приложения."
      />
    </div>
  ),
};

/**
 * Использование через удобные краткие пропсы (Shorthand syntax).
 */
export const ShorthandProps: Story = {
  render: () => (
    <div className="w-[450px]">
      <Empty
        variant="card"
        title="Уведомлений нет"
        description="Мы сообщим вам, когда появятся результаты вашего последнего интервью."
        action={<Button variant="outline">Обновить</Button>}
      />
    </div>
  ),
};
