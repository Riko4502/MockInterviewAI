# Маршрутизация и защита маршрутов (AuthBoundary)

В приложении `apps/web` защита маршрутов реализована через декларативный компонент **`AuthBoundary`** и группировку маршрутов Next.js App Router: `(guest)` и `(protected)`.

---

## 1. Архитектурный обзор

```text
                                [RootLayout (AppProviders)]
                                            │
                                  [SessionProvider] (Client)
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
    [(guest)/layout.tsx] (Server)   [(protected)/layout.tsx] (Server)    Optional Pages
               │                            │                            │
    <AuthBoundary mode="guest">     <AuthBoundary mode="protected">   <AuthBoundary mode="optional">
               │                            │                            │
   ┌───────────┴───────────┐        ┌───────┴───────┐                    ▼
   ▼                       ▼        ▼               ▼               Public/Shared
/login                  /register /dashboard    /dashboard/*          (no redirect)
```

### Ключевые принципы:
1. **Единый источник истины**: Состояние сессии управляется синглтоном `SessionProvider` (`INITIALIZING`, `AUTHENTICATED`, `UNAUTHENTICATED`, `ERROR`).
2. **Отсутствие middleware proxy cookie-check**: Cookie `refresh_token` изолирована бэкендом атрибутом `Path=/api/v1/auth`. Браузер отправляет её исключительно на `/api/v1/auth/*`, поэтому серверный Next.js proxy не имеет прямого доступа к токену. Вся аутентификация маршрутов прозрачно разруливается на клиенте через `SessionProvider` + `AuthBoundary`.
3. **Предотвращение мигания контента (Zero-Flash)**: Пока `SessionProvider` восстанавливает токен (`INITIALIZING`), `AuthBoundary` в режимах `protected` и `guest` отображает полноэкранный спиннер.
4. **Защита от Open Redirect**: Параметр `returnTo` строго валидируется функцией `getSafeReturnTo()`.

---

## 2. Компонент `AuthBoundary`

Компонент расположен в [`apps/web/src/features/auth/ui/AuthBoundary.tsx`](file:///d:/проекты/MockInterviewAI/apps/web/src/features/auth/ui/AuthBoundary.tsx) и экспортируется через `@/features/auth`.

### API:

```typescript
export type AuthBoundaryMode = "guest" | "protected" | "optional";

export interface AuthBoundaryProps {
  mode: AuthBoundaryMode;
  children: React.ReactNode;
}
```

### Режимы работы:

| Режим | Initializing | Authenticated | Unauthenticated | Error |
|---|---|---|---|---|
| `protected` | Loading spinner (контент скрыт) | Рендерит `children` | Редирект на `/login?returnTo=<path>` | Редирект на `/login?returnTo=<path>` |
| `guest` | Loading spinner (формы не мигают) | Редирект на `/dashboard` или безопасный `returnTo` | Рендерит `children` (`/login`, `/register`) | Рендерит `children` (повтор входа) |
| `optional` | Loading spinner | Рендерит `children` (без редиректа) | Рендерит `children` (без редиректа) | Рендерит `children` (без редиректа) |

> ⚠️ **Критическое правило для `mode="optional"`:** режим `optional` **никогда** не выполняет redirect на основе статуса аутентификации. Страница рендерится для всех пользователей, а разделение UI (например, кнопка «Сохранить» vs «Войти, чтобы сохранить») выполняется дочерними компонентами через хук `useSession()`.

---

## 3. Защита от Open Redirect (`getSafeReturnTo`)

Для предотвращения атак Open Redirect и XSS при перенаправлении из гостевой зоны параметр `returnTo` валидируется:

```typescript
export function getSafeReturnTo(returnTo: string | null): string {
  if (!returnTo) {
    return paths.dashboard;
  }

  // Разрешены только относительные пути, начинающиеся с одного '/'
  if (
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !returnTo.includes(":") &&
    !returnTo.includes("\\")
  ) {
    return returnTo;
  }

  return paths.dashboard;
}
```

- Разрешено: `/dashboard`, `/dashboard/interviews`, `/dashboard/statistics`
- Отклонено (fallback на `/dashboard`): `https://evil.com`, `//evil.com`, `javascript:alert(1)`, `/\\evil.com`

---

## 4. Структура маршрутов Next.js

```text
apps/web/src/app/
├── (guest)/
│   ├── layout.tsx         # Server Component: <AuthBoundary mode="guest">{children}</AuthBoundary>
│   ├── login/
│   │   └── page.tsx       # /login
│   └── register/
│       └── page.tsx       # /register
│
├── (protected)/
│   ├── layout.tsx         # Server Component: <AuthBoundary mode="protected">{children}</AuthBoundary>
│   └── dashboard/
│       ├── layout.tsx     # Server Component: Sidebar + main layout
│       └── page.tsx       # /dashboard
│
├── not-found.tsx
├── layout.tsx
└── globals.css
```

Route groups `(guest)` и `(protected)` служат исключительно для группировки layout и **не попадают в URL**. Для страниц со смешанным доступом (`mode="optional"`) отдельная route group не создаётся — компонент оборачивает соответствующее дерево напрямую.

---

## 5. Композиция RSC и Client Components

- `(guest)/layout.tsx` — **Server Component**
- `(protected)/layout.tsx` — **Server Component**
- `dashboard/layout.tsx` — **Server Component**
- `AuthBoundary.tsx` — **Client Component** (`"use client"`), использует хуки `useSession()`, `useRouter()`, `usePathname()`, `useSearchParams()`.
