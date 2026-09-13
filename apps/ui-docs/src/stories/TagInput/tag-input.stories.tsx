import { CodeIcon } from "@packages/icons";
import { Label, TagInput } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

/**
 * Метаданные компонента TagInput для Storybook.
 */
const meta = {
  title: "Components/TagInput",
  component: TagInput,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **TagInput** — компонент ввода тегов и навыков

Многофункциональное поле для ввода, редактирования и управления массивом строковых значений (ключевые навыки \`skills: string[]\`, стек технологий, метки).

---

### **Установка и импорт**
\`\`\`tsx
import { TagInput } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<TagInput
  defaultValue={["React", "TypeScript"]}
  placeholder="Введите навык и нажмите Enter..."
  maxTags={5}
  clearable
  showCount
/>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    // --- Значение и валидация ---
    placeholder: {
      control: "text",
      description: "Текст-заполнитель в пустом поле ввода.",
      table: {
        category: "Значение и валидация",
        type: { summary: "string" },
        defaultValue: { summary: '"Добавьте тег и нажмите Enter..."' },
      },
    },
    maxTags: {
      control: "number",
      description: "Максимально допустимое количество тегов.",
      table: {
        category: "Значение и валидация",
        type: { summary: "number" },
      },
    },
    minTagLength: {
      control: "number",
      description: "Минимальная длина одного тега.",
      table: {
        category: "Значение и валидация",
        type: { summary: "number" },
        defaultValue: { summary: "1" },
      },
    },
    maxTagLength: {
      control: "number",
      description: "Максимальная длина одного тега в символах.",
      table: {
        category: "Значение и валидация",
        type: { summary: "number" },
      },
    },
    allowDuplicates: {
      control: "boolean",
      description: "Разрешить ли добавление дублирующихся тегов.",
      table: {
        category: "Значение и валидация",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    addOnBlur: {
      control: "boolean",
      description:
        "Добавлять ли введенный текст как тег при потере фокуса (onBlur).",
      table: {
        category: "Значение и валидация",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    addOnPaste: {
      control: "boolean",
      description:
        "Автоматически разделять строку на отдельные теги при вставке из буфера (по запятым, переносам строк).",
      table: {
        category: "Значение и валидация",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    // --- Внешний вид ---
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Размер поля ввода и тегов (`sm`, `md`, `lg`).",
      table: {
        category: "Внешний вид",
        type: { summary: '"sm" | "md" | "lg"' },
        defaultValue: { summary: '"md"' },
      },
    },
    tagVariant: {
      control: "select",
      options: ["secondary", "default", "outline", "tag"],
      description: "Стилевой вариант оформления бейджей тегов.",
      table: {
        category: "Внешний вид",
        type: { summary: '"secondary" | "default" | "outline" | "tag"' },
        defaultValue: { summary: '"secondary"' },
      },
    },
    clearable: {
      control: "boolean",
      description: "Отображать ли кнопку быстрой очистки всех тегов.",
      table: {
        category: "Внешний вид",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    showCount: {
      control: "boolean",
      description: "Отображать ли индикатор счетчика `текущее / максимум`.",
      table: {
        category: "Внешний вид",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    invalid: {
      control: "boolean",
      description: "Флаг ошибки валидации (подсвечивает рамку красным).",
      table: {
        category: "Внешний вид",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    disabled: {
      control: "boolean",
      description: "Отключение интерактивности компонента.",
      table: {
        category: "Внешний вид",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    placeholder: "Добавьте навык и нажмите Enter...",
    size: "md",
    tagVariant: "secondary",
    maxTags: 6,
    minTagLength: 1,
    maxTagLength: 20,
    allowDuplicates: false,
    addOnBlur: true,
    addOnPaste: true,
    clearable: true,
    showCount: true,
    invalid: false,
    disabled: false,
  },
} satisfies Meta<typeof TagInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Интерактивный TagInput со всеми доступными пропсами и контролами.
 */
export const Default: Story = {
  args: {
    defaultValue: ["React", "TypeScript", "Next.js"],
  },
  render: (args) => (
    <div className="w-[450px] space-y-2">
      <Label htmlFor="skills-input-default" className="text-sm font-medium">
        Ключевые навыки (Skills)
      </Label>
      <TagInput
        key={`${args.maxTags}-${args.maxTagLength}-${args.size}-${args.tagVariant}-${args.clearable}-${args.showCount}-${args.invalid}-${args.disabled}`}
        id="skills-input-default"
        {...args}
      />
      <p className="text-xs text-muted-foreground">
        Поддерживает ввод по Enter и запятой, вставку из буфера и удаление по
        Backspace.
      </p>
    </div>
  ),
};

/**
 * Варианты размеров (sm, md, lg).
 */
export const Sizes: Story = {
  render: () => (
    <div className="w-[450px] space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Размер Small (`sm`)</Label>
        <TagInput
          size="sm"
          defaultValue={["Go", "Docker"]}
          placeholder="Добавить..."
        />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Размер Medium (`md`, по умолчанию)</Label>
        <TagInput
          size="md"
          defaultValue={["Node.js", "Express", "Prisma"]}
          placeholder="Добавить..."
        />
      </div>
      <div className="space-y-1">
        <Label className="text-base">Размер Large (`lg`)</Label>
        <TagInput
          size="lg"
          defaultValue={["PostgreSQL", "Redis", "Kafka"]}
          placeholder="Добавить..."
        />
      </div>
    </div>
  ),
};

/**
 * Варианты стилей бейджей (`tagVariant`).
 */
export const TagVariants: Story = {
  render: () => (
    <div className="w-[450px] space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Secondary (по умолчанию)</Label>
        <TagInput tagVariant="secondary" defaultValue={["React", "Next.js"]} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Primary Accent (`default`)</Label>
        <TagInput
          tagVariant="default"
          defaultValue={["TypeScript", "Tailwind CSS"]}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Outline (`outline`)</Label>
        <TagInput tagVariant="outline" defaultValue={["GraphQL", "Apollo"]} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Muted Tag (`tag`)</Label>
        <TagInput tagVariant="tag" defaultValue={["Jest", "Vitest"]} />
      </div>
    </div>
  ),
};

/**
 * Управляемый режим (Controlled Component с префиксом).
 */
export const ControlledWithPrefix: Story = {
  render: () => {
    const [skills, setSkills] = useState<string[]>([
      "PostgreSQL",
      "NestJS",
      "Docker",
    ]);

    return (
      <div className="w-[450px] space-y-3">
        <Label
          htmlFor="skills-input-controlled"
          className="text-sm font-medium"
        >
          Стек бэкенда
        </Label>
        <TagInput
          id="skills-input-controlled"
          value={skills}
          onChange={setSkills}
          prefix={<CodeIcon size="sm" />}
          placeholder="Добавьте технологию..."
          maxTags={5}
          clearable
          showCount
        />
        <div className="p-3 rounded-lg bg-muted text-xs font-mono">
          <strong>Текущее значение:</strong> {JSON.stringify(skills)}
        </div>
      </div>
    );
  },
};

/**
 * Состояние ошибки валидации (Invalid).
 */
export const InvalidState: Story = {
  render: () => (
    <div className="w-[450px] space-y-1.5">
      <Label
        htmlFor="skills-invalid"
        className="text-sm font-medium text-destructive"
      >
        Обязательное поле
      </Label>
      <TagInput
        id="skills-invalid"
        invalid
        defaultValue={["Некорректный тег"]}
        placeholder="Введите корректный навык..."
      />
      <p className="text-xs text-destructive">
        Необходимо указать от 3 до 5 релевантных навыков.
      </p>
    </div>
  ),
};
