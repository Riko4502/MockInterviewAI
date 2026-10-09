# Спецификация: синхронизация таймзоны в дашборде (widgets/dashboard)

## 1. Цель

Убрать локальный `useState("UTC")` в виджетах дашборда и использовать таймзону из профиля текущего пользователя.

## 2. Файлы правки

| Файл | Тип | Описание |
|---|---|---|
| `widgets/dashboard/ui/upcoming-session/DashboardUpcomingSession.tsx` | EDIT | Заменить `useState("UTC")` на `userTimezone` |
| `widgets/dashboard/ui/analytics/DashboardRecentSessions.tsx` | EDIT | Заменить `useState("UTC")` на `userTimezone` |

## 3. Правило вычисления userTimezone

```ts
const { data: user } = useCurrentUser()
const userTimezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
```

## 4. Требования

- Убрать локальный стейт таймзоны
- Использовать `userTimezone` во всех форматированиях дат/времени в этих виджетах
- Форматирование через существующие утилиты (при наличии) либо `formatInstantInTimeZone` из `@packages/utils/datetime`, если форматирование добавляется/меняется
- Сохранить существующую логику отображения

## 5. Тест-кейсы

- [ ] Используется `user.timezone` из профиля
- [ ] Фоллбэк на зону браузера при отсутствии профиля
- [ ] Фоллбэк на `UTC` при недоступности всего

## 6. Связи

- Профиль пользователя (`useCurrentUser`)
- `@packages/utils/datetime` при правках форматирования
