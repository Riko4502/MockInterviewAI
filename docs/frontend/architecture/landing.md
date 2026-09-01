# Next.js Landing (`apps/landing`)

Приложение `apps/landing` предназначено для публичного маркетингового лендинга и оптимизации SEO.  
Построено на **Next.js 16** (App Router, React 19, TypeScript) в режиме статического экспорта (`output: "export"`) и следует методологии **Feature-Sliced Design (FSD)**.

---

## 1. Архитектура и преимущества Next.js Landing

1. **Static Export (`output: "export"`):** Страницы предварительно генерируются в статический HTML/CSS/JS в директорию `dist/`, что позволяет отдавать их через легковесный Nginx или статический CDN без необходимости поддержки Node.js runtime на проде.
2. **SEO & Performance:** Полный серверный пререндеринг, оптимизированные мета-теги и sitemap.
3. **Единая экосистема с `apps/web`:** Методология FSD, React 19, `@packages/ui`, `@packages/icons`, `@packages/utils` и Tailwind CSS v4.
4. **FSD Линтинг в Biome:** Строгие правила `noRestrictedImports` на уровне слоев и запрет глубоких импортов (Deep imports).

---

## 2. FSD-структура `apps/landing`

```text
apps/landing/src/
├── app/                     # 1. App Router (layout.tsx, page.tsx, en/page.tsx)
├── views/                   # 2. Views (страницы композиции экранов)
│   └── landing/             # Public API: export { LandingPage } from './ui/LandingPage'
├── widgets/                 # 3. Виджеты (крупные автономные UI-блоки)
│   ├── navbar/              # Navbar, NavLinks, NavMobileMenu
│   ├── hero/                # Hero, HeroMetrics, HeroCodeMockup
│   ├── how-it-works/        # HowItWorks, StepTrackSelect, StepAiInterview, StepLiveCoding, StepScorecard
│   ├── features/            # Features, FeatureCollaboration, FeatureVoice, FeatureSandbox, FeatureAnalytics
│   ├── cta/                 # CTA, CtaBenefits
│   └── footer/              # Footer, FooterBrand, FooterNavLinks, FooterBottom
├── features/                # 4. Фичи (пользовательские действия)
│   └── language-switcher/   # NavLanguageSwitcher
└── shared/                  # 5. Shared (переиспользуемый базис)
    ├── config/              # navigation.ts (getAuthUrl, getAppUrl)
    ├── i18n/                # ui.ts, ui.test.ts (словари, useTranslations)
    ├── styles/              # globals.css
    └── ui/                  # Logo, PillBadge, SectionHeader
```

---

## 3. Использование `@packages/ui` и `@packages/icons`

Компоненты из дизайн-системы и иконок подключаются напрямую:

```tsx
import { GithubIcon, CodeIcon } from '@packages/icons';
import { Button, Badge } from '@packages/ui';
```

---

## 4. Локальный запуск и проверки

```bash
# Запуск dev-сервера (порт 4321)
pnpm --filter landing dev

# Проверка типов
pnpm --filter landing check

# Сборка статического лендинга
pnpm --filter landing build

# Линтер и форматирование (Biome FSD Rules)
pnpm --filter landing lint

# Запуск тестов
pnpm --filter landing test
```
