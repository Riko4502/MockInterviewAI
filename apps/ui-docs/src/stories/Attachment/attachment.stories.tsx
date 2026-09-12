import { Attachment, Button, Textarea, useToast } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

const meta = {
  title: "Components/Attachment",
  component: Attachment,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Attachment** — компонент прикрепления файлов

Используется для загрузки, отображения и управления прикрепленными файлами (код, документы, изображения) в формах и диалогах с AI.

---

### **Составные элементы (Compound Components)**
| Элемент | Описание |
| :--- | :--- |
| **\`Attachment\`** | Корневой контейнер (\`variant\`, \`status\`) |
| **\`Attachment.Preview\`** | Миниатюра изображения или иконка типа файла (\`src\`, \`extension\`) |
| **\`Attachment.Info\`** | Контейнер текстовой информации |
| **\`Attachment.Name\`** | Название файла |
| **\`Attachment.Size\`** | Размер файла или статус |
| **\`Attachment.Progress\`** | Полоса прогресса загрузки (\`value\`) |
| **\`Attachment.Remove\`** | Кнопка удаления файла (\`onRemove\`) |
| **\`Attachment.List\`** | Горизонтальный/блочный контейнер списка файлов |
| **\`Attachment.Trigger\`** | Кнопка вызова диалога выбора файлов (\`accept\`, \`multiple\`, \`onFilesSelected\`) |
`,
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Attachment>;

export default meta;
type Story = StoryObj<typeof meta>;

interface FileItem {
  id: string;
  name: string;
  size: string;
  extension: string;
  status: "default" | "uploading" | "error" | "success";
  progress?: number;
  previewUrl?: string;
}

const INITIAL_FILES: FileItem[] = [
  {
    id: "1",
    name: "solution.tsx",
    size: "12.4 KB",
    extension: "tsx",
    status: "default",
  },
  {
    id: "2",
    name: "architecture_diagram.png",
    size: "2.1 MB",
    extension: "png",
    status: "default",
    previewUrl:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80",
  },
  {
    id: "3",
    name: "interview_recording.mp3",
    size: "8.6 MB",
    extension: "mp3",
    status: "uploading",
    progress: 65,
  },
  {
    id: "4",
    name: "failed_test_spec.ts",
    size: "4.2 KB",
    extension: "ts",
    status: "error",
  },
];

function InteractiveAttachmentDemo() {
  const [files, setFiles] = useState<FileItem[]>(INITIAL_FILES);
  const toast = useToast();

  const handleFilesSelected = (newFiles: File[]) => {
    const formatted: FileItem[] = newFiles.map((f, idx) => ({
      id: `${Date.now()}-${idx}`,
      name: f.name,
      size: `${(f.size / 1024).toFixed(1)} KB`,
      extension: f.name.split(".").pop() ?? "",
      status: "success",
    }));

    setFiles((prev) => [...prev, ...formatted]);
    toast.push({
      status: "success",
      title: "Файлы прикреплены",
      description: `Добавлено файлов: ${newFiles.length}`,
      duration: 3000,
    });
  };

  const handleRemove = (id: string, name: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    toast.push({
      status: "default",
      title: "Файл удален",
      description: name,
      duration: 2000,
    });
  };

  return (
    <div className="w-full max-w-2xl space-y-4 p-4 rounded-2xl border border-border bg-card/60">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          Прикрепленные файлы ({files.length})
        </h4>
        <Attachment.Trigger multiple onFilesSelected={handleFilesSelected} />
      </div>

      <Attachment.List>
        {files.map((file) => (
          <Attachment
            key={file.id}
            status={file.status}
            className="w-full sm:w-auto"
          >
            <Attachment.Preview
              src={file.previewUrl}
              extension={file.extension}
            />
            <Attachment.Info>
              <Attachment.Name>{file.name}</Attachment.Name>
              <Attachment.Size>
                {file.status === "uploading"
                  ? `Загрузка... ${file.progress}%`
                  : file.status === "error"
                    ? "Ошибка загрузки"
                    : file.size}
              </Attachment.Size>
            </Attachment.Info>
            {file.status === "uploading" && (
              <Attachment.Progress value={file.progress} />
            )}
            <Attachment.Remove
              onRemove={() => handleRemove(file.id, file.name)}
            />
          </Attachment>
        ))}
      </Attachment.List>
    </div>
  );
}

/**
 * Интерактивное управление списком файлов с добавлением и удалением.
 */
export const Default: Story = {
  render: () => <InteractiveAttachmentDemo />,
};

/**
 * Варианты отображения (`default`, `compact`, `card`).
 */
export const Variants: Story = {
  render: () => (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Default (Строчный)
        </p>
        <Attachment.List>
          <Attachment variant="default">
            <Attachment.Preview extension="ts" />
            <Attachment.Info>
              <Attachment.Name>algorithms.ts</Attachment.Name>
              <Attachment.Size>8.2 KB</Attachment.Size>
            </Attachment.Info>
            <Attachment.Remove />
          </Attachment>
        </Attachment.List>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Compact (Компактный бейдж)
        </p>
        <Attachment.List>
          <Attachment variant="compact">
            <Attachment.Preview extension="py" />
            <Attachment.Info>
              <Attachment.Name>script.py</Attachment.Name>
            </Attachment.Info>
            <Attachment.Remove />
          </Attachment>
          <Attachment variant="compact">
            <Attachment.Preview extension="json" />
            <Attachment.Info>
              <Attachment.Name>data.json</Attachment.Name>
            </Attachment.Info>
            <Attachment.Remove />
          </Attachment>
        </Attachment.List>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">
          Card (Карточка с превью)
        </p>
        <Attachment.List>
          <Attachment variant="card">
            <Attachment.Preview
              src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80"
              alt="Mock preview"
            />
            <Attachment.Info>
              <Attachment.Name>preview.png</Attachment.Name>
              <Attachment.Size>1.4 MB</Attachment.Size>
            </Attachment.Info>
            <Attachment.Remove className="absolute top-2 right-2 bg-card/80 backdrop-blur-xs" />
          </Attachment>
        </Attachment.List>
      </div>
    </div>
  ),
};

/**
 * Интеграция с полем ввода AI чата / промпта (Prompt Input Box).
 */
export const InPromptInput: Story = {
  render: () => {
    return (
      <div className="w-[500px] max-w-full rounded-2xl border border-border bg-card p-3 shadow-lg space-y-3">
        <Attachment.List>
          <Attachment variant="compact" status="success">
            <Attachment.Preview extension="tsx" />
            <Attachment.Info>
              <Attachment.Name>UserProfile.tsx</Attachment.Name>
            </Attachment.Info>
            <Attachment.Remove />
          </Attachment>
          <Attachment variant="compact" status="default">
            <Attachment.Preview extension="json" />
            <Attachment.Info>
              <Attachment.Name>schema.json</Attachment.Name>
            </Attachment.Info>
            <Attachment.Remove />
          </Attachment>
        </Attachment.List>

        <Textarea
          placeholder="Спросите AI об этих файлах или попросите оптимизировать код..."
          className="min-h-[80px] resize-none border-none bg-transparent p-0 focus-visible:ring-0 shadow-none text-sm"
        />

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Attachment.Trigger />
          <Button size="sm">Отправить в AI</Button>
        </div>
      </div>
    );
  },
};
