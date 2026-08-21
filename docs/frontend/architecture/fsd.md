# Feature-Sliced Design (FSD)

Основное приложение `apps/web` следует методологии **Feature-Sliced Design (v2)**.  
Официальная документация FSD: [https://feature-sliced.design](https://feature-sliced.design)

---

## 1. Иерархия слоев

Слои строго упорядочены по уровню абстракции (сверху вниз):

```text
apps/web/src/
├── app/         # 1. Инициализация: провайдеры, роутинг, глобальные стили
├── pages/       # 2. Страницы: композиция виджетов и фич в целостные экраны
├── widgets/     # 3. Виджеты: крупные самостоятельные UI-блоки (Sidebar, Header)
├── features/    # 4. Фичи: пользовательские сценарии и действия (Auth, RunCode)
├── entities/    # 5. Сущности: бизнес-модели (User, Session, Feedback)
└── shared/      # 6. Shared: утилиты, общие UI-примитивы, базовые хуки
```

---

## 2. Матрица слоев и ответственности

| Слой | Ответственность | Примеры | Чего НЕ должно быть |
|---|---|---|---|
| **`app/`** | Глобальные провайдеры, Next.js роутинг, стили | `providers/`, `layout.tsx`, `globals.css` | Бизнес-логики сущностей |
| **`pages/`** | Композиция страницы из виджетов | `LoginPage`, `InterviewWorkspacePage` | Прямых тяжелых API-вызовов и стейта |
| **`widgets/`** | Крупные UI-блоки | `Navbar`, `CodeEditorWidget`, `RatingBoard` | Дублирования логики фич |
| **`features/`** | Действия пользователя («Что делает?») | `login-by-email`, `request-ai-hint` | UI-примитивов общего назначения |
| **`entities/`** | Бизнес-сущности («С чем работает?») | `user`, `interview-session`, `feedback` | Интерактивных действий и форм |
| **`shared/`** | Переиспользуемый код вне домена | `shared/lib/cn.ts`, `shared/hooks` | Знания о User, Session и бизнес-логики |

---

## 3. Правило направления зависимостей

> **Главное правило:** Модуль может импортировать только то, что находится **строго ниже** него по слоям.  
> Импорты на одном слое (Cross-imports между слайсами) **запрещены**.

```text
pages ──► widgets ──► features ──► entities ──► shared
```

* ✅ `widgets/sidebar` может импортировать `features/logout` и `entities/user`.
* ❌ `entities/user` НЕ МОЖЕТ импортировать `features/edit-profile`.
* ❌ `features/create-session` НЕ МОЖЕТ импортировать `features/login`. Если логика общая, она выносится в `entities` или `shared`.

---

## 4. Структура слайса и Public API

Каждый слайс обязан предоставлять публичный интерфейс через корневой `index.ts`:

```text
features/auth-by-email/
├── ui/              # Компоненты UI (LoginForm.tsx)
├── model/           # Хуки, стейт, типы (use-login.ts, types.ts)
├── api/             # API вызовы (auth-api.ts)
└── index.ts         # Public API
```

### Пример Public API:
```ts
// features/auth-by-email/index.ts
export { LoginForm } from './ui/LoginForm';
export type { LoginPayload } from './model/types';
```

```tsx
// ❌ ЗАПРЕЩЕНО (глубокий импорт во внутренности слайса)
import { LoginForm } from '@/features/auth-by-email/ui/LoginForm';

// ✅ РАЗРЕШЕНО
import { LoginForm } from '@/features/auth-by-email';
```
