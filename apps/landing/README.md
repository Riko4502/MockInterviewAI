# @apps/landing

Промо-лендинг платформы проведения технических и мок-интервью **MockInterviewAI** (**DEVSYNC**).

Построен на базе **Astro** в режиме генерации статического контента (SSG/SSR) с нулевым JavaScript-оверхедом для достижения максимальной производительности (100/100 в Google Lighthouse), 100% покрытием интернационализацией (RU / EN), централизованной маршрутизацией на веб-приложение/поддомен и переиспользованием дизайн-токенов из `@packages/ui`.

---

## 🛠 Стек технологий

- **Фреймворк:** [Astro](https://astro.build/) (v5+)
- **Стилизация:** [Tailwind CSS](https://tailwindcss.com/) (v4 via `@tailwindcss/vite`)
- **Дизайн-система:** `@packages/ui` (единые CSS-токены, переменные цветов OKLCH и радиусы)
- **Интернационализация (i18n):** Нативная поддержка роутинга Astro (`/` — RU, `/en` — EN)
- **Тестирование:** [Vitest](https://vitest.dev/) (тесты целостности словарей переводов и роутинга ссылок)
- **Веб-сервер и контейнеризация:** Nginx Alpine, Docker multi-stage build

---

## 📁 Структура проекта

```text
apps/landing/
├── src/
│   ├── components/
│   │   ├── how-it-works/             # Декомпозированные этапы секции «Как это работает»
│   │   │   ├── StepTrackSelect.astro # Шаг 01: Выбор трека и специализации
│   │   │   ├── StepAiInterview.astro # Шаг 02: Видео-комната с эквалайзером ИИ
│   │   │   ├── StepLiveCoding.astro  # Шаг 03: Live coding sandbox и автотесты
│   │   │   └── StepScorecard.astro   # Шаг 04: Аналитический скоркард сессии
│   │   ├── CTA.astro                 # Секция призыва к действию (Call-to-Action)
│   │   ├── Features.astro            # Bento Grid с возможностями платформы
│   │   ├── Footer.astro              # Футер со статусом платформы и навигацией
│   │   ├── Hero.astro                # Первый экран с интерактивным макетом IDE
│   │   ├── HowItWorks.astro          # Главный оркестратор секции шагов
│   │   ├── LandingPage.astro         # Базовый HTML-шаблон и сборка страницы
│   │   └── Navbar.astro              # Шапка со сменой языка и мобильным меню
│   ├── config/
│   │   ├── navigation.ts             # Централизованные ссылки входа/регистрации (getAuthUrl)
│   │   └── navigation.test.ts        # Unit-тесты генерации ссылок и работы с поддоменами
│   ├── i18n/
│   │   ├── ui.ts                     # Словари локализации (RU / EN) и утилиты
│   │   └── ui.test.ts                # Тесты 100% паритета ключей RU/EN
│   ├── pages/
│   │   ├── en/
│   │   │   └── index.astro           # Англоязычная версия (/en)
│   │   └── index.astro               # Русскоязычная версия (/)
│   └── styles/
│       └── globals.css               # Импорт @packages/ui и эффекты (Glassmorphism, Glow)
├── astro.config.mjs                  # Конфигурация Astro, i18n и Tailwind Vite plugin
├── vitest.config.ts                  # Конфигурация Vitest для тестов
├── Dockerfile                        # Multi-stage сборка (Node builder + Nginx runtime)
├── nginx.conf                        # Конфигурация Nginx для отдачи статики
├── package.json
└── tsconfig.json
```

---

## 🔗 Централизованная маршрутизация авторизации (`src/config/navigation.ts`)

Все ссылки на вход (`Войти` / `Sign in`), регистрацию и разделы основного веб-приложения формируются централизованно через модуль `src/config/navigation.ts`.

Это позволяет автоматически подставлять адрес веб-приложения на поддомене (например, `app.devsync.ai` или `app.mockinterviewai.com`), передавая переменную окружения в GitHub Actions / Docker / `.env`:

```env
PUBLIC_APP_URL=https://app.yourdomain.com
```

### Использование функций:

```ts
import { getAuthUrl, getRegisterUrl, getAppUrl } from '@/config/navigation';

const loginLink = getAuthUrl();       // -> "https://app.yourdomain.com/login"
const registerLink = getRegisterUrl(); // -> "https://app.yourdomain.com/register"
const docsLink = getAppUrl('/docs');   // -> "https://app.yourdomain.com/docs"
```

---

## 🌐 Интернационализация (i18n)

Маршрутизация настроена без префикса для основного языка (русский):

- **Русский язык (дефолтный):** `http://localhost:4321/`
- **Английский язык:** `http://localhost:4321/en`

Все текстовые элементы (включая заголовки, бейджи, описания карточек, статусы и диалоги) вынесены в `src/i18n/ui.ts` и покрыты тестами на паритет ключей.

---

## 🎨 Дизайн-система и токены цветов

Лендинг напрямую использует дизайн-систему монорепозитория через `src/styles/globals.css`:

```css
@import "tailwindcss";
@import "@packages/ui/globals.css";

/* Специфичные эффекты лендинга (на базе CSS-переменных темы): */
/* var(--background), var(--card), var(--primary), var(--border), var(--accent) */
```

---

## 🧪 Тестирование

Запуск тестов локализации и формирования ссылок:

```bash
# Из корня монорепозитория
pnpm test:landing

# Напрямую из apps/landing
pnpm test
```

---

## 🚀 Команды разработки и сборки

### Из корня монорепозитория:

```bash
# Запуск dev-сервера лендинга (порт 4321)
pnpm dev:landing

# Сборка статического сайта в dist/
pnpm build:landing

# Проверка типов TypeScript и Astro
pnpm --filter landing check

# Запуск тестов
pnpm --filter landing test
```

---

## 🐳 Docker и продакшн развертывание

```bash
# Сборка Docker-образа
docker build -t mock-landing -f apps/landing/Dockerfile .

# Запуск контейнера на 80 порту
docker run -d -p 80:80 --name mock-landing-container mock-landing
```
