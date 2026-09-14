"use client";

import { Textarea, Typography } from "@packages/ui";

interface SandboxTaskNotesProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

export function SandboxTaskNotes({
  notes,
  onNotesChange,
}: SandboxTaskNotesProps) {
  return (
    <div className="flex h-full flex-col space-y-3">
      <Typography.Muted className="text-xs">
        Ваш черновик для фиксации мыслей, алгоритмов и краевых случаев (Edge
        Cases):
      </Typography.Muted>
      <Textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Записывайте сюда:
1. Алгоритмическая сложность (Time/Space O(...))
2. Граничные случаи (пустой массив, дубликаты, переполнение)
3. Идеи по оптимизации"
        className="flex-1 resize-none font-mono text-xs leading-relaxed"
      />
      <span className="text-[10px] text-muted-foreground">
        Заметки сохраняются автоматически в рамках вашей сессии.
      </span>
    </div>
  );
}
