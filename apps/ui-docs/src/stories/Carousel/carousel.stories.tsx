import {
  DotIcon,
  GoIcon,
  HubConnectionIcon,
  ReactIcon,
  ZapIcon,
} from "@packages/icons";
import { Badge, Card, Carousel, type CarouselApi } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";

/**
 * Метаданные компонента Carousel для Storybook.
 */
const meta = {
  title: "Components/Carousel",
  component: Carousel,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Carousel** — компонент карусели и слайдера

Интерактивный компонент для плавной прокрутки элементов, карточек и медиа-контента. Построен на базе библиотеки \`embla-carousel-react\` с поддержкой touch-свайпов, drag-взаимодействия и клавиатурной навигации (\`ArrowLeft\`, \`ArrowRight\`).

---

### **Установка и импорт**
\`\`\`tsx
import { Carousel, type CarouselApi } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Carousel opts={{ align: "start", loop: true }}>
  <Carousel.Content>
    <Carousel.Item className="basis-1/2">Слайд 1</Carousel.Item>
    <Carousel.Item className="basis-1/2">Слайд 2</Carousel.Item>
    <Carousel.Item className="basis-1/2">Слайд 3</Carousel.Item>
  </Carousel.Content>
  <Carousel.Previous />
  <Carousel.Next />
</Carousel>
\`\`\`

---

### **Составные элементы (Compound Components)**
| Элемент | Описание |
| :--- | :--- |
| **\`Carousel\`** | Корневой контейнер контекста (\`opts\`, \`plugins\`, \`orientation\`, \`setApi\`) |
| **\`Carousel.Content\`** | Контейнер трека слайдера с поддержкой горизонтальной и вертикальной осей |
| **\`Carousel.Item\`** | Отдельный слайд карусели (ширина регулируется через классы \`basis-full\`, \`basis-1/2\`, \`basis-1/3\`) |
| **\`Carousel.Previous\`** | Кнопка прокрутки к предыдущему слайду |
| **\`Carousel.Next\`** | Кнопка прокрутки к следующему слайду |
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
      description: "Ориентация прокрутки карусели.",
      table: {
        type: { summary: '"horizontal" | "vertical"' },
        defaultValue: { summary: '"horizontal"' },
      },
    },
  },
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Базовый пример карусели с полноэкранными карточками слайдов.
 */
export const Default: Story = {
  args: {
    orientation: "horizontal",
  },
  render: (args) => (
    <div className="w-[480px] max-w-full px-12">
      <Carousel {...args} className="w-full">
        <Carousel.Content>
          {Array.from({ length: 5 }).map((_, index) => (
            <Carousel.Item key={`slide-${index + 1}`}>
              <div className="p-1">
                <Card className="flex aspect-video items-center justify-center p-6 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-purple-500/20">
                  <span className="text-3xl font-bold font-mono text-foreground">
                    {index + 1}
                  </span>
                </Card>
              </div>
            </Carousel.Item>
          ))}
        </Carousel.Content>
        <Carousel.Previous />
        <Carousel.Next />
      </Carousel>
    </div>
  ),
};

/**
 * Мульти-элементная карусель (отображение 2 или 3 элементов одновременно).
 */
export const MultipleItems: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "С помощью утилит `basis-1/2`, `basis-1/3` или `sm:basis-1/2` на `Carousel.Item` можно отображать несколько карточек в одном кадре.",
      },
    },
  },
  render: () => (
    <div className="w-[620px] max-w-full px-12">
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <Carousel.Content className="-ml-3">
          {[
            { title: "React 19 & Next.js", tag: "Frontend", color: "sky" },
            { title: "Golang & Postgres", tag: "Backend", color: "cyan" },
            {
              title: "Highload System Design",
              tag: "Architecture",
              color: "amber",
            },
            {
              title: "Algorithms & Big-O",
              tag: "Computer Science",
              color: "emerald",
            },
            { title: "DevOps & Kubernetes", tag: "Infra", color: "indigo" },
          ].map((item, idx) => (
            <Carousel.Item
              key={item.title}
              className="pl-3 basis-full sm:basis-1/2 md:basis-1/2"
            >
              <Card className="p-4 space-y-3 h-full flex flex-col justify-between">
                <div>
                  <Badge variant="statusInfo" className="text-[10px]">
                    {item.tag}
                  </Badge>
                  <h4 className="font-semibold text-sm mt-2 text-foreground">
                    {item.title}
                  </h4>
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t border-border flex items-center justify-between">
                  <span>Модуль #{idx + 1}</span>
                  <span className="text-primary font-medium cursor-pointer hover:underline">
                    Подробнее →
                  </span>
                </div>
              </Card>
            </Carousel.Item>
          ))}
        </Carousel.Content>
        <Carousel.Previous />
        <Carousel.Next />
      </Carousel>
    </div>
  ),
};

/**
 * Интерактивная карусель со счетчиком слайдов и пагинацией (API control).
 */
export const WithApiAndDots: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Использование `setApi` позволяет управлять состоянием карусели, получать текущий индекс слайда и переключать слайды программно.",
      },
    },
  },
  render: function ApiExample() {
    const [api, setApi] = useState<CarouselApi>();
    const [current, setCurrent] = useState(0);
    const [count, setCount] = useState(0);

    useEffect(() => {
      if (!api) return;

      setCount(api.scrollSnapList().length);
      setCurrent(api.selectedScrollSnap() + 1);

      api.on("select", () => {
        setCurrent(api.selectedScrollSnap() + 1);
      });
    }, [api]);

    return (
      <div className="w-[520px] max-w-full space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pb-2 border-b border-border">
          <span>
            Слайд <strong className="text-foreground">{current}</strong> из{" "}
            {count}
          </span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: count }).map((_, i) => (
              <button
                type="button"
                key={`dot-${i + 1}`}
                onClick={() => api?.scrollTo(i)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  current === i + 1
                    ? "w-6 bg-primary"
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                }`}
                aria-label={`Перейти к слайду ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="px-12">
          <Carousel setApi={setApi} className="w-full">
            <Carousel.Content>
              {Array.from({ length: 4 }).map((_, index) => (
                <Carousel.Item key={`api-slide-${index + 1}`}>
                  <Card className="p-8 text-center space-y-2 bg-card">
                    <div className="text-2xl font-bold">
                      Карточка #{index + 1}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Плавная прокрутка с двусторонней синхронизацией состояния.
                    </p>
                  </Card>
                </Carousel.Item>
              ))}
            </Carousel.Content>
            <Carousel.Previous />
            <Carousel.Next />
          </Carousel>
        </div>
      </div>
    );
  },
};

/**
 * Пример со стилизованными карточками треков собеседований (MockInterviewAI Showcase).
 */
export const TrackCardsShowcase: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Реалистичный пример использования карусели для выбора направления собеседования.",
      },
    },
  },
  render: function TrackShowcase() {
    const [selectedIdx, setSelectedIdx] = useState(0);

    const tracks = [
      {
        id: "fe",
        title: "Frontend Engineer",
        desc: "React 19, TypeScript, Web Vitals",
        duration: "60 min",
        icon: <ReactIcon className="w-4 h-4 text-sky-500" />,
      },
      {
        id: "be",
        title: "Backend Engineer",
        desc: "Golang, PostgreSQL, многопоточность",
        duration: "60 min",
        icon: <GoIcon className="w-4 h-4 text-cyan-500" />,
      },
      {
        id: "sd",
        title: "System Design",
        desc: "Микросервисы, шардинг, Kafka",
        duration: "45 min",
        icon: <HubConnectionIcon className="w-4 h-4 text-amber-500" />,
      },
      {
        id: "algo",
        title: "Алгоритмы и структуры данных",
        desc: "Динамическое программирование, графы",
        duration: "45 min",
        icon: <ZapIcon className="w-4 h-4 text-emerald-500" />,
      },
    ];

    return (
      <div className="w-[580px] max-w-full space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DotIcon className="w-4 h-4 text-purple-500 animate-pulse" />
            <span className="text-sm font-bold text-foreground">
              Выберите трек собеседования
            </span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {selectedIdx + 1} / {tracks.length}
          </span>
        </div>

        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
        >
          <Carousel.Content className="-ml-3">
            {tracks.map((track, idx) => {
              const isSelected = selectedIdx === idx;
              return (
                <Carousel.Item key={track.id} className="pl-3 basis-1/2">
                  <Card
                    onClick={() => setSelectedIdx(idx)}
                    className={`p-4 rounded-2xl flex flex-col justify-between cursor-pointer transition-colors duration-200 select-none min-h-[138px] border ${
                      isSelected
                        ? "bg-violet-500/10 border-violet-500 ring-1 ring-violet-500/50 shadow-md shadow-violet-500/10"
                        : "bg-card border-border hover:border-violet-500/40"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        {track.icon}
                        <span className="text-sm font-bold text-foreground truncate">
                          {track.title}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[34px] flex items-center">
                        {track.desc}
                      </p>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-border flex items-center justify-between text-[11px] font-mono h-[34px]">
                      <span className="text-muted-foreground">
                        {track.duration}
                      </span>
                      {isSelected ? (
                        <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                          Выбран ✓
                        </span>
                      ) : (
                        <span className="text-muted-foreground hover:text-foreground">
                          Выбрать →
                        </span>
                      )}
                    </div>
                  </Card>
                </Carousel.Item>
              );
            })}
          </Carousel.Content>
          <div className="flex justify-end gap-2 mt-3">
            <Carousel.Previous className="static translate-y-0 size-8" />
            <Carousel.Next className="static translate-y-0 size-8" />
          </div>
        </Carousel>
      </div>
    );
  },
};
