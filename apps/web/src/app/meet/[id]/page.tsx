import type { Metadata } from "next";
import { AuthBoundary } from "@/features/auth";
import { MeetingPageClient } from "./MeetingPageClient";

export const metadata: Metadata = {
  title: "Видеовстреча | MockInterviewAI",
  description: "Универсальные видеокомнаты для созвонов и встреч",
};

interface MeetingPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Публичная страница видеовстречи со смешанным доступом (/meet/[id]).
 * Поддерживает как авторизованных пользователей, так и гостей (AuthBoundary mode="optional").
 */
export default async function MeetingPage({ params }: MeetingPageProps) {
  const { id } = await params;

  return (
    <AuthBoundary mode="optional">
      <MeetingPageClient sessionId={id} />
    </AuthBoundary>
  );
}
