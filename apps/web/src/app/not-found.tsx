import { ArrowRightIcon } from "@packages/icons";
import { Button, Logo, NotFoundView } from "@packages/ui";
import Link from "next/link";
import { paths } from "@/shared/config";

/**
 * Презентационный Server Component страницы 404 (Not Found).
 * Использует общий NotFoundView из @packages/ui с единым дизайном.
 */
export default function NotFound() {
  return (
    <NotFoundView
      badgeText="СИСТЕМНЫЙ СБОЙ // МАРШРУТ НЕ НАЙДЕН"
      title="Маршрут не найден"
      description="Запрашиваемый адрес отсутствует в карте маршрутизации или был перемещен."
      terminalFilename="route-resolver.log"
      codeComment="целевой ресурс не может быть разрешен"
      codeError="FatalError: [ERR_PAGE_NOT_FOUND] 404"
      logoElement={<Logo variant="full" size="lg" href={paths.dashboard} />}
      actionElement={
        <Button
          asChild
          size="lg"
          className="group h-12 w-full sm:w-auto px-8 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white font-semibold text-sm shadow-xl shadow-violet-500/25 transition-all duration-300 hover:from-violet-500 hover:via-indigo-500 hover:to-purple-500 hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0"
        >
          <Link
            href={paths.dashboard}
            className="flex items-center justify-center gap-2.5"
          >
            <span>Вернуться на главную</span>
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      }
    />
  );
}
