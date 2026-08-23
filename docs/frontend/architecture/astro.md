# Astro Landing (`apps/landing`)

Приложение `apps/landing` предназначено для публичного маркетингового лендинга и оптимизации SEO.  
Официальная документация Astro: [https://astro.build](https://astro.build)

---

## 1. Почему выбран Astro?

1. **Zero JS by default:** Страницы генерируются как чистый HTML/CSS без клиентского JavaScript runtime, что обеспечивает максимальные баллы Core Web Vitals и мгновенную загрузку.
2. **SEO-first:** Оптимизированная генерация мета-тегов, OpenGraph и sitemap.
3. **React Islands:** Возможность точечно подключать интерактивные React-компоненты из `@packages/ui`.

---

## 2. Структура `apps/landing`

```text
apps/landing/
├── src/
│   ├── layouts/         # Базовые HTML-разметки (BaseLayout.astro)
│   ├── pages/           # Страницы (index.astro, pricing.astro)
│   ├── components/      # Презентационные секции (Hero.astro, Features.astro)
│   └── styles/          # Глобальные стили лендинга
├── public/              # Статические ассеты (картинки, favicon)
├── astro.config.mjs
└── package.json
```

---

## 3. Использование `@packages/ui` и React Islands

Если на лендинге нужен интерактивный React-компонент (например, форма заявки или модальное окно):

```astro
---
// index.astro
import { Button } from '@packages/ui';
import InteractiveDemo from '../components/InteractiveDemo';
---

<section>
  <h1>Платформа мок-интервью нового поколения</h1>
  <!-- Статическая кнопка -->
  <Button>Попробовать бесплатно</Button>
  
  <!-- Интерактивный React остров (гидратируется на клиенте) -->
  <InteractiveDemo client:visible />
</section>
```

---

## 4. Локальный запуск лендинга

```bash
# Запуск dev-сервера Astro (порт 4321)
pnpm --filter landing dev

# Сборка статического лендинга
pnpm --filter landing build
```
