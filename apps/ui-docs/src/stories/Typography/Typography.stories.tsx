import { Typography } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Typography для Storybook.
 */
const meta = {
  title: "UI/Typography",
  component: Typography,
  subcomponents: {
    "Typography.H1": Typography.H1,
    "Typography.H2": Typography.H2,
    "Typography.H3": Typography.H3,
    "Typography.H4": Typography.H4,
    "Typography.P": Typography.P,
    "Typography.Lead": Typography.Lead,
    "Typography.Large": Typography.Large,
    "Typography.Small": Typography.Small,
    "Typography.Muted": Typography.Muted,
    "Typography.Code": Typography.Code,
    "Typography.Blockquote": Typography.Blockquote,
  },
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "h1",
        "h2",
        "h3",
        "h4",
        "p",
        "lead",
        "large",
        "small",
        "muted",
        "code",
        "blockquote",
      ],
      description: "Вариант типографического оформления",
    },
    asChild: {
      control: "boolean",
      description: "Использовать дочерний элемент как слот (Slot)",
    },
  },
  args: {
    variant: "p",
    asChild: false,
  },
} satisfies Meta<typeof Typography>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Обзор всех вариантов типографики.
 */
export const Overview: Story = {
  render: () => (
    <div className="max-w-2xl space-y-6">
      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          H1 (Главный заголовок):
        </span>
        <Typography.H1>Подготовка к техническим собеседованиям</Typography.H1>
      </div>

      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          H2 (Заголовок секции):
        </span>
        <Typography.H2>Система оценки навыков</Typography.H2>
      </div>

      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          H3 (Подзаголовок):
        </span>
        <Typography.H3>Архитектура и алгоритмы</Typography.H3>
      </div>

      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          H4 (Заголовок карточки):
        </span>
        <Typography.H4>Быстрый старт с MockInterview AI</Typography.H4>
      </div>

      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          Lead (Лид-параграф):
        </span>
        <Typography.Lead>
          Интеллектуальная платформа с искусственным интеллектом для практики и
          анализа ответов в реальном времени.
        </Typography.Lead>
      </div>

      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          P (Основной текст):
        </span>
        <Typography.P>
          Пройдите реалистичную симуляцию интервью, получите подробный отчет с
          разбором ошибок и персональные рекомендации по улучшению.
        </Typography.P>
      </div>

      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          Large (Крупный текст):
        </span>
        <Typography.Large>
          Более 1,500 вопросов по Frontend, Backend и System Design.
        </Typography.Large>
      </div>

      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          Small (Мелкий текст):
        </span>
        <Typography.Small>
          Обновлено сегодня в 14:00 • Версия 2.4.0
        </Typography.Small>
      </div>

      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          Muted (Приглушенный текст):
        </span>
        <Typography.Muted>
          Результаты интервью доступны только вам и вашему ментору.
        </Typography.Muted>
      </div>

      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          Code (Инлайн-код):
        </span>
        <Typography.P>
          Используйте хук <Typography.Code>useInterview()</Typography.Code> для
          управления состоянием сессии.
        </Typography.P>
      </div>

      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          Blockquote (Цитата):
        </span>
        <Typography.Blockquote>
          «Практика и обратная связь — ключевые факторы успешного прохождения
          любого технического скрининга.»
        </Typography.Blockquote>
      </div>
    </div>
  ),
};

/**
 * Пример связной статьи или документации.
 */
export const ArticleExample: Story = {
  render: () => (
    <div className="max-w-xl space-y-4">
      <Typography.H1>Как устроен AI-интервьюер</Typography.H1>
      <Typography.Lead>
        Анализ ответов происходит на базе языковой модели с динамической
        адаптацией сложности вопросов.
      </Typography.Lead>
      <Typography.P>
        В процессе диалога система отслеживает структуру аргументации кандидата,
        глубину владения технологиями и способность решать нестандартные кейсы.
      </Typography.P>
      <Typography.H2>Пошаговый процесс</Typography.H2>
      <Typography.P>
        После генерации вопроса кандидат записывает ответ голосом или текстом.
        Затем функция <Typography.Code>evaluateAnswer()</Typography.Code>{" "}
        формирует детальный скоринг.
      </Typography.P>
      <Typography.Blockquote>
        «Точность оценки кандидатов повысилась на 42% по сравнению с базовыми
        тестами.»
      </Typography.Blockquote>
      <Typography.Muted>
        Статистика собрана на основе 5,000 проведённых сессий.
      </Typography.Muted>
    </div>
  ),
};

/**
 * Пример полиморфизма (переопределение HTML-тега через пропс as).
 */
export const CustomTagPolymorphic: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          Визуальный стиль H2, но тег &lt;span&gt; в DOM:
        </span>
        <Typography as="span" variant="h2">
          Стилизованный span
        </Typography>
      </div>
      <div>
        <span className="text-xs text-muted-foreground block mb-1">
          Визуальный стиль Lead, но тег &lt;div&gt;:
        </span>
        <Typography as="div" variant="lead">
          Полиморфный блок
        </Typography>
      </div>
    </div>
  ),
};
