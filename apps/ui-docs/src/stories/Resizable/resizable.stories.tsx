import {
  CheckIcon,
  CodeIcon,
  FileCodeIcon,
  FolderIcon,
  FolderOpenIcon,
  PlayIcon,
  TrashIcon,
} from "@packages/icons";
import { Badge, Button, Resizable } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Resizable для Storybook.
 */
interface ResizableStoryProps {
  direction?: "horizontal" | "vertical";
  withHandle?: boolean;
  disabled?: boolean;
}

const meta: Meta<ResizableStoryProps> = {
  title: "Components/Resizable",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Resizable** — разделяемые изменяемые панели

Компонент для создания настраиваемых сплит-лэйаутов (IDE, редакторы кода, панели файлов, терминалы, дашборды).
Построен на базе **react-resizable-panels** и полностью стилизован в соответствии с дизайн-системой проекта (Tailwind CSS v4).

---

### **Установка и импорт**
\`\`\`tsx
import {
  Resizable,
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@packages/ui";
\`\`\`

---

### **Составные элементы (Compound Components)**
| Элемент | Описание |
| :--- | :--- |
| **\`Resizable\` / \`ResizablePanelGroup\`** | Корневой контейнер группы изменяемых панелей (\`direction\`, \`orientation\`, \`id\`, \`onLayoutChange\`) |
| **\`Resizable.Panel\` / \`ResizablePanel\`** | Отдельная масштабируемая панель (\`defaultSize\`, \`minSize\`, \`maxSize\`, \`collapsible\`, \`collapsedSize\`) |
| **\`Resizable.Handle\` / \`ResizableHandle\`** | Разделитель между панелями с поддержкой перетаскивания и индикатора захвата (\`withHandle\`, \`disabled\`) |

---

### **Базовый пример использования**
\`\`\`tsx
<Resizable direction="horizontal" className="h-[400px] w-full rounded-xl border border-border">
  <Resizable.Panel defaultSize="30" minSize="20" maxSize="50">
    <div className="p-4">Сайдбар</div>
  </Resizable.Panel>
  <Resizable.Handle withHandle />
  <Resizable.Panel defaultSize="70">
    <div className="p-4">Основная область</div>
  </Resizable.Panel>
</Resizable>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    direction: {
      control: "inline-radio",
      options: ["horizontal", "vertical"],
      description:
        "Направление разделения панелей (горизонтальное или вертикальное).",
      table: {
        category: "Resizable (Group)",
        type: { summary: "'horizontal' | 'vertical'" },
        defaultValue: { summary: "'horizontal'" },
      },
    },
    withHandle: {
      control: "boolean",
      description:
        "Отображать ли визуальную плашку захвата с точками (Grip) по центру разделителя.",
      table: {
        category: "Resizable.Handle",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    disabled: {
      control: "boolean",
      description: "Отключить возможность изменения размеров панелей.",
      table: {
        category: "Resizable.Handle",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
};

export default meta;
type Story = StoryObj<ResizableStoryProps>;

/**
 * Интерактивный пример с переключением направления и плашки захвата через панель Controls.
 */
export const Default: Story = {
  args: {
    direction: "horizontal",
    withHandle: true,
    disabled: false,
  },
  render: (args) => (
    <div className="w-[900px] max-w-full">
      <Resizable
        direction={args.direction}
        className="h-[380px] rounded-xl border border-border bg-card shadow-lg"
      >
        <Resizable.Panel defaultSize="35" minSize="20" maxSize="60">
          <div className="flex h-full flex-col justify-center items-center p-8 bg-muted/20 text-center">
            <div className="rounded-full bg-primary/10 p-3 text-primary mb-3">
              <FolderIcon className="size-6" />
            </div>
            <span className="text-base font-semibold text-foreground">
              Левая панель
            </span>
            <span className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              minSize: 20% • maxSize: 60% • defaultSize: 35%
            </span>
          </div>
        </Resizable.Panel>
        <Resizable.Handle
          withHandle={args.withHandle}
          disabled={args.disabled}
        />
        <Resizable.Panel defaultSize="65">
          <div className="flex h-full flex-col justify-center items-center p-8 text-center bg-card">
            <div className="rounded-full bg-secondary p-3 text-foreground mb-3">
              <CodeIcon className="size-6" />
            </div>
            <span className="text-base font-semibold text-foreground">
              Основная рабочая область
            </span>
            <span className="text-xs text-muted-foreground mt-1 max-w-[320px]">
              Перетащите разделитель мышью или управляйте пропсами в таблице
              Controls ниже.
            </span>
          </div>
        </Resizable.Panel>
      </Resizable>
    </div>
  ),
};

/**
 * Полноразмерный макет среды собеседования (IDE):
 * - Файловое дерево слева (проводник)
 * - Редактор кода с вкладками и подсветкой сверху-справа
 * - Интерактивная консоль/терминал с тестами внизу-справа
 */
export const IDELayout: Story = {
  render: () => (
    <div className="w-[1020px] max-w-full">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/60 border border-border border-b-0 rounded-t-xl text-xs text-muted-foreground font-mono">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-destructive/80 inline-block" />
          <span className="size-3 rounded-full bg-amber-500/80 inline-block" />
          <span className="size-3 rounded-full bg-success/80 inline-block" />
          <span className="ml-2 font-sans font-medium text-foreground">
            MockInterviewAI — Live Coding Session
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="statusSuccess" size="default">
            ● Подключено к Realtime Runner
          </Badge>
          <Button size="xs" variant="default" className="gap-1">
            <PlayIcon className="size-3" />
            Запустить тесты
          </Button>
        </div>
      </div>

      <Resizable
        direction="horizontal"
        className="h-[520px] rounded-b-xl border border-border bg-card shadow-2xl"
      >
        {/* Левая панель: проводник файлов */}
        <Resizable.Panel defaultSize="24" minSize="16" maxSize="38">
          <div className="flex h-full flex-col bg-muted/15">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Проводник файлов
              </span>
              <FolderOpenIcon className="size-4 text-muted-foreground" />
            </div>

            <div className="p-2 space-y-1 text-xs">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-muted-foreground hover:bg-muted/40 cursor-pointer">
                <FolderIcon className="size-3.5 text-primary" />
                <span className="font-medium">src</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary/10 text-primary font-medium cursor-pointer">
                <FileCodeIcon className="size-3.5" />
                <span>Solution.tsx</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-md text-muted-foreground hover:bg-muted/40 cursor-pointer">
                <FileCodeIcon className="size-3.5" />
                <span>types.ts</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-md text-muted-foreground hover:bg-muted/40 cursor-pointer">
                <FileCodeIcon className="size-3.5" />
                <span>Solution.test.tsx</span>
              </div>
            </div>

            <div className="mt-auto p-3 border-t border-border bg-muted/20">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Язык: TypeScript 5.9</span>
                <span>UTF-8</span>
              </div>
            </div>
          </div>
        </Resizable.Panel>

        <Resizable.Handle withHandle />

        {/* Правая секция: Редактор + Терминал */}
        <Resizable.Panel defaultSize="76">
          <Resizable direction="vertical">
            {/* Верхний блок: Редактор кода */}
            <Resizable.Panel defaultSize="62" minSize="30">
              <div className="flex h-full flex-col bg-background">
                {/* Вкладки редактора */}
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-2 pt-1 text-xs">
                  <div className="flex items-center">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-t-2 border-primary bg-background font-medium text-foreground rounded-t-md">
                      <FileCodeIcon className="size-3.5 text-primary" />
                      <span>Solution.tsx</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground cursor-pointer">
                      <span>types.ts</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground pr-2">
                    Read & Write Mode
                  </span>
                </div>

                {/* Код с номерами строк */}
                <div className="flex-1 p-4 font-mono text-xs leading-6 overflow-auto text-foreground">
                  <div className="flex gap-4">
                    <div className="select-none text-muted-foreground/40 text-right w-6 space-y-0">
                      <div>1</div>
                      <div>2</div>
                      <div>3</div>
                      <div>4</div>
                      <div>5</div>
                      <div>6</div>
                      <div>7</div>
                      <div>8</div>
                      <div>9</div>
                    </div>
                    <div className="space-y-0 flex-1">
                      <div>
                        <span className="text-chart-4">export function</span>{" "}
                        <span className="text-primary font-bold">
                          mergeIntervals
                        </span>
                        (intervals:{" "}
                        <span className="text-chart-2">number[][]</span>):{" "}
                        <span className="text-chart-2">number[][]</span> &#123;
                      </div>
                      <div className="pl-4">
                        <span className="text-chart-4">if</span>{" "}
                        (!intervals.length){" "}
                        <span className="text-chart-4">return</span> [];
                      </div>
                      <div className="pl-4">
                        intervals.<span className="text-chart-1">sort</span>((a,
                        b) =&gt; a[0] - b[0]);
                      </div>
                      <div className="pl-4">
                        <span className="text-chart-4">const</span> result:{" "}
                        <span className="text-chart-2">number[][]</span> =
                        [intervals[0]];
                      </div>
                      <div className="pl-4">
                        <span className="text-chart-4">for</span> (
                        <span className="text-chart-4">let</span> i = 1; i &lt;
                        intervals.length; i++) &#123;
                      </div>
                      <div className="pl-8">
                        <span className="text-muted-foreground">
                          {"// Объединение пересекающихся интервалов"}
                        </span>
                      </div>
                      <div className="pl-8">
                        <span className="text-chart-4">const</span> prev =
                        result[result.length - 1];
                      </div>
                      <div className="pl-4">&#125;</div>
                      <div>&#125;</div>
                    </div>
                  </div>
                </div>
              </div>
            </Resizable.Panel>

            <Resizable.Handle withHandle />

            {/* Нижний блок: Консоль и результаты тестов */}
            <Resizable.Panel defaultSize="38" minSize="20">
              <div className="flex h-full flex-col bg-card">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <CheckIcon className="size-3.5 text-success" />
                      Тестовые кейсы (5/5 пройдено)
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      • Выполнено за 38ms
                    </span>
                  </div>
                  <Button variant="ghost" size="icon-xs">
                    <TrashIcon className="size-3" />
                  </Button>
                </div>

                <div className="flex-1 p-3 font-mono text-xs overflow-auto space-y-1.5 text-muted-foreground">
                  <div className="flex items-center gap-2 text-success">
                    <span>✓</span>
                    <span>
                      Test 1: [[1,3],[2,6],[8,10],[15,18]] →
                      [[1,6],[8,10],[15,18]] (4ms)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-success">
                    <span>✓</span>
                    <span>Test 2: [[1,4],[4,5]] → [[1,5]] (2ms)</span>
                  </div>
                  <div className="flex items-center gap-2 text-success">
                    <span>✓</span>
                    <span>Test 3: [[1,4],[0,4]] → [[0,4]] (1ms)</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground/80">
                    <span>⚡ Memory usage: 14.2 MB • CPU time: 0.04s</span>
                  </div>
                </div>
              </div>
            </Resizable.Panel>
          </Resizable>
        </Resizable.Panel>
      </Resizable>
    </div>
  ),
};

/**
 * Вертикальное разделение панелей (например, окно редактора и терминал вывода).
 */
export const Vertical: Story = {
  render: () => (
    <div className="w-[900px] max-w-full">
      <Resizable
        direction="vertical"
        className="h-[460px] rounded-xl border border-border bg-card shadow-lg"
      >
        <Resizable.Panel defaultSize="60" minSize="30">
          <div className="flex h-full flex-col p-6 bg-background">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="text-sm font-semibold">
                Верхний блок: Редактор сценария интервью
              </span>
              <Badge variant="statusInfo" size="default">
                Режим редактирования
              </Badge>
            </div>
            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 text-muted-foreground">
              <p className="text-sm font-medium text-foreground">
                Задайте системный промпт для AI-интервьюера
              </p>
              <p className="text-xs mt-1">
                Размер верхней панели масштабируется вертикальным разделителем.
              </p>
            </div>
          </div>
        </Resizable.Panel>
        <Resizable.Handle withHandle />
        <Resizable.Panel defaultSize="40" minSize="20">
          <div className="flex h-full flex-col p-6 bg-muted/20">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <span className="text-sm font-semibold">
                Нижний блок: Лог ответов и событий LLM
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                Streaming WebSocket Active
              </span>
            </div>
            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 text-muted-foreground">
              <p className="text-xs font-mono text-success">
                ✓ Ready for incoming realtime audio & text chunks
              </p>
            </div>
          </div>
        </Resizable.Panel>
      </Resizable>
    </div>
  ),
};

/**
 * 3-х колоночный горизонтальный лэйаут (Текст задачи + Решение + Аналитика).
 */
export const ThreeColumns: Story = {
  render: () => (
    <div className="w-[1020px] max-w-full">
      <Resizable
        direction="horizontal"
        className="h-[400px] rounded-xl border border-border bg-card shadow-lg"
      >
        <Resizable.Panel defaultSize="30" minSize="20" maxSize="45">
          <div className="flex h-full flex-col p-6 bg-muted/20 border-r border-border">
            <h4 className="text-sm font-bold text-foreground">
              1. Описание задачи
            </h4>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Реализуйте функцию сжатия интервалов с сохранением порядка
              следования элементов.
            </p>
          </div>
        </Resizable.Panel>
        <Resizable.Handle withHandle />
        <Resizable.Panel defaultSize="45" minSize="30">
          <div className="flex h-full flex-col p-6 bg-background">
            <h4 className="text-sm font-bold text-primary">
              2. Редактор решения
            </h4>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Основная рабочая область для написания алгоритма.
            </p>
          </div>
        </Resizable.Panel>
        <Resizable.Handle withHandle />
        <Resizable.Panel defaultSize="25" minSize="15" maxSize="40">
          <div className="flex h-full flex-col p-6 bg-muted/30">
            <h4 className="text-sm font-bold text-foreground">3. Оценка AI</h4>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Метрики сложности: O(N log N) по времени, O(N) по памяти.
            </p>
          </div>
        </Resizable.Panel>
      </Resizable>
    </div>
  ),
};

/**
 * Сворачиваемая панель (Collapsible). При уменьшении ширины ниже minSize панель плавно схлопывается.
 */
export const Collapsible: Story = {
  render: () => (
    <div className="w-[900px] max-w-full">
      <Resizable
        direction="horizontal"
        className="h-[380px] rounded-xl border border-border bg-card shadow-lg"
      >
        <Resizable.Panel
          defaultSize="28"
          collapsible={true}
          minSize="18"
          maxSize="45"
          className="transition-all duration-200"
        >
          <div className="flex h-full flex-col justify-center items-center p-6 bg-muted/30 text-center">
            <span className="text-sm font-bold text-foreground">
              Сворачиваемый сайдбар
            </span>
            <span className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-[180px]">
              Потяните разделитель влево до конца, чтобы полностью свернуть эту
              панель.
            </span>
          </div>
        </Resizable.Panel>
        <Resizable.Handle withHandle />
        <Resizable.Panel defaultSize="72">
          <div className="flex h-full flex-col justify-center items-center p-8 text-center bg-background">
            <span className="text-base font-bold text-foreground">
              Главная панель
            </span>
            <span className="text-xs text-muted-foreground mt-2 max-w-[280px]">
              Занимает всё свободное пространство, когда левая панель свернута.
            </span>
          </div>
        </Resizable.Panel>
      </Resizable>
    </div>
  ),
};
