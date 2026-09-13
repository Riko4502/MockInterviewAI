import type { Metadata } from "next";
import { NotFoundView } from "./NotFoundView";
import "@/shared/styles/globals.css";

export const metadata: Metadata = {
  title: "404 — Страница не найдена | DEVSYNC",
  description: "Запрашиваемая страница не существует или была перемещена.",
};

export default function NotFound() {
  return <NotFoundView />;
}
