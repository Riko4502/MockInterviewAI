import { Button, Toast, type ToastStatus, useToast } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Пропсы для интерактивной демонстрации Toast в Storybook.
 */
interface ToastStoryProps {
  status: ToastStatus;
  title: string;
  description?: string;
  duration?: number;
  showCloseButton?: boolean;
}

/**
 * Метаданные компонента Toast для Storybook.
 */
const meta: Meta<ToastStoryProps> = {
  title: "Components/Toast",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Toast** — всплывающие уведомления

Компонент для оповещения пользователя о результатах асинхронных операций (успех, ошибка, предупреждение, информирование).
Основан на **Radix Toast** и полностью стилизован в соответствии с дизайн-системой проекта (Tailwind CSS v4).

---

### **Установка и импорт**
\`\`\`tsx
import { Toast, useToast, ToastProvider, UIProvider } from "@packages/ui";
\`\`\`

---

### **Составные элементы (Compound Components)**
| Элемент | Описание |
| :--- | :--- |
| **\`Toast\`** | Корневой контейнер отдельного тоста (\`status\`, \`duration\`, \`open\`, \`onOpenChange\`, \`showCloseButton\`) |
| **\`Toast.Title\`** | Заголовок уведомления |
| **\`Toast.Description\`** | Текст описания с приглушенным цветом |
| **\`Toast.Action\`** | Интерактивная кнопка действия (\`altText\`, \`onClick\`) |
| **\`Toast.Close\`** | Кнопка ручного закрытия тоста (крестик) |
| **\`Toast.Viewport\`** | Фиксированная область размещения очереди тостов на экране |
| **\`Toast.Provider\`** | Корневой контекст Radix Toast |

---

### **Использование через хук \`useToast()\`**
\`\`\`tsx
function MyComponent() {
  const toast = useToast();

  const handleSave = () => {
    toast.push({
      status: "success", // "default" | "success" | "destructive" | "error" | "warning" | "info"
      title: "Данные сохранены",
      description: "Результаты собеседования успешно отправлены.",
      duration: 5000,
      action: {
        label: "Отмена",
        onClick: () => console.log("Undo action triggered"),
      },
    });
  };

  return <Button onClick={handleSave}>Сохранить</Button>;
}
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: [
        "default",
        "success",
        "destructive",
        "error",
        "warning",
        "info",
      ],
      description: "Цветовой и визуальный статус уведомления.",
      table: {
        category: "Toast",
        type: {
          summary:
            "'default' | 'success' | 'destructive' | 'error' | 'warning' | 'info'",
        },
        defaultValue: { summary: "'success'" },
      },
    },
    title: {
      control: "text",
      description: "Текст заголовка уведомления.",
      table: {
        category: "Content",
        type: { summary: "string" },
        defaultValue: { summary: "'Операция выполнена'" },
      },
    },
    description: {
      control: "text",
      description: "Текст подробного описания уведомления.",
      table: {
        category: "Content",
        type: { summary: "string" },
      },
    },
    duration: {
      control: "number",
      description:
        "Время показа в миллисекундах перед автоматическим закрытием.",
      table: {
        category: "Toast",
        type: { summary: "number" },
        defaultValue: { summary: "5000" },
      },
    },
    showCloseButton: {
      control: "boolean",
      description: "Отображать ли кнопку закрытия (крестик).",
      table: {
        category: "Toast",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
  },
};

export default meta;
type Story = StoryObj<ToastStoryProps>;

function ToastInteractiveLauncher(args: ToastStoryProps) {
  const toast = useToast();

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="text-center space-y-1 mb-2">
        <p className="text-sm font-semibold text-foreground">
          Интерактивный вызов Toast
        </p>
        <p className="text-xs text-muted-foreground">
          Настройте параметры в панели Controls ниже и нажмите кнопку вызова:
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={() =>
            toast.push({
              status: args.status,
              title: args.title,
              description: args.description,
              duration: args.duration,
              showCloseButton: args.showCloseButton,
            })
          }
        >
          Запустить Toast ({args.status})
        </Button>
        <Button variant="outline" onClick={() => toast.allDismiss()}>
          Закрыть все (allDismiss)
        </Button>
      </div>
    </div>
  );
}

/**
 * Интерактивный запуск Toast с управлением пропсами из таблицы Controls.
 */
export const Default: Story = {
  args: {
    status: "success",
    title: "Интервью завершено",
    description: "Оценка AI сформирована и доступна в аналитике профиля.",
    duration: 5000,
    showCloseButton: true,
  },
  render: (args) => <ToastInteractiveLauncher {...args} />,
};

function ToastDemo() {
  const toast = useToast();

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="flex flex-wrap gap-2 justify-center max-w-xl">
        <Button
          onClick={() =>
            toast.push({
              status: "default",
              title: "Уведомление",
              description: "Стандартное системное сообщение платформы.",
            })
          }
        >
          Default Toast
        </Button>

        <Button
          variant="success"
          onClick={() =>
            toast.push({
              status: "success",
              title: "Решение принято",
              description: "Все unit-тесты успешно пройдены.",
            })
          }
        >
          Success Toast
        </Button>

        <Button
          variant="destructive"
          onClick={() =>
            toast.push({
              status: "error",
              title: "Ошибка компиляции",
              description:
                "Не удалось выполнить код: синтаксическая ошибка в строке 14.",
            })
          }
        >
          Error Toast
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            toast.push({
              status: "warning",
              title: "Лимит времени",
              description: "До окончания секции кодинга осталось 5 минут.",
            })
          }
        >
          Warning Toast
        </Button>

        <Button
          variant="secondary"
          onClick={() =>
            toast.push({
              status: "info",
              title: "Новая подсказка",
              description: "AI-интервьюер добавил комментарий к решению.",
            })
          }
        >
          Info Toast
        </Button>
      </div>

      <div className="flex gap-3 mt-2">
        <Button
          variant="outline"
          onClick={() =>
            toast.push({
              status: "info",
              title: "Код скопирован",
              description: "Фрагмент решения сохранён в буфер обмена.",
              action: {
                label: "Повторить",
                onClick: () => alert("Действие выполнено"),
              },
            })
          }
        >
          Toast с кнопкой действия (Action)
        </Button>

        <Button variant="ghost" onClick={() => toast.allDismiss()}>
          Закрыть все тосты (allDismiss)
        </Button>
      </div>
    </div>
  );
}

/**
 * Быстрый запуск всех типов уведомлений по кнопкам.
 */
export const QuickLaunch: Story = {
  render: () => <ToastDemo />,
};

/**
 * Статическое отображение всех вариантов оформления карточек Toast.
 */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-[420px] max-w-full p-4">
      <Toast status="default">
        <div className="flex flex-col gap-1">
          <Toast.Title>Default Toast</Toast.Title>
          <Toast.Description>
            Стандартное уведомление системы.
          </Toast.Description>
        </div>
      </Toast>

      <Toast status="success">
        <div className="flex flex-col gap-1">
          <Toast.Title>Success Toast</Toast.Title>
          <Toast.Description>Операция успешно завершена.</Toast.Description>
        </div>
      </Toast>

      <Toast status="destructive">
        <div className="flex flex-col gap-1">
          <Toast.Title>Destructive Toast</Toast.Title>
          <Toast.Description>Произошла критическая ошибка.</Toast.Description>
        </div>
      </Toast>

      <Toast status="warning">
        <div className="flex flex-col gap-1">
          <Toast.Title>Warning Toast</Toast.Title>
          <Toast.Description>
            Обратите внимание на предупреждение.
          </Toast.Description>
        </div>
      </Toast>

      <Toast status="info">
        <div className="flex flex-col gap-1">
          <Toast.Title>Info Toast</Toast.Title>
          <Toast.Description>
            Информационное сообщение для пользователя.
          </Toast.Description>
        </div>
      </Toast>
    </div>
  ),
};

/**
 * Демонстрация эффекта гармошки/стопки при нескольких активных тостах.
 */
function ToastStackedDemo() {
  const toast = useToast();

  const handleCreateBatch = () => {
    toast.push({
      status: "default",
      title: "1. Инициализация проекта",
      description: "Создание рабочего окружения и контейнеров...",
      duration: 15000,
    });
    toast.push({
      status: "info",
      title: "2. Загрузка данных",
      description: "Импорт структуры тестов и кодовой базы.",
      duration: 15000,
    });
    toast.push({
      status: "warning",
      title: "3. Проверка зависимостей",
      description: "Обнаружено предупреждение о версии пакета.",
      duration: 15000,
    });
    toast.push({
      status: "success",
      title: "4. Готово к работе",
      description: "Все сервисы успешно запущены и готовы к сессии.",
      duration: 15000,
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="text-center space-y-1 mb-2">
        <p className="text-sm font-semibold text-foreground">
          Группировка тостов в стопку («гармошка»)
        </p>
        <p className="text-xs text-muted-foreground max-w-md">
          Нажмите кнопку, чтобы запустить несколько уведомлений. Они аккуратно
          складываются в стопку, а при наведении курсора раздвигаются вверх в
          полный список.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleCreateBatch}>
          Запустить пачку тостов (4 шт.)
        </Button>
        <Button variant="outline" onClick={() => toast.allDismiss()}>
          Очистить все
        </Button>
      </div>
    </div>
  );
}

export const StackedAccordion: Story = {
  render: () => <ToastStackedDemo />,
};
