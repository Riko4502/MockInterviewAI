import { LoadingScreen } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * LoadingScreen — фирменный экран загрузки с анимированным логотипом,
 * фоновым динамическим градиентом, прогресс-баром и индикацией этапов инициализации.
 */
const meta = {
  title: "Components/LoadingScreen",
  component: LoadingScreen,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  argTypes: {
    title: {
      control: "text",
      description: "Главный заголовок экрана загрузки",
    },
    description: {
      control: "text",
      description: "Подзаголовок или описание текущего действия",
    },
    badgeText: {
      control: "text",
      description: "Текст статус-бейджа",
    },
    variant: {
      control: "select",
      options: ["fullscreen", "contained"],
      description:
        "Режим отображения: полноэкранный (fullscreen) или внутри контейнера (contained)",
    },
    showBackground: {
      control: "boolean",
      description: "Показывать ли динамический фоновый градиент и сетку",
    },
    showLogo: {
      control: "boolean",
      description: "Показывать ли анимированный логотип бренда",
    },
    showProgress: {
      control: "boolean",
      description: "Отображать ли анимированный прогресс-бар",
    },
    systemActiveText: {
      control: "text",
      description: "Текст активного статуса в футере карточки",
    },
    brandLabel: {
      control: "text",
      description: "Текст бренда в футере карточки",
    },
  },
  args: {
    title: "MockInterview AI",
    description: "Подготовка рабочего пространства...",
    badgeText: "ПОДГОТОВКА СИСТЕМЫ",
    variant: "fullscreen",
    showBackground: true,
    showLogo: true,
    showProgress: true,
    systemActiveText: "AI ENGINE ACTIVE",
    brandLabel: "MOCK INTERVIEW AI",
    steps: [
      "Проверка окружения",
      "Синхронизация сессии",
      "Подготовка компонентов",
    ],
  },
} satisfies Meta<typeof LoadingScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартный полноэкранный экран загрузки.
 */
export const Default: Story = {
  args: {},
};

/**
 * Экран загрузки внутри ограниченного контейнера (например, для модальных окон или виджетов).
 */
export const Contained: Story = {
  parameters: {
    layout: "centered",
  },
  render: (args) => (
    <div className="relative w-[500px] h-[460px] rounded-xl border border-border overflow-hidden shadow-2xl">
      <LoadingScreen {...args} variant="contained" />
    </div>
  ),
};

/**
 * Пользовательские этапы загрузки (например, при восстановлении сессии пользователя).
 */
export const CustomSteps: Story = {
  args: {
    title: "Восстановление сессии",
    description: "Авторизация и получение данных профиля...",
    badgeText: "СИНХРОНИЗАЦИЯ",
    steps: [
      "Проверка токена доступа",
      "Загрузка пользовательских настроек",
      "Подключение к Realtime-шлюзу",
      "Готово к работе",
    ],
  },
};

/**
 * Минималистичный режим без фонового градиента и логотипа.
 */
export const Minimal: Story = {
  args: {
    showBackground: false,
    showLogo: false,
    title: "Быстрая загрузка",
    description: "Пожалуйста, подождите...",
    badgeText: "ЗАГРУЗКА",
  },
};

/**
 * Экран загрузки без прогресс-бара.
 */
export const WithoutProgress: Story = {
  args: {
    showProgress: false,
    title: "Обработка запроса",
    description: "ИИ анализирует технический ответ...",
    badgeText: "АНАЛИЗ",
  },
};
