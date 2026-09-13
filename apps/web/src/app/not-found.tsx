import { ArrowRightIcon } from "@packages/icons";
import { Button, Logo, Typography } from "@packages/ui";
import Link from "next/link";
import { paths } from "@/shared/config";
import { DynamicBackground } from "@/shared/ui";

/**
 * Презентационный Server Component страницы 404 (Not Found).
 * Полностью выдержан в едином визуальном языке лендинга DEVSYNC:
 * космический фон, статус-бейдж, крупная градиентная типографика 404,
 * терминальная панель route-resolver.log и акцентный CTA.
 */
export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center select-none">
      {/* 1. Атмосферный динамический фон (RSC) */}
      <DynamicBackground />

      {/* 2. Центральный фоновый Ambient Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-violet-600/20 via-purple-600/15 to-sky-500/10 blur-[140px]"
      />

      {/* 3. Центральная композиция */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
        {/* Логотип платформы */}
        <div className="mb-6 sm:mb-8">
          <Logo variant="full" size="lg" href={paths.dashboard} />
        </div>

        {/* Кибернетический статус-бейдж */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 font-mono text-xs font-semibold tracking-wider text-violet-400 uppercase backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
          </span>
          <span>{"СИСТЕМНЫЙ СБОЙ // МАРШРУТ НЕ НАЙДЕН"}</span>
        </div>

        {/* Крупный акцентный 404 дисплей */}
        <div className="relative py-1 select-none">
          <span className="inline-block bg-gradient-to-r from-violet-500 via-purple-400 to-indigo-300 bg-clip-text text-8xl font-black tracking-tighter text-transparent drop-shadow-[0_0_40px_rgba(168,85,247,0.35)] sm:text-9xl md:text-[11rem] leading-none">
            404
          </span>
        </div>

        {/* Заголовок H1 */}
        <Typography.H1 className="mb-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl md:text-4xl">
          Маршрут не найден
        </Typography.H1>

        {/* Описание */}
        <p className="mx-auto max-w-lg text-sm text-slate-400 sm:text-base leading-relaxed">
          Запрашиваемый адрес отсутствует в карте маршрутизации или был
          перемещен.
        </p>

        {/* Техническая терминальная панель лога */}
        <div className="relative mt-8 w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0c0d14]/80 p-4 sm:p-5 text-left font-mono text-xs sm:text-sm shadow-2xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3 text-slate-400">
            <div className="flex items-center gap-2">
              <span className="inline-block size-3 rounded-full bg-red-500/80" />
              <span className="inline-block size-3 rounded-full bg-yellow-500/80" />
              <span className="inline-block size-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-[11px] text-slate-400">
                route-resolver.log
              </span>
            </div>
            <span className="rounded border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 font-medium text-[10px] text-violet-400">
              HTTP 404
            </span>
          </div>

          <div className="space-y-1.5 text-slate-300">
            <div className="flex items-start gap-2">
              <span className="select-none text-violet-400">&gt;</span>
              <span>
                <span className="text-pink-400">const</span> targetNode ={" "}
                <span className="text-indigo-400">Router</span>.
                <span className="text-cyan-400">resolve</span>(pathname);
              </span>
            </div>
            <div className="flex items-start gap-2 italic text-slate-500">
              <span className="select-none">{"//"}</span>
              <span>целевой ресурс не может быть разрешен</span>
            </div>
            <div className="flex items-start gap-2 text-rose-400">
              <span className="select-none">!</span>
              <span>
                FatalError:{" "}
                <span className="font-semibold text-rose-300">
                  [ERR_PAGE_NOT_FOUND]
                </span>{" "}
                404
              </span>
            </div>
          </div>
        </div>

        {/* Главное целевое действие (Primary CTA) */}
        <div className="pt-8 flex items-center justify-center w-full">
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
        </div>
      </div>
    </main>
  );
}
