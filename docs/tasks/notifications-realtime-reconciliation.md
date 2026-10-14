# План: сверка «Центра уведомлений» с ADR-002…ADR-005

Документ описывает расхождения между задачей
`docs/tasks/notifications-realtime.md` и фактической реализацией,
а также план их устранения.

Объём плана: **Фаза 0 (документация) + Фаза 1 (точечные правки кода)**.
Реализация ADR-003 в полном объёме в него не входит и вынесена в техдолг.

## Статус исполнения

Фазы 0 и 1 выполнены. Порядок отличался от планового: сначала Фаза 1,
затем Фаза 0, потому что раздел 3.1 публикует дерево файлов, и оно
должно было совпасть с фактом.

| Пункт | Коммит |
| --- | --- |
| 4.1 удаление мёртвых файлов (2.8) | `089c547` |
| 4.2 + 4.3 `apps/api`: `createdAt`, `read`, `timestamp` (2.3, 2.4) | `ce50f96` |
| 4.2 фронт: терпимая Zod-схема | `e0895e7` |
| 4.5 иконка категории | `1d75e02` |
| 3.3 `docs/frontend/data/realtime.md` | `f57e0f3` |
| 3.1 + 3.2 дерево, чеклист, техдолг, статус в ADR | этот коммит |

Отклонения от плана по факту реализации:

- **4.5, размещение.** План указывал `widgets/notifications/ui/`, но строку
  рендерит `NotificationItem` — энтити. Импорт из виджета нарушил бы
  направление FSD, поэтому компонент лежит в
  `entities/notification/ui/NotificationCategoryIcon.tsx`.
- **4.5, тест-хук.** План не указывал, по чему ассертить. Выбран
  `data-category` на иконке: иконка остаётся `aria-hidden` в соответствии
  с ролью всех иконок в `packages/icons`, а категория читается в тесте
  как `[data-category="INTERVIEW"]`. Новых переводов не вводилось —
  a11y-разрыв остаётся в техдолге.
- **4.5, иконки.** `MessageCircleIcon` и `CogIcon` из плана в
  `packages/icons` нет; использованы существующие `MessageSquareIcon` и
  `SettingsIcon`.
- **3.1, `/notifications`.** В диаграмме раздела 1 заменён маршрут на
  `/dashboard/notifications`, как и предписывал план.

Закрыто: 2.3, 2.4, 2.8, вся Фаза 1, вся Фаза 0. Остаётся техдолг — 2.1,
2.2, 2.5, 2.6, 2.7 и валидация `--category` в `scripts/`, продублированные
в `docs/tasks/notifications-realtime.md` §4.

---

## 1. Статус исходной задачи

Клиентский центр уведомлений реализован (коммиты `6821e5e` → `5f9b4d1`)
и покрыт тестами. Чеклист `notifications-realtime.md:86-100` не отмечен,
но фактическое состояние кода:

| Пункт | Источник | Факт | Файлы |
| --- | --- | --- | --- |
| CRUD + 5 endpoints | чеклист | выполнено | `apps/api/openapi/openapi.yaml:1084-1199`, `apps/api/src/modules/notifications/notifications.controller.ts` |
| SSE + обработка 401/429/503 | чеклист | выполнено | `apps/web/src/shared/api/realtime/notification-stream.ts:22-58` (401 → refresh, 429/503 → `Retry-After`); авто-реконнект даёт дефолт библиотеки `eventsource`, а не этот код |
| Инвалидация + `+1` + Toast | чеклист | выполнено | `apps/web/src/features/notification-realtime/ui/NotificationRealtime.tsx:97-114` |
| Нативные уведомления ОС | чеклист | выполнено | `apps/web/src/shared/lib/notifications/browser-notifications.ts:56-92` |
| Локализация (`@packages/i18n`) | чеклист | выполнено | `packages/i18n/src/locales/ru/common.json`, `packages/i18n/src/locales/en/common.json` — блок `notifications.*` симметричен в обеих локалях |
| `NotificationBell` + popover | чеклист | выполнено | `apps/web/src/widgets/notifications/ui/NotificationBell.tsx` |
| Страница + табы + пусто + пагинация | чеклист | выполнено | `apps/web/src/widgets/notifications/ui/NotificationsList.tsx:77,87,153-162` |
| Иконки категорий | дерево файлов раздела 2 | **не выполнено** | отсутствует `NotificationCategoryIcon` |
| Переход по `actionUrl` | диаграмма раздела 1, шаг 3 | выполнено; доменных producer'ов нет | `browser-notifications.ts:34-54`; единственный рабочий продюсер — CLI, см. 2.2 |

Источники строк различаются. Чеклист `notifications-realtime.md:86-100`
содержит ровно пять пунктов, и все пять фактически закрыты. Иконки
категорий в чеклисте не значились — они пришли из дерева файлов
(`notifications-realtime.md:76`), а переход по `actionUrl` — из
диаграммы раздела 1 (`:24`). Поэтому иконки — долг по дереву файлов, а
не незакрытый пункт чеклиста, и в чеклисте отмечать нечего.

Итог: чеклист закрыт полностью. Остаются пять расхождений контрактов
с ADR (2.1, 2.3, 2.4, 2.5, 2.7 — из них 2.3 и 2.4 закрываются Фазой 1)
и незакрытая работа 4.5.

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

### 2.2. ADR-003:11, 59-68 — нет доменных producer'ов и outbox (техдолг)

`createNotification` вызывается только из спецификаций
(`apps/api/src/modules/notifications/notifications.service.spec.ts:456,493,523,557`).
ADR-003 это уже фиксирует в строке 11.

Продюсеры при этом **есть**, и их два — расхождение ровно в этом:

| Продюсер | Код | Вызывается из домена | Соблюдает контракт |
| --- | --- | --- | --- |
| `scripts/send-sse.mjs` (`pnpm sse:send`) | `redis.xadd` в `user:{userId}:notifications` (`:499-518`) | нет, вручную оператором | да, `createdAt` и `read` уже шлёт (`:476-477`) |
| `apps/api` | `NotificationsService.createNotification` (`notifications.service.ts:191-197`) | нет | нет, см. 2.3 и 2.4 |

Клиентский контур (SSE, `+1`, Toast, Web Notifications) не мёртвый: он
проверяется end-to-end вручную через `pnpm sse:send`, что и описано в
`docs/backend/development/sse-notifications-cli.md`. Мёртвая часть —
автоматика: ни один доменный сервис (`AuthService`, `UsersService`,
`MatchmakingService`, `ShowcaseService`) уведомление не создаёт, поэтому
пользователь не получает ничего без участия оператора.

### 2.3. ADR-004:48, :80 — `apps/api` не шлёт `createdAt` и `read` (исправляется в Фазе 1)

Расхождение не «контракт неполон», а «продюсеры разошлись»: ручной
продюсер `scripts/send-sse.mjs` поля уже отдаёт (`:476-477`), а
`apps/api` — нет. `apps/realtime/internal/sse/payload.go:16-17` и таблица
`apps/realtime/SSE_SPEC.md:151-160` оба поля объявляют,
`notifications.service.ts:191-197` их не отправляет, а Zod-схема фронта
(`apps/web/src/features/notification-realtime/model/schemas.ts:3-11`) их
не требует → расхождение не диагностируется.

Следствие для Фазы 1: поля обязательны в контракте, но на клиенте
принимаются терпимо (см. 4.2). Строгая Zod-схема была бы небезопасна:
`apps/realtime` отдаёт историю стрима по `Last-Event-ID`
(`apps/realtime/internal/handler/sse.go:211-215, 254-257, 272-306`),
клиент `eventsource` заголовок переотправляет сам, стрим живёт 7 суток
при `MAXLEN ~ 100` (`notifications.service.ts:13,15`), а невалидное
событие дропается молча — `reportInvalidEvent` пишет только в
`NODE_ENV=development` (`NotificationRealtime.tsx:26-33`). Значит все
записи, написанные `apps/api` до выкатки, отыгрались бы как
невалидные: ни тоста, ни ОС-пуша, ни `+1`, ни записи в лог.

Отсутствие `read` приводит к тому, что `updateCount(count => count + 1)`
(`NotificationRealtime.tsx:97`) инкрементит счётчик вслепую. Фактический
ущерб ограничен: инкремент оптимистичный и тут же перезатирается
каноническим `notification.badge` (см. 4.2) — расхождение выравнивается в
том же burst, поэтому пункт относится к неполноте контракта, а не к
видимой ошибке счётчика.

### 2.4. ADR-004:44, :77 — `apps/api` не пишет `timestamp` в стрим (исправляется в Фазе 1)

ADR-004:77 требует, чтобы `timestamp` писали оба производителя, и прямо
поручает добавить его в `xadd` в `apps/api`. Фактически:

- `RedisService.xadd` (`apps/api/src/redis/redis.service.ts:368-374`) не
  имеет параметра `timestamp`, а тело (`:375-385`) пишет только `type` и
  `payload`;
- `scripts/send-sse.mjs:513` пишет `timestamp` — то есть ручной продюсер
  требование соблюдает;
- `apps/realtime/internal/storage/notifications.go:353-354` читает
  `timestamp` из записи стрима, поэтому для событий, опубликованных
  `apps/api`, `StreamEvent.Timestamp` остаётся пустым (зафиксировано в
  ADR-004:44);
- docstring `redis.service.ts:346-367` описывает поле как `data: <JSON
  payload>`, тогда как код пишет `"payload"` (`:383`) — ADR-004:77 требует
  привести описание в соответствие.

Рантайм-эффекта при этом нет: `parseTimestamp`
(`apps/realtime/internal/sse/hub.go:613-627`) восстанавливает время
события по трём уровням — поле продюсера, затем миллисекундная часть
Redis Stream ID, иначе текущее время. Поэтому `timestamp` в
SSE-конверте для событий, опубликованных `apps/api`, корректен уже
сегодня, а ADR-004:44 верно только про `StreamEvent.Timestamp`, а не
про провод.

Это не техдолг, а правка в той же функции, которую Фаза 1 уже трогает
(`publishNotificationEvent`, `notifications.service.ts:252-264`), поэтому
входит в объём плана. Объём: сигнатура и docstring `redis.service.ts`,
`redis.service.spec.ts:215`, положительные ассерты `xadd` в
`notifications.service.spec.ts:531` и `:565` (см. 4.4).

### 2.5. ADR-004:50, :79 — коллизия `category` (техдолг, по решению не чинится)

Словарей не два, а три — и третий, CLI, не только смешивает два, но и
допускает выход за оба:

| Слой | Словарь | Источник |
| --- | --- | --- |
| Go, визуальная severity | `info` \| `success` \| `warning` \| `error` | `apps/realtime/internal/sse/event.go:47-61` |
| БД, доменная категория | `SYSTEM` \| `INTERVIEW` \| `MESSAGE` | `apps/api/prisma/schema.prisma:135-139` |
| CLI, оба сразу | `SYSTEM`, `INTERVIEW`, `MESSAGE`, `INFO`, `WARNING`, `ERROR`, `SUCCESS` | `scripts/send-sse.mjs:176` (`.toUpperCase()`), `docs/backend/development/sse-notifications-cli.md:72` |

Словарь CLI фактически не тот, что задокументирован: `--category`
приводится к верхнему регистру безусловно (`send-sse.mjs:176`) и никак
не валидируется, поэтому документированные в
`docs/backend/development/sse-notifications-cli.md:72` значения `info`,
`warning`, `error`, `success` в стрим не попадают — туда уходят
`INFO`, `WARNING`, `ERROR`, `SUCCESS`, которых нет ни в одном словаре.
Значит CLI способен записать в `category` значение вне доменного
словаря. Сегодня это безвредно: поле не декодируется ни в
`apps/realtime`, ни в Zod-схеме фронта, — но после 3.3, где доменный
словарь закрепляется в источнике правды, это остаётся непроверенным
входом. Валидация `--category` в `scripts/` в объём Фазы 1 не входит
(§4).

`apps/api` кладёт в это поле доменную категорию:
`notifications.service.ts:195` → `category: notification.category`.
`docs/frontend/data/realtime.md:305-316` закрепляет неверный вариант
(объявляет поле как severity). Фронтовый Zod поле `category` не
проверяет и молча отбрасывает, поэтому коллизия не диагностируется ни на
одном слое.

ADR-004:79 требует развести понятия: severity остаётся в payload,
`NotificationType` переезжает в `category`. Решение по этому пункту —
**оставить как есть** на уровне рантайма и Go-типов, зафиксировав
расхождение как техдолг. Исключение — объявление типа во фронтовой
спецификации: оно не является частью рантайма, ничего не импортируется
и исправляется в Фазе 0 (3.3), потому что ADR-004:80 назначает
спецификацию источником правды.

Обоснование, по которому откладывание безопасно: `apps/realtime` не
декодирует payload при доставке — он передаётся как `json.RawMessage`
(`internal/storage/notifications.go:52`, чтение из стрима в `:357-358`),
поэтому несовпадение Go-типа `NotificationCategory` с фактическим
значением `SYSTEM` | `INTERVIEW` | `MESSAGE` не приводит ни к ошибке
разбора, ни к падению: расхождение существует только на уровне типов и
не диагностируется. Плата за откладывание — «ложный» контракт в
`docs/frontend/data/realtime.md` (см. 3.3), а не баг в рантайме.

### 2.6. ADR-005 — security-события (техдолг)

Модели `SecurityEvent` в `apps/api/prisma/schema.prisma` нет.
`showBrowserNotification` вызывается на каждый `notification.new` без
проверки типа уведомления (`NotificationRealtime.tsx:115`); сама функция
дополнительно гейтится разрешением браузера
(`browser-notifications.ts:61-67`) и `document.visibilityState === "hidden"`
(`:64`), поэтому ОС-пуш уходит при любой фоновой вкладке с выданным
разрешением. Когда появится security-модель, in-app запись о
security-событии уйдёт в ОС мгновенно, что нарушит ADR-005:141 (при
недоступности Telegram и email — доставка только при следующем входе).

### 2.7. ADR-002:54, :125 — `timestamptz` (техдолг вне объёма)

ADR-002 требует хранить все `DateTime` как `timestamptz(3)`, но в
`schema.prisma` ноль аннотаций `@db.Timestamptz`. Пункт не входит
в объём этого плана.

### 2.8. Мёртвые файлы после консолидации

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
├── widgets/notifications/
│   ├── index.ts                                          # public API слайса
│   └── ui/
│       ├── NotificationBell.tsx                          # кнопка с бейджем и Popover
│       ├── NotificationBell.test.tsx
│       ├── NotificationsList.tsx                         # список, табы категорий, пагинация, Empty
│       └── NotificationsList.test.tsx
├── features/
│   ├── notification-realtime/
│   │   ├── index.ts
│   │   ├── model/schemas.ts                              # Zod-схемы notification.new / notification.badge
│   │   ├── ui/BrowserNotificationControl.tsx             # запрос прав
│   │   ├── ui/BrowserNotificationControl.test.tsx
│   │   ├── ui/NotificationRealtime.tsx                   # подписка, инвалидация, Toast, ОС-пуш
│   │   └── ui/NotificationRealtime.test.tsx
│   └── notification-actions/
│       ├── index.ts
│       └── ui/NotificationActions.tsx                     # mark-as-read, delete
├── entities/notification/
│   ├── index.ts
│   ├── model/useNotificationsQuery.ts
│   ├── model/useUnreadCountQuery.ts
│   ├── model/useMarkAllAsReadMutation.ts
│   └── ui/NotificationItem.tsx
└── shared/
    ├── api/realtime/notification-stream.ts             # EventSource, 401 → refresh, 429/503 → Retry-After
    ├── api/realtime/notification-stream.test.ts
    └── lib/notifications/
        ├── browser-notifications.ts                    # permission, показ, переход по actionUrl
        └── browser-notifications.test.ts
```

- В диаграмме (раздел 1) заменить `/notifications` на `/dashboard/notifications`.
- Отметить все пять пунктов чеклиста — все они выполнены. Иконки
  категорий в чеклисте не значились, отмечать нечего; до завершения
  Фазы 1 они идут отдельной строкой техдолга.
- Добавить раздел «Техдолг» с пунктами 2.1, 2.2, 2.5, 2.6, 2.7.
- Добавить в этот же раздел производителя из 2.2: `pnpm sse:send` — ручной,
  не заменяет доменные вызовы `createNotification`.

### 3.2. `docs/adr/ADR-003.md`, `ADR-004.md`, `ADR-005.md`

В каждый добавить раздел «Статус реализации»:

```text
## Статус реализации

Принято, не реализовано. Реализована только клиентская и CRUD-часть
(см. docs/tasks/notifications-realtime-reconciliation.md, раздел 2).
```

ADR-002 в этот список не входит: расхождение по `timestamptz`
(раздел 2.7) относится к расписанию собеседований, а не к центру
уведомлений, и остаётся зафиксированным только здесь и в разделе 6.

### 3.3. Контракты SSE

ADR-004:77 и :80 требуют обновлять спецификацию как источник правды,
поэтому Фаза 0 обязана трогать и её — иначе новизна 4.2 добавляется в
заведомо неверный контракт.

- `docs/frontend/data/realtime.md:305-316` — **исправить** объявление.
  `NotificationCategory` (`:305`) объявляет `category` как severity,
  тогда как единственный реально работающий продюсер шлёт доменную
  категорию. ADR-004:80 назначает спецификацию источником правды, а
  пометка расхождения документировала бы её как неверную, не обновив.
  Значит `category` меняется на `SYSTEM` | `INTERVIEW` | `MESSAGE`, а
  рядом добавляется необязательное
  `severity?: "info" | "success" | "warning" | "error"` — это конечное
  состояние ADR-004:79 для самого объявления, и оно не требует правок
  ни в `apps/realtime`, ни в `apps/api`, потому что payload там не
  декодируется (`json.RawMessage`). Правка нулевого риска: тип живёт в
  fenced-блоке `typescript` и нигде не импортируется. Рядом —
  примечание, что `apps/realtime` пока типизирует `category` как
  severity, и что CLI способен записать в это поле значение вне
  доменного словаря (см. 2.5).
- `apps/realtime/SSE_SPEC.md:151-160` — правок по `notification.new` не
  требует: таблица уже перечисляет `createdAt` и `read`. Привести ссылку
  «раздел 4.2» в согласованность с `docs/frontend/data/realtime.md`.
  Таблицу по `timestamp` (ADR-004:77, расхождение 2.4) не править: поле
  уже заявлено как обязательное, недостаёт именно реализации в `apps/api`.
- `docs/backend/development/sse-notifications-cli.md:72` — исправить
  перечисление `--category`: задокументированные `info`, `warning`,
  `error`, `success` в стрим не попадают, потому что CLI приводит
  значение к верхнему регистру (`send-sse.mjs:176`) без валидации.
  Фактический набор — `SYSTEM` | `INTERVIEW` | `MESSAGE` | `INFO` |
  `WARNING` | `ERROR` | `SUCCESS`, то есть перечисление смешивает
  доменную категорию, severity и значения вне обоих словарей
  (см. 2.5).

Тип `category` в `apps/realtime/internal/sse/payload.go:12` остаётся
severity до полной реализации ADR-004:79 (разведение `severity` и
`category`), которая вынесена в раздел 6.

---

## 4. Фаза 1 — код

Затронутые приложения: `apps/api`, `apps/web`. `apps/realtime` кодом не
трогается — из него приходит только правка `apps/realtime/SSE_SPEC.md`
из Фазы 0 (3.3).

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
поля, правок не требуется. Комментарий над структурой (`:3-7`) ссылается
на `docs/frontend/data/realtime.md` и `SSE_SPEC.md`; он станет корректным
после 3.3, где расхождение по `category` фиксируется явно.

`apps/web/src/features/notification-realtime/model/schemas.ts:3-11` —
добавить в `newNotificationSchema.payload`:

```ts
createdAt: z.iso.datetime().nullish(),
read: z.boolean().nullish(),
```

Используется `z.iso.datetime()`, а не `z.string().datetime()`: в
`apps/web` стоит Zod 4 (`^4.4.3`), где `.datetime()` на `ZodString`
deprecated, а по всему репозиторию уже принят `z.iso.datetime()`
(`packages/dto/src/notifications/notification.dto.ts:16-19`,
`packages/dto/src/profile/user-profile.dto.ts:15,29`).

Поля объявляются терпимыми, а не обязательными — по причине из 2.3:
строгая схема отбросила бы записи, написанные `apps/api` до выкатки.
`.nullish()`, а не `.optional()`, — совместимо и с отсутствующим полем, и
с явным `null`; стиль совпадает с `actionUrl: z.string().nullish()` в
этом же файле. Терпимость касается только двух новых полей: `id`,
`title` и `message` остаются строгими. `createdAt` клиент сегодня не
читает вовсе, а `read` после правки ниже не читается тоже, поэтому
терпимое объявление ничего не стоит. Ужесточение — см. раздел 6.

Поле `category` не добавляется — см. 2.5.

`apps/web/src/features/notification-realtime/ui/NotificationRealtime.tsx:97`
**не меняется.** Правка на `read` даёт нулевой эффект: `read` всегда
`false`, потому что `createNotification` не принимает `readAt`
(`notifications.service.ts:172-178`) и Prisma создаёт запись с
`readAt: null`, то есть ветка недостижима. Кроме того, инкремент
оптимистичный и в том же burst перезатирается каноническим
`notification.badge` — `createNotification` публикует его сразу после
`notification.new` (`notifications.service.ts:199`), а обработчик
`NotificationRealtime.tsx:133` присваивает `unreadCount` абсолютным
значением. Добавлять недостижимую ветку и тест, охраняющий невозможное
состояние, незачем: чтение `read` появляется вместе с событием
изменения read-состояния по ADR-003 (см. раздел 6).

### 4.3. Дописать `timestamp` в запись стрима (ADR-004:44, :77)

Расхождение 2.4. Правится в той же функции `publishNotificationEvent`,
что и 4.2. Ожидаемый эффект — единообразие записи с продюсером CLI, а
не починка: `parseTimestamp` уже восстанавливает корректное время из
ID стрима (см. 2.4), поэтому пользовательского поведения правка не
меняет.

- `apps/api/src/redis/redis.service.ts:368-374` — добавить в `xadd`
  необязательный параметр `timestamp?: string` и писать его в тело вызова
  (`:375-385`) перед `payload`, полем `timestamp`; порядок не важен для
  стрима, важно имя поля. CLI пишет его именно так
  (`send-sse.mjs:509-514`).
- `apps/api/src/redis/redis.service.ts:346-367` — docstring: заменить
  `data: <JSON payload>` (`:352`) на `payload: <JSON payload>` и
  `timestamp: <RFC 3339>`, описать новый `@param`. ADR-004:77 требует
  привести описание в соответствие с кодом.
- `apps/api/src/modules/notifications/notifications.service.ts:252-264` —
  передавать `new Date().toISOString()` из `publishNotificationEvent`.

Обратная совместимость: `xadd` объявлен один раз
(`redis.service.ts:368`), и единственный его вызов в проде — из
`notifications.service.ts:257`. Поэтому добавление необязательного
параметра в конец сигнатуры затрагивает только спеки
(`redis.service.spec.ts:215`, `notifications.service.spec.ts:531,565`).

### 4.4. Тесты

- `apps/api/src/modules/notifications/notifications.service.spec.ts:531-543` —
  расширить ожидание `xadd` полями `createdAt` и `read` в тесте
  «публикует notification.new в Redis Stream» (`:512-544`). Ожидание
  берёт значения из фикстура `mockNotification` (`:43-54`), где уже есть
  `readAt: null` и `createdAt: new Date()`, поэтому сверять нужно с
  `mockNotification.createdAt.toISOString()` и `read: false`. Тест
  «создает уведомление с category и actionUrl» (`:445-475`) `xadd` не
  ассертит вовсе и правок не требует.
- `apps/api/src/modules/notifications/notifications.service.spec.ts:565-573` —
  из-за 4.3 обновить и это ожидание `xadd` (`notification.badge`):
  добавить `timestamp`. Ассерты `:381` (`not.toHaveBeenCalled()`) и
  `:575` (`toHaveBeenCalledTimes(2)`) не меняются.
- `apps/api/src/redis/redis.service.spec.ts:215` — обновить под новую
  сигнатуру `xadd` и проверить, что запись содержит `timestamp`.
- `apps/web/src/features/notification-realtime/ui/NotificationRealtime.test.tsx` —
  общий фикстур `newNotification` (`:58-62`) остаётся без полей:
  схема терпимая, поэтому все существующие вызовы `emit(...)` по файлу
  остаются валидными и правок в них не требуется. Добавить два кейса:
  (а) payload **нового** формата — с `createdAt` и `read` — парсится и
  инкрементит счётчик; (б) payload **старого** формата — без `createdAt`
  и `read` — то же самое и без вызова `reportInvalidEvent`. Кейс (б) —
  регрессия против дропа старого формата при реплее (см. 2.3). Кейс
  «`read: true` → счётчик не растёт» не добавляется — см. 4.2.

### 4.5. Иконка категории (долг по дереву файлов, не по чеклисту)

Новый файл `apps/web/src/entities/notification/ui/NotificationCategoryIcon.tsx`:
маппинг `SYSTEM → InfoIcon`, `INTERVIEW → CalendarIcon`,
`MESSAGE → MessageSquareIcon` (все экспортируются
`packages/icons/src/icons/ui/index.ts`).

Компонент используется только внутри слайса — из
`NotificationItem.tsx`, который лежит в `entities/notification/ui`
рядом. Реэкспорт из `apps/web/src/entities/notification/index.ts` **не
делается**: у иконки нет внешних потребителей, а публичный API слоя не
должен отдавать внутренние детали. Если иконка понадобится другому
слайсу (например, фильтру в `NotificationsList.tsx`), реэкспорт
добавляется вместе с этим потребителем.

`apps/web/src/entities/notification/ui/NotificationItem.tsx:21-41` —
рендерить иконку по `notification.category`
(тип `NotificationsListDtoItemsItemCategory` уже есть в `packages/api`).

Покрыть в `apps/web/src/widgets/notifications/ui/NotificationsList.test.tsx`
и `apps/web/src/widgets/notifications/ui/NotificationBell.test.tsx`.

---

## 5. Верификация

```bash
pnpm lint
pnpm --filter web typecheck
pnpm --filter api typecheck
pnpm test:web
pnpm test:api
pnpm build:web
pnpm build:api
```

Ручная проверка round-trip обязательна: юнит-тесты доказывают только то,
что `apps/api` пишет поля и что Zod-схема их принимает, но не то, что
`apps/realtime` их пересылает и браузер принимает событие.

```bash
pnpm sse:send --user <userId> --category INTERVIEW --title "Проверка" --message "Проверка"
```

Ожидания: событие `notification.new` приходит, счётчик непрочитанных
растёт, toast показывается, а в консоли нет
`[NotificationRealtime] Invalid SSE event`. Это единственная проверка,
которая ловит дроп записей старого формата при реплее (см. 2.3).

`pnpm test:api` обязателен и покрывает обе правки в `apps/api` — 4.2
(спека `notifications.service.spec.ts:531-543`) и 4.3
(`redis.service.spec.ts:215`, `notifications.service.spec.ts:565-573`).
`pnpm test:realtime` не нужен: код `apps/realtime` Фаза 1 не меняет.

Корневого скрипта `typecheck` нет, и задачи `typecheck` в `turbo.json`
тоже нет — `typecheck` объявлен только в отдельных воркспейсах, поэтому
запуск через turbo/`pnpm typecheck` не сработает. Скрипт `pnpm test`
вызывает `turbo test` и прогоняет **все** воркспейсы, а не только
`apps/web` и `apps/api`, поэтому для точечной проверки используются
`test:web` и `test:api`.

## 6. Вне объёма

- реализация ADR-003 (`type` + `payload` + `rendered*` + `dedupKey`, outbox,
  `NotificationDispatcher`, словарь событий в `packages/types`);
- ужесточение `createdAt` и `read` в `newNotificationSchema.payload` с
  `nullish()` до обязательных — вместе с первым доменным продюсером,
  когда в стриме не останется записей старого формата;
- чтение `read` в `NotificationRealtime.tsx:97` — вместе с событием
  изменения read-состояния по ADR-003;
- разведение `category` и `severity` по ADR-004:79;
- `SecurityEvent` и правило «не пушить немедленно» по ADR-005;
- вызовы `createNotification` из доменных сервисов;
- перевод колонок на `timestamptz(3)` по ADR-002:125;
- смена маршрута `/dashboard/notifications` → `/notifications`.

Оговорка об ожиданиях: до появления доменных продюсеров (пункт 2.2)
пользователь не получает уведомления без участия оператора, поэтому Фаза 1
почти не меняет пользовательское поведение. Контур при этом не мёртвый —
он проверяется через `pnpm sse:send`, и именно поэтому правки 4.2 и 4.3
имеют смысл уже сейчас: они выравнивают `apps/api` с продюсером, который
реально работает, и с контрактом, который уже объявлен в
`SSE_SPEC.md` и `payload.go`. Единственное видимое изменение — иконки в
списке и в колокольчике. Правок поведения в 4.2 и 4.3 нет вовсе: обе
меняют только форму записи, а чтение `read` вынесено в раздел 6 вместе
с ADR-003.
