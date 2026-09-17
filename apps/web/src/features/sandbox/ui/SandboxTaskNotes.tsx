"use client";

import { Textarea, Typography } from "@packages/ui";
import { useSandboxStore } from "../model/useSandboxStore";

export function SandboxTaskNotes() {
  const notes = useSandboxStore((s) => s.notes);
  const setNotes = useSandboxStore((s) => s.setNotes);

  return (
    <div className="flex h-full flex-col space-y-3">
      <Typography.Muted className="text-xs">
        Ваш черновик для фиксации мыслей, алгоритмов и краевых случаев (Edge
        Cases):
      </Typography.Muted>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Записывайте сюда:
1. Алгоритмическая сложность (Time/Space O(...))
2. Граничные случаи (пустой массив, дубликаты, переполнение)
3. Идеи по оптимизации"
        className="flex-1 resize-none font-mono text-xs leading-relaxed"
      />
      <span className="text-[10px] text-muted-foreground">
        Заметки хранятся только в памяти страницы и будут потеряны после
        перезагрузки.
      </span>
    </div>
  );
}
