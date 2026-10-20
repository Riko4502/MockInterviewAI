# Спецификация: синхронизация таймзоны в дашборде (widgets/dashboard)

## 1. Цель

Убрать локальный `useState("UTC")` в виджетах дашборда и использовать таймзону из профиля текущего пользователя.

> **Предпосылка [B].** Требует, чтобы `GET /profile/me` возвращал `timezone` (см. §2.1 shared-спецификации правил). Иначе всегда будет срабатывать фоллбэк на зону браузера.

## 2. Файлы правки

| Файл | Тип | Описание |
|---|---|---|
| `widgets/dashboard/ui/upcoming-session/DashboardUpcomingSession.tsx` | EDIT | Заменить `useState("UTC")` на `userTimezone` |
| `widgets/dashboard/ui/analytics/DashboardRecentSessions.tsx` | EDIT | Заменить `useState("UTC")` на `userTimezone` |

## 3. Правило вычисления userTimezone

```ts
const userTimezone = useViewerTimezone() // см. [1]
```

## 4. Требования

- Убрать локальный стейт таймзоны
- Использовать `userTimezone` во всех форматированиях дат/времени в этих виджетах
- Форматирование через существующие утилиты (при наличии) либо `formatInstantInTimeZone` из `@packages/utils`, если форматирование добавляется/меняется
- Сохранить существующую логику отображения

## 5. Тест-кейсы

- [x] Используется `timezone` из профиля (тесты виджетов подставляют `/profile/me` с зоной и проверяют отформатированное время)
- [x] Фоллбэк на зону браузера при отсутствии профиля (покрыт `use-viewer-timezone.test.tsx`)
- [x] Фоллбэк на `UTC` при недоступности всего (покрыт `use-viewer-timezone.test.tsx`)

## 6. Связи

- `useViewerTimezone()` (сущность user, план [1])
- `@packages/utils` при правках форматирования
