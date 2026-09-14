import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  InfoIcon,
} from "@packages/icons";
import { Alert, Button } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

interface StoryAlertProps {
  // Alert Root
  variant?: "default" | "destructive" | "warning" | "info" | "success";
  role?: string;
  className?: string;
  // Alert.Title
  title?: string;
  // Alert.Description
  description?: string;
  // Controls
  showIcon?: boolean;
}

/**
 * Метаданные компонента Alert для Storybook.
 */
const meta = {
  title: "Components/Alert",
  component: Alert,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Alert** — компонент баннеров, предупреждений и уведомлений

Составной компонент: **Alert** (корень) + **Alert.Title** (заголовок) + **Alert.Description** (описание).
Используется для информирования пользователя о важных событиях, ошибках валидации, результатах операций и системных подсказках.

---

### **Установка и импорт**
\`\`\`tsx
import { Alert } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Alert variant="destructive">
  <AlertCircleIcon />
  <Alert.Title>Ошибка авторизации</Alert.Title>
  <Alert.Description>Неверный логин или пароль. Попробуйте снова.</Alert.Description>
</Alert>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    // --- Alert Root ---
    variant: {
      control: "select",
      options: ["default", "destructive", "warning", "info", "success"],
      description:
        "Вариант оформления алерта: `default` (нейтральный), `destructive` (ошибка/критично), `warning` (предупреждение), `info` (информация), `success` (успех).",
      table: {
        category: "Alert (Root)",
        type: {
          summary: '"default" | "destructive" | "warning" | "info" | "success"',
        },
        defaultValue: { summary: '"default"' },
      },
    },
    role: {
      control: "select",
      options: ["alert", "status", "region"],
      description:
        "ARIA-роль контейнера для скринридеров и ассистивных технологий.",
      table: {
        category: "Alert (Root)",
        type: { summary: '"alert" | "status" | "region"' },
        defaultValue: { summary: '"alert"' },
      },
    },
    className: {
      control: "text",
      description:
        "Дополнительные CSS-классы Tailwind для корневого контейнера.",
      table: {
        category: "Alert (Root)",
        type: { summary: "string" },
      },
    },
    // --- Alert.Title ---
    title: {
      control: "text",
      description: "Текст заголовка (`Alert.Title`).",
      table: {
        category: "Alert.Title",
        type: { summary: "string | ReactNode" },
      },
    },
    // --- Alert.Description ---
    description: {
      control: "text",
      description:
        "Текст описания или детальной информации (`Alert.Description`).",
      table: {
        category: "Alert.Description",
        type: { summary: "string | ReactNode" },
      },
    },
    // --- Extra Controls ---
    showIcon: {
      control: "boolean",
      description: "Отображать ли статусную иконку слева от заголовка.",
      table: {
        category: "Интерактивные параметры",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
  },
  args: {
    variant: "info",
    role: "alert",
    title: "Обновление платформы",
    description:
      "Запланированы технические работы в 03:00 UTC. Доступ к комнатам интервью может быть временно ограничен.",
    showIcon: true,
  },
} satisfies Meta<StoryAlertProps>;

export default meta;
type Story = StoryObj<StoryAlertProps>;

/**
 * Интерактивный алерт по умолчанию с возможностью переключения всех пропсов и текста в Controls.
 */
export const Default: Story = {
  render: ({ variant, role, className, title, description, showIcon }) => {
    const getIcon = () => {
      if (!showIcon) return null;
      switch (variant) {
        case "destructive":
          return <AlertCircleIcon />;
        case "warning":
          return <AlertTriangleIcon />;
        case "success":
          return <CheckIcon />;
        default:
          return <InfoIcon />;
      }
    };

    return (
      <div className="w-[480px]">
        <Alert variant={variant} role={role} className={className}>
          {getIcon()}
          {title && <Alert.Title>{title}</Alert.Title>}
          {description && <Alert.Description>{description}</Alert.Description>}
        </Alert>
      </div>
    );
  },
};

/**
 * Все варианты оформления компонента Alert.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-[500px]">
      <Alert variant="default">
        <InfoIcon />
        <Alert.Title>Нейтральное уведомление</Alert.Title>
        <Alert.Description>
          Стандартное сообщение для контекстных подсказок.
        </Alert.Description>
      </Alert>

      <Alert variant="info">
        <InfoIcon />
        <Alert.Title>Информация</Alert.Title>
        <Alert.Description>
          Ссылка для входа в комнату отправлена на ваш email.
        </Alert.Description>
      </Alert>

      <Alert variant="success">
        <CheckIcon />
        <Alert.Title>Успешно сохранено</Alert.Title>
        <Alert.Description>
          Пароль успешно обновлен. Используйте новый пароль для входа.
        </Alert.Description>
      </Alert>

      <Alert variant="warning">
        <AlertTriangleIcon />
        <Alert.Title>Внимание</Alert.Title>
        <Alert.Description>
          Время действия заявки истекает через 2 часа.
        </Alert.Description>
      </Alert>

      <Alert variant="destructive">
        <AlertCircleIcon />
        <Alert.Title>Ошибка подключения</Alert.Title>
        <Alert.Description>
          Токен сброса пароля недействителен или истек. Запросите новую ссылку.
        </Alert.Description>
      </Alert>
    </div>
  ),
};

/**
 * Алерт с кнопкой действия (Action Button).
 */
export const WithAction: Story = {
  render: () => (
    <div className="w-[480px]">
      <Alert variant="warning">
        <AlertTriangleIcon />
        <Alert.Title>Разрешение на уведомления</Alert.Title>
        <Alert.Description>
          Включите уведомления в браузере, чтобы не пропустить начало интервью.
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="default">
              Включить
            </Button>
            <Button size="sm" variant="outline">
              Позже
            </Button>
          </div>
        </Alert.Description>
      </Alert>
    </div>
  ),
};

/**
 * Компактный алерт без описания (только заголовок).
 */
export const TitleOnly: Story = {
  render: () => (
    <div className="w-[450px] space-y-3">
      <Alert variant="info">
        <InfoIcon />
        <Alert.Title>Сессия начнется через 5 минут</Alert.Title>
      </Alert>
      <Alert variant="success">
        <CheckIcon />
        <Alert.Title>Микрофон и камера успешно проверены</Alert.Title>
      </Alert>
    </div>
  ),
};
