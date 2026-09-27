# План: сверка «Центра уведомлений» с ADR-002…ADR-005

Документ описывает расхождения между задачей
`docs/tasks/notifications-realtime.md` и фактической реализацией,
а также план их устранения.

Объём плана: **Фаза 0 (документация) + Фаза 1 (точечные правки кода)**.
Реализация ADR-003 в полном объёме в него не входит и вынесена в техдолг.

---

## 1. Статус исходной задачи

Клиентский центр уведомлений реализован (коммиты `6821e5e` → `5f9b4d1`)
и покрыт тестами. Чеклист `notifications-realtime.md:86-100` не отмечен,
но фактическое состояние кода:

| Пункт чеклиста | Факт | Файлы |
| --- | --- | --- |
| CRUD + 5 endpoints | выполнено | `apps/api/openapi/openapi.yaml:1084-1199`, `apps/api/src/modules/notifications/notifications.controller.ts` |
| SSE + авто-реконнект | выполнено | `apps/web/src/shared/api/realtime/notification-stream.ts:22-58` (401 → refresh, 429/503 → `Retry-After`) |
| Инвалидация + `+1` + Toast | выполнено | `apps/web/src/features/notification-realtime/ui/NotificationRealtime.tsx:97-114` |
| Нативные уведомления ОС | выполнено | `apps/web/src/shared/lib/notifications/browser-notifications.ts:56-92` |
| `NotificationBell` + popover | выполнено | `apps/web/src/widgets/notifications/ui/NotificationBell.tsx` |
| Страница + табы + пусто + пагинация | выполнено | `apps/web/src/widgets/notifications/ui/NotificationsList.tsx:77,87,153-162` |
| Иконки категорий | **не выполнено** | отсутствует `NotificationCategoryIcon` |
| Переход по `actionUrl` | выполнено, но producer'ов нет | `browser-notifications.ts:34-54` |

Итог: остался один незакрытый пункт чеклиста (иконки категорий) и
четыре расхождения контрактов с ADR.

---

## 2. Расхождения с ADR

### 2.1. ADR-003:51-55 — `title`/`message` вместо `type`/`payload` (техдолг)

ADR-003 удаляет `title`/`message` в пользу `type` + `payload` +
`renderedTitle`/`renderedMessage`. Фактически
`apps/api/prisma/schema.prisma:145-146` хранит готовые строки, а фронт
рендерит их напрямую:

- `apps/web/src/features/notification-realtime/ui/NotificationRealtime.tsx:103-104`;
- `apps/web/src/shared/lib/notifications/browser-notifications.ts:68-69`;
- `apps/web/src/entities/notification/ui/NotificationItem.tsx:25,40`.

Следствия: рендер текста не вынесен в `@packages/i18n`; бот не может
рендерить сам (ADR-003:55); при смене локали старые уведомления остаются
на старом языке.

### 2.2. ADR-003:11, 59-68 — нет producer'ов и outbox (техдолг)

`createNotification` вызывается только из спецификаций
(`apps/api/src/modules/notifications/notifications.service.spec.ts:456,493,523,557`).
SSE никогда не публикует `notification.new`, поэтому весь realtime-контур
и Web Notifications — мёртвый код в проде. ADR-003 это уже фиксирует в
строке 11.

### 2.3. ADR-004:48, :80 — `notification.new` без `createdAt` и `read` (исправляется в Фазе 1)

`apps/realtime/internal/sse/payload.go:16-17` объявляет оба поля,
`notifications.service.ts:191-197` их не отправляет, а Zod-схема фронта
(`apps/web/src/features/notification-realtime/model/schemas.ts:3-11`)
их не требует → расхождение не диагностируется.

Отсутствие `read` приводит к тому, что `updateCount(count => count + 1)`
(`NotificationRealtime.tsx:97`) инкрементит счётчик вслепую.

### 2.4. ADR-004:50, :79 — коллизия `category` (техдолг, по решению не чинится)

`apps/realtime/internal/sse/event.go:46-57` объявляет `NotificationCategory`
как severity (`info` | `success` | `warning` | `error`), а API кладёт в это
поле доменную категорию: `notifications.service.ts:195` →
`category: notification.category` (`SYSTEM` | `INTERVIEW` | `MESSAGE`).
`docs/frontend/data/realtime.md:305-315` закрепляет неверный вариант.
Фронтовый Zod поле `category` не проверяет и молча отбрасывает.

ADR-004:79 требует развести понятия: severity остаётся в payload,
`NotificationType` переезжает в `category`. Решение по этому пункту —
**оставить как есть**, зафиксировать расхождение как техдолг.

### 2.5. ADR-005 — security-события (техдолг)

Модели `SecurityEvent` в `apps/api/prisma/schema.prisma` нет.
`showBrowserNotification` вызывается на каждый `notification.new`
безусловно (`NotificationRealtime.tsx:115`). Когда появится
security-модель, in-app запись о security-событии уйдёт в ОС мгновенно,
что нарушит ADR-005 (доставка только при следующем входе).

### 2.6. ADR-002:54, :125 — `timestamptz` (техдолг вне объёма)

ADR-002 требует хранить все `DateTime` как `timestamptz(3)`, но в
`schema.prisma` ноль аннотаций `@db.Timestamptz`. Пункт не входит
в объём этого плана.

### 2.7. Мёртвые файлы после консолидации

Нулевые по размеру, без импортов (alias `@entities/*` без barrel):

- `apps/web/src/entities/ui/NotificationItem.tsx`;
- `apps/web/src/entities/index.ts`.

Созданы `6821e5e`, осиротели в `5f9b4d1`.

---

## 3. Фаза 0 — документация

### 3.1. `docs/tasks/notifications-realtime.md`

- Заменить раздел 2 («Структура файлов в моннорепозитории») на фактическую:

```text
apps/web/src/
├── app/(protected)/dashboard/notifications/page.tsx   # страница, рендерит NotificationsList
├── widgets/notifications/ui/
│   ├── NotificationBell.tsx                            # кнопка с бейджем и Popover
│   └── NotificationsList.tsx                           # список, табы категорий, пагинация, Empty
├── features/
│   ├── notification-realtime/
│   │   ├── model/schemas.ts                            # Zod-схемы notification.new / notification.badge
│   │   └── ui/NotificationRealtime.tsx                 # подписка, инвалидация, Toast, ОС-пуш
│   │   └── ui/BrowserNotificationControl.tsx           # запрос прав
│   └── notification-actions/ui/NotificationActions.tsx # mark-as-read, delete
├── entities/notification/
│   ├── model/useNotificationsQuery.ts
│   ├── model/useUnreadCountQuery.ts
│   ├── model/useMarkAllAsReadMutation.ts
│   └── ui/NotificationItem.tsx
└── shared/
    ├── api/realtime/notification-stream.ts             # EventSource + reconnect
    └── lib/notifications/browser-notifications.ts      # permission, показ, переход по actionUrl
```

- В диаграмме (раздел 1) заменить `/notifications` на `/dashboard/notifications`.
- Отметить выполненные пункты чеклиста, оставить незакрытым только
  «иконки категорий» до завершения Фазы 1.
- Добавить раздел «Техдолг» с пунктами 2.1, 2.2, 2.4, 2.5, 2.6.

### 3.2. `docs/adr/ADR-003.md`, `ADR-004.md`, `ADR-005.md`

В каждый добавить раздел «Статус реализации»:

```text
## Статус реализации

Принято, не реализовано. Реализована только клиентская и CRUD-часть
(см. docs/tasks/notifications-realtime-reconciliation.md, раздел 2).
```

---

## 4. Фаза 1 — код

Затронутые приложения: `apps/api`, `apps/realtime` (проверка контракта),
`apps/web`.

### 4.1. Удалить мёртвые файлы

- `apps/web/src/entities/ui/NotificationItem.tsx`;
- `apps/web/src/entities/index.ts`.

### 4.2. Дополнить payload `notification.new` (ADR-004:48, :80)

`apps/api/src/modules/notifications/notifications.service.ts:191-197` —
добавить в публикуемый объект:

```ts
createdAt: notification.createdAt.toISOString(),
read: notification.readAt !== null,
```

`apps/realtime/internal/sse/payload.go:10-18` — контракт уже содержит оба
поля, правок не требуется; привести комментарий в соответствие с фактом.

`apps/web/src/features/notification-realtime/model/schemas.ts:3-11` —
добавить в `newNotificationSchema.payload`:

```ts
createdAt: z.string().datetime(),
read: z.boolean(),
```

Поле `category` не добавляется — см. 2.4.

`apps/web/src/features/notification-realtime/ui/NotificationRealtime.tsx:97` —
инкрементировать счётчик только для непрочитанных:

```ts
updateCount((count) => (notification.read ? count : count + 1));
```

### 4.3. Тесты

- `apps/api/src/modules/notifications/notifications.service.spec.ts:445-475` —
  расширить ожидание `xadd` полями `createdAt` и `read`.
- `apps/web/src/features/notification-realtime/ui/NotificationRealtime.test.tsx` —
  кейс «`read: true` → счётчик не растёт».

### 4.4. Иконка категории (незакрытый пункт чеклиста)

Новый файл `apps/web/src/entities/notification/ui/NotificationCategoryIcon.tsx`:
маппинг `SYSTEM → InfoIcon`, `INTERVIEW → CalendarIcon`,
`MESSAGE → MessageSquareIcon` (все экспортируются
`packages/icons/src/icons/ui/index.ts`). Реэкспорт из
`apps/web/src/entities/notification/index.ts`.

`apps/web/src/entities/notification/ui/NotificationItem.tsx:21-41` —
рендерить иконку по `notification.category`
(тип `NotificationsListDtoItemsItemCategory` уже есть в `packages/api`).

Покрыть в `NotificationsList.test.tsx` и `NotificationBell.test.tsx`.

---

## 5. Верификация

```text
pnpm lint
pnpm typecheck
pnpm test   (apps/web, apps/api)
pnpm build  (apps/web, apps/api)
```

## 6. Вне объёма

- реализация ADR-003 (`type` + `payload` + `rendered*` + `dedupKey`, outbox,
  `NotificationDispatcher`, словарь событий в `packages/types`);
- разведение `category` и `severity` по ADR-004:79;
- `SecurityEvent` и правило «не пушить немедленно» по ADR-005;
- вызовы `createNotification` из доменных сервисов;
- перевод колонок на `timestamptz(3)` по ADR-002:125;
- смена маршрута `/dashboard/notifications` → `/notifications`.
