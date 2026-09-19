import { PlayIcon, TypescriptIcon } from "@packages/icons";
import { Button, Tabs, WindowControls, WindowHeader } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Components/WindowHeader",
  component: WindowHeader,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **WindowHeader** — шапка окна в стиле macOS / Studio IDE

Универсальный компонент шапки окна с кнопками управления («светофор» macOS), областью для табов/заголовка и слотом для действий/индикаторов статуса.

---

### **Импорт**
\`\`\`tsx
import { WindowHeader, WindowControls } from "@packages/ui";
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof WindowHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[500px] rounded-[22px] border border-black/10 dark:border-white/10 bg-card overflow-hidden shadow-xl">
      <WindowHeader
        actions={
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>LIVE</span>
          </div>
        }
      >
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-[11px] font-mono">
          <TypescriptIcon className="w-3.5 h-3.5 text-sky-500" />
          <span className="font-semibold">solution.ts</span>
        </div>
      </WindowHeader>
      <div className="p-6 font-mono text-xs text-muted-foreground">
        {"// IDE Workspace Content..."}
      </div>
    </div>
  ),
};

export const WithTabs: Story = {
  render: () => (
    <div className="w-[550px] rounded-[22px] border border-black/10 dark:border-white/10 bg-card overflow-hidden shadow-xl">
      <WindowHeader
        actions={
          <Button size="xs" variant="outline" className="rounded-xl gap-1">
            <PlayIcon className="w-3 h-3 fill-current" />
            <span>Run</span>
          </Button>
        }
      >
        <Tabs defaultValue="solution" size="sm">
          <Tabs.List className="h-6 p-0.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-lg">
            <Tabs.Trigger
              value="solution"
              className="text-[10px] font-mono h-5 px-2"
            >
              solution.ts
            </Tabs.Trigger>
            <Tabs.Trigger
              value="tests"
              className="text-[10px] font-mono h-5 px-2"
            >
              tests.spec.ts
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      </WindowHeader>
      <div className="p-6 font-mono text-xs text-muted-foreground">
        export async function evaluate() &#123; ... &#125;
      </div>
    </div>
  ),
};

export const StandaloneControls: Story = {
  render: () => (
    <div className="flex items-center gap-6 p-4 rounded-xl border border-border">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Small:</span>
        <WindowControls size="sm" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Medium (Default):</span>
        <WindowControls size="md" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Large:</span>
        <WindowControls size="lg" />
      </div>
    </div>
  ),
};
