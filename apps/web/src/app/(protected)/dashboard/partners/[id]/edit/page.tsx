import type { Metadata } from "next";
import { EditCardView } from "@/features/manage-showcase-card";

export const metadata: Metadata = {
  title: "Редактирование анкеты | MockInterviewAI",
  description:
    "Редактирование анкеты кандидата для тренировочных собеседований",
};

interface EditCardPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCardPage({ params }: EditCardPageProps) {
  const { id } = await params;
  return <EditCardView cardId={id} />;
}
