# @apps/landing

Промо-лендинг платформы технических и мок-интервью **MockInterviewAI** (**DEVSYNC**).

Построен на базе **Next.js** (App Router, React 19, TypeScript) в режиме статического экспорта (`output: "export"`, `distDir: "dist"`) для максимальной производительности, 100% покрытия интернационализацией (RU / EN), централизованной маршрутизации на веб-приложение/поддомен и переиспользования дизайн-токенов из `@packages/ui` и `@packages/tailwind-config`.

---

## 🛠 Стек технологий

- **Фреймворк:** [Next.js](https://nextjs.org/) 16+ (App Router, React 19, TypeScript 5.7+ Strict Mode)
- **Режим сборки:** Статический экспорт (`output: 'export'`) с генерацией статических HTML, XML и TXT артефактов в каталог `dist`
- **Стилизация:** [Tailwind CSS](https://tailwindcss.com/) v4 (`@tailwindcss/postcss`), `@packages/tailwind-config`
- **Дизайн-система:** `@packages/ui` (типографика `Typography`, кнопки `Button`, `Badge`, `Card`), `@packages/icons`
- **Интернационализация (i18n):** `@packages/i18n` (Single Source of Truth), `react-i18next`, namespaces (`landing`, `common`), `I18nClientProvider`
- **Тестирование:** [Vitest](https://vitest.dev/) (v8 coverage)
- **Линтинг и форматирование:** [Biome](https://biomejs.dev/)
- **Веб-сервер и контейнеризация:** Nginx Alpine, Docker multi-stage build

---

## 📁 Архитектура проекта (Feature-Sliced Design)

Проект организован в соответствии с методологией **Feature-Sliced Design (FSD)**:

```text
apps/landing/
├── src/
│   ├── app/                          # Next.js App Router (Routing & Layouts)
│   │   ├── (ru)/                     # Route group для русской локали (/)
│   │   │   ├── layout.tsx            # Root layout (<html lang="ru">)
│   │   │   └── page.tsx              # Русская главная страница с metadata
│   │   ├── (en)/                     # Route group для английской локали (/en/)
│   │   │   └── en/
│   │   │       ├── layout.tsx        # Root layout (<html lang="en">)
│   │   │       └── page.tsx          # Английская главная страница с metadata
│   │   ├── BaseLayout.tsx            # Базовый серверный layout
│   │   ├── not-found.tsx             # 404 страница (Next.js App Router convention)
│   │   ├── NotFoundView.tsx          # Клиентский интерактивный 404 view
│   │   ├── robots.ts                 # Директивы robots.txt (force-static)
│   │   └── sitemap.ts                # Генератор карты сайта sitemap.xml (force-static)
│   ├── views/                        # Слой страниц (Views)
│   │   └── landing/                  # Композиция страницы лендинга (LandingPage)
│   ├── widgets/                      # Крупные самостоятельные UI-блоки лендинга
│   │   ├── navbar/                   # Навигационная панель и мобильное меню
│   │   ├── hero/                     # Первый экран с демо-лайвкодингом
│   │   ├── how-it-works/             # Интерактивные шаги симулятора собеседования
│   │   ├── features/                 # Bento-grid возможностей платформы
│   │   ├── cta/                      # Призыв к действию (CTA)
│   │   ├── footer/                   # Подвал сайта и правовая информация
│   │   └── activity-toast/           # Всплывающее уведомление о сессиях
│   ├── features/                     # Пользовательские сценарии
│   │   └── language-switcher/        # Переключатель языков (NavLanguageSwitcher)
│   └── shared/                       # Переиспользуемый инфраструктурный код
│       ├── assets/                   # Локальные ассеты и шрифты (fonts/)
│       ├── config/                   # Конфигурация и валидация env / navigation
│       ├── lib/                      # Утилиты i18n, client provider, нормализация локали
│       ├── styles/                   # globals.css, анимации, reduced-motion
│       └── ui/                       # Logo, SectionHeader, DynamicBackground, GlobalSpotlight
├── next.config.ts                    # output: 'export', distDir: 'dist', trailingSlash: true
├── nginx.conf                        # Nginx конфигурация со статическим 404
├── Dockerfile                        # Multi-stage сборка (builder + nginx runtime)
├── vitest.config.ts                  # Конфигурация тестов Vitest
├── package.json                      # Скрипты dev, build, preview, start, typecheck, test
└── tsconfig.json                     # Конфигурация TypeScript (paths @/* -> ./src/*)
```

---

## 🌐 Интернационализация (i18n)

- **Источник истины:** Пакет `@packages/i18n` содержит типизированные словари (`landing.json`, `common.json`, `auth.json`, `interview.json`).
- **Маршрутизация:**
  - `/` — Русскоязычная версия сайта (`<html lang="ru">`).
  - `/en/` — Англоязычная версия сайта (`<html lang="en">`).
- **URL Authoritative:** URL является единственным авторитарным источником текущего языка.
- **Client Boundary:** Клиентские компоненты оборачиваются в `I18nClientProvider` и используют стандартный хук `useTranslation("landing")`.
- **Язык браузера:** `window.navigator.language` считывается строго на клиенте через чистую функцию `normalizeBrowserLocale()` для подсказок в переключателе языков и не переопределяет текущий активный URL.

---

## ⚙️ Переменные окружения (Environment Variables)

Валидация переменных окружения выполняется модулем `src/shared/config/env.ts` с защитой от использования localhost в production-окружении:

| Переменная | Описание | Значение по умолчанию |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Канонический URL лендинга | `https://mockinterviewai.com` |
| `NEXT_PUBLIC_APP_URL` | Базовый URL веб-приложения | `https://app.mockinterviewai.com` |
| `NEXT_PUBLIC_AUTH_URL` | URL страницы входа | `${NEXT_PUBLIC_APP_URL}/login` |
| `NEXT_PUBLIC_REGISTER_URL` | URL страницы регистрации | `${NEXT_PUBLIC_APP_URL}/register` |
| `NEXT_PUBLIC_GITHUB_URL` | URL репозитория проекта | `https://github.com/Riko4502/MockInterviewAI` |

---

## 📜 Доступные скрипты (Scripts)

Все команды выполняются из корня монорепозитория через `pnpm --filter landing <command>` либо непосредственно в каталоге `apps/landing`:

```bash
# Запуск dev-сервера Next.js на порту 4321
pnpm --filter landing run dev

# Сборка статического экспорта в каталог dist/
pnpm --filter landing run build

# Локальный предпросмотр (Preview) статического экспорта dist/ на порту 4321
pnpm --filter landing run preview

# Запуск статического сервера для собранного dist/
pnpm --filter landing run start

# Статическая проверка типов TypeScript
pnpm --filter landing run typecheck

# Запуск unit-тестов Vitest
pnpm --filter landing test

# Запуск unit-тестов с генерацией отчёта покрытия
pnpm --filter landing run test:cov

# Проверка качества кода с помощью Biome
pnpm --filter landing run lint

# Автоматическое форматирование кода с помощью Biome
pnpm --filter landing run format
```

---

## 🐳 Сборка Docker и развёртывание

Лендинг упаковывается в минимальный production-образ на базе Nginx Alpine:

```bash
# Сборка Docker-образа из корня монорепозитория
docker build -f apps/landing/Dockerfile -t mockinterviewai-landing:latest .

# Запуск контейнера на порту 80
docker run -d -p 80:80 mockinterviewai-landing:latest
```

Конфигурация Nginx (`nginx.conf`) настроена для статического хостинга:
- `try_files $uri $uri/ $uri.html =404;` гарантирует корректную отдачу статических страниц `/` и `/en/`.
- Несуществующие пути не вызывают немой fallback на русскую главную страницу, а отдают статус HTTP `404` с разметкой `dist/404.html`.
