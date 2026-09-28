import { AppPreloader, Button, Card } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

/**
 * AppPreloader — компонент верхнего уровня для экранирования интерфейса во время
 * инициализации приложения, загрузки чанков или восстановления пользовательской сессии.
 * Пока прелоадер отображается, дочернее дерево изолируется с помощью атрибута `inert`.
 */
const meta = {
  title: "Components/AppPreloader",
  component: AppPreloader,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  argTypes: {
    isReady: {
      control: "boolean",
      description:
        "Флаг готовности приложения/сессии. Пока false — прелоадер не исчезнет",
    },
    minDuration: {
      control: "number",
      description: "Минимальное время показа лоадера в мс",
    },
    fadeDuration: {
      control: "number",
      description: "Длительность анимации плавного затухания (fade-out) в мс",
    },
    oncePerSession: {
      control: "boolean",
      description: "Показывать только один раз за сессию вкладки браузера",
    },
    sessionKey: {
      control: "text",
      description: "Ключ в sessionStorage для режима oncePerSession",
    },
    title: {
      control: "text",
      description: "Главный заголовок экрана загрузки",
    },
    description: {
      control: "text",
      description: "Описание выполняемого процесса",
    },
  },
  args: {
    isReady: true,
    minDuration: 1200,
    fadeDuration: 500,
    oncePerSession: false,
    sessionKey: "storybook_preloader_demo",
    title: "MockInterview AI",
    description: "Подготовка сессии...",
  },
} satisfies Meta<typeof AppPreloader>;

export default meta;
type Story = StoryObj<typeof meta>;

function MockPageContent() {
  const [clickCount, setClickCount] = React.useState(0);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8">
      <Card className="w-full max-w-md p-6 space-y-4 shadow-xl border-border">
        <Card.Header className="p-0">
          <Card.Title>Рабочая область дашборда</Card.Title>
          <Card.Description>
            Контент страницы был безопасно смонтирован под прелоадером с
            атрибутом <code>inert</code>.
          </Card.Description>
        </Card.Header>
        <Card.Content className="p-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            Фокус и взаимодействие были заблокированы до окончания анимации
            затухания.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={() => setClickCount((c) => c + 1)}>
              Интерактивная кнопка ({clickCount})
            </Button>
            <Button variant="outline">Другое действие</Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

/**
 * Базовый пример прелоадера с автоматическим скрытием через minDuration + fadeDuration.
 */
export const Default: Story = {
  render: (args) => (
    <AppPreloader {...args}>
      <MockPageContent />
    </AppPreloader>
  ),
};

/**
 * Интерактивный перезапуск прелоадера по клику.
 */
export const InteractiveReplay: Story = {
  render: (args) => {
    const [key, setKey] = React.useState(0);

    return (
      <div>
        <div className="fixed top-4 right-4 z-[60]">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setKey((k) => k + 1)}
          >
            Перезапустить прелоадер
          </Button>
        </div>
        <AppPreloader key={key} {...args}>
          <MockPageContent />
        </AppPreloader>
      </div>
    );
  },
};

/**
 * Быстрый переход (minDuration: 300ms, fadeDuration: 300ms) для мгновенной загрузки.
 */
export const FastTransition: Story = {
  args: {
    minDuration: 300,
    fadeDuration: 300,
  },
  render: (args) => {
    const [key, setKey] = React.useState(0);

    return (
      <div>
        <div className="fixed top-4 right-4 z-[60]">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setKey((k) => k + 1)}
          >
            Запустить быстрый прелоадер
          </Button>
        </div>
        <AppPreloader key={key} {...args}>
          <MockPageContent />
        </AppPreloader>
      </div>
    );
  },
};

function AsyncReadyContent(props: React.ComponentProps<typeof AppPreloader>) {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AppPreloader
      {...props}
      isReady={isReady}
      title="Проверка авторизации"
      description={
        isReady
          ? "Сессия подтверждена!"
          : "Запрос к серверу авторизации (2 сек)..."
      }
    >
      <MockPageContent />
    </AppPreloader>
  );
}

/**
 * Симуляция асинхронной загрузки данных / сессии (isReady переключается через 2 сек).
 */
export const AsyncReadyGate: Story = {
  render: (args) => {
    const [key, setKey] = React.useState(0);

    return (
      <div>
        <div className="fixed top-4 right-4 z-[60]">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setKey((k) => k + 1)}
          >
            Повторить асинхронную загрузку
          </Button>
        </div>
        <AsyncReadyContent key={key} {...args} />
      </div>
    );
  },
};

/**
 * Режим `oncePerSession`: отображается один раз за сессию вкладки.
 */
export const OncePerSessionMode: Story = {
  args: {
    oncePerSession: true,
    sessionKey: "storybook_demo_once_key",
    minDuration: 800,
    fadeDuration: 400,
  },
  render: (args) => {
    const [key, setKey] = React.useState(0);

    const handleClearStorage = () => {
      try {
        const activeKey = args.sessionKey ?? "storybook_demo_once_key";
        sessionStorage.removeItem(activeKey);
        setKey((k) => k + 1);
      } catch {
        // ignore
      }
    };

    return (
      <div>
        <div className="fixed top-4 right-4 z-[60] flex gap-2">
          <Button size="sm" variant="secondary" onClick={handleClearStorage}>
            Сбросить sessionStorage и перезапустить
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setKey((k) => k + 1)}
          >
            Повторный рендер (должен пропустить лоадер)
          </Button>
        </div>
        <AppPreloader key={key} {...args}>
          <MockPageContent />
        </AppPreloader>
      </div>
    );
  },
};
