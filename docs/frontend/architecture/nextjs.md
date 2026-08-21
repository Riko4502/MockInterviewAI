# Next.js App Router & Server Components

Приложение `apps/web` построено на базе **Next.js 15+ (App Router)** и React 19.

---

## 1. Интеграция Next.js App Router и FSD

В Next.js директория `src/app` является встроенным механизмом маршрутизации (файловый роутер). Чтобы не конфликтовать с методологией FSD, принято следующее соглашение:

1. **`src/app` выполняет только роль роутера и провайдеров:**
   - Содержит `layout.tsx`, `page.tsx`, `error.tsx`, `loading.tsx`, `providers/`.
2. **Файлы `page.tsx` должны быть максимально «тонкими»:**
   - `page.tsx` только принимает параметры URL и рендерит готовую страницу из `src/pages/...` или собирает композицию из `src/widgets/...`.

### Пример тонкого роута:
```tsx
// apps/web/src/app/(auth)/login/page.tsx
import { LoginPage } from '@/pages/login';

export default function Route() {
  return <LoginPage />;
}
```

---

## 2. Server Components vs Client Components

В Next.js App Router все компоненты по умолчанию являются **Server Components (RSC)**.

### Где ставить границу `'use client'`?
Граница определяется ответственностью и необходимостью браузерных возможностей:

| Требование | Где выполняется |
|---|---|
| Загрузка начальных данных, доступ к серверным заголовкам | **Server Component** |
| SEO-разметка, статическая верстка, layout | **Server Component** |
| Интерактивность (`onClick`, `onChange`, формы) | **Client Component** (`'use client'`) |
| React-хуки (`useState`, `useEffect`, `useRef`) | **Client Component** (`'use client'`) |
| Клиентские библиотеки (Zustand, React Hook Form) | **Client Component** (`'use client'`) |

> 💡 **Правило:** Директива `'use client'` добавляется на **минимально возможном листовом уровне** дерева компонентов, а не на всю страницу.

### Пример правильной композиции:

```tsx
// 1. Server Component: загружает данные без передачи лишнего JS на клиент
// apps/web/src/pages/dashboard/ui/DashboardPage.tsx
import { UserProfileHeader } from '@/entities/user';
import { StartInterviewButton } from '@/features/start-interview'; // Client Component внутри

export async function DashboardPage() {
  return (
    <main className="p-6">
      <UserProfileHeader />
      <StartInterviewButton />
    </main>
  );
}
```
