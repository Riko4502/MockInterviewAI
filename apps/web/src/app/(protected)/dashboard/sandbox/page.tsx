import type { Metadata } from "next";
import { SandboxRoom } from "@/features/sandbox";

export const metadata: Metadata = {
  title: "Песочница собеседования | MockInterviewAI",
  description:
    "Интерактивная комната для тренировки и тестирования алгоритмических задач",
};

export default function SandboxPage() {
  return (
    <div className="-m-6 flex h-[calc(100vh)] w-[calc(100%+3rem)] min-h-0 min-w-0 flex-col overflow-hidden">
      <SandboxRoom />
    </div>
  );
}
