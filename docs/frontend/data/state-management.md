# State Management & Form Handling

---

## 1. 🌲 Главное дерево решений: «Где хранить состояние?»

```text
Какое состояние вам нужно сохранить?
│
├── 1. Данные пришли с бэкенда (пользователи, список интервью, вопросы)?
│   └── ► TanStack Query (Server State)
│
├── 2. Состояние формы (ввод в инпуты, ошибки валидации)?
│   └── ► React Hook Form + Zod
│
├── 3. Состояние UI, нужное нескольким независимым виджетам/экранам?
│   (свернут ли сайдбар, фильтры в каталоге, временный драфт в редакторе)
│   └── ► Zustand (Client Global State)
│
└── 4. Состояние нужно только одному компоненту (открыт ли dropdown, hover)?
    └── ► useState / useReducer (Local React State)
```

---

## 2. Сводная матрица инструментов

| Тип состояния | Инструмент | Где располагается | Примеры |
|---|---|---|---|
| **Серверные данные** | `TanStack Query` | `entities/<name>/model/` | Список сессий, профиль, статистика |
| **Формы** | `React Hook Form` | `features/<name>/ui/` | Форма входа, форма создания мок-интервью |
| **Валидация** | `Zod` | `packages/dto` или `features/<name>/model/` | Схема пароля, валидация полей |
| **Глобальный UI стейт** | `Zustand` | `shared/model/` или `widgets/<name>/model/` | Тема оформления, состояние медиа-устройств |
| **Локальный UI стейт** | `useState` | Внутри компонента | Состояние переключателя `isExpanded` |

---

## 3. Пример: Zustand Store для UI

```ts
// shared/model/sidebar-store.ts
import { create } from 'zustand';

interface SidebarState {
  isOpen: boolean;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: true,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
```

---

## 4. Пример: React Hook Form + Zod

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const createSessionSchema = z.object({
  topic: z.string().min(3, 'Тема должна содержать от 3 символов'),
  isPrivate: z.boolean(),
  password: z.string().optional(),
});

type FormValues = z.infer<typeof createSessionSchema>;

export function CreateSessionForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(createSessionSchema),
  });

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <input {...register('topic')} placeholder="Тема интервью" />
      {errors.topic && <p className="text-destructive">{errors.topic.message}</p>}
      <button type="submit">Создать</button>
    </form>
  );
}
```
