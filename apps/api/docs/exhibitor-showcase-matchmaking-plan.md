## 1. Метаданные плана

| Параметр | Значение |
| --- | --- |
| **Версия плана** | `v1.0.0` |
| **Целевая спека** | [`exhibitor-showcase-matchmaking-spec.md`](./exhibitor-showcase-matchmaking-spec.md) `v2.0.0` |
| **Тип задачи** | `Feature / New Domain Module` |
| **Компоненты** | `apps/api`, `packages/dto` |
| **Статус** | `In progress` |
| **Ветка** | `dev` |
| **Принятые решения (PMC)** | `onDelete: Cascade` на `targetCard` (осознанный трейдофф); cooldown 24ч — **per-author** (все карточки автора); нейминг колонок новых таблиц — **camelCase** (без `@map`, как в `users`); формат отметок — Markdown чекбоксы; версионирование — версия в заголовке + Changelog |

---

## 2. Легенда и процесс ведения

* Каждая задача — чекбокс `- [ ]`. Считается выполненной только после реального завершения и проверки (требование «не закрывать по намерению»).
* Формат отметок:

  | Отметка | Значение |
  | --- | --- |
  | `- [ ]` | Не начато |
  | `- [x]` | Выполнено и проверено |

* Версионирование: при изменении плана — `patch` (мелкие правки), `minor` (новая фаза/задача), `major` (смена архитектурного решения); фиксировать в Changelog (§5).
* По завершении фазы обновляется таблица прогресса (§4) и статус в §1.

---

## 3. Фазы и задачи

### Фаза 0 — Доработка спеки и версионирование

- [x] Спека обновлена до `v2.0.0` по всем рекомендациям ревью (приватность контактов, атомарность, cooldown per-author, auto-match обеих сторон, P2002→409, фиксы Zod, трейдоффы).
- [x] В спеке на месте: Секции метаданных с версией, Changelog и «Известные трейдоффы».
- [x] Взаимные ссылки «спека ↔ план» проставлены.
- [x] План прошёл ревью команды (vetting PMC), замечания внесены и версионированы.

### Фаза 1 — Prisma: схема и миграция

- [ ] Добавлены `enum`: `Specialization`, `ExperienceLevel`, `InterviewLanguage`, `ShowcaseCardStatus`, `MatchRequestStatus`.
- [ ] Смоделированы `ShowcaseCard` (поля и колонки **camelCase** без `@map`, `@@map` названий таблиц, индексы, `@@index([skills], type: Gin)`, `@@index([bumpedAt(sort: Desc)])`) и `MatchRequest` (включая `@@index([receiverId, status, createdAt])` для cooldown per-author).
- [ ] `User` дополнен связями `showcaseCards`, `sentMatchRequests`, `receivedMatchRequests`.
- [ ] Подтверждён `onDelete: Cascade` на `targetCard` + комментарий о трейдоффе; `onDelete: SetNull` на `senderCard`.
- [ ] Миграция: `pnpm --filter api run db:migrate:dev -- --create-only` + ручной raw SQL для двух partial unique indexes (`unique_active_user_specialization_level`, `unique_pending_match_request_per_card`; колонки `userId`/`senderId`/`targetCardId` — camelCase).
- [ ] `pnpm --filter api run db:generate` — без ошибок.
- [ ] `pnpm --filter api run db:migrate:deploy` применён в локальной БД (docker).
- [ ] Схема провалидирована (PostgreSQL 16, Prisma 7): enum-сортировка для `LEVEL_ASC/DESC`, GIN, partial indexes.

### Фаза 2 — `@packages/dto`

- [ ] `showcase/showcase.enums.ts` — все enum-схемы + типы; `matchRequestStatusEnum` экспортируется из этого файла.
- [ ] `showcase/search-parser.ts` — `sanitizeSearchTerm`, `stripHtmlTags`, `normalizeSkill`, `parseSearchQuery` (макс. 100 симв., макс. 10 токенов, макс. 50 симв. на токен, очистка control chars, удалён неиспользуемый `raw`).
- [ ] `showcase/manage-showcase-card.dto.ts` — create/update/status + комментарий: очистка `skills` до `[]` запрещена.
- [ ] `showcase/showcase-query.dto.ts` — фикс `isUrgent` без `z.coerce.boolean()` (строго `"true"/"false"` → `boolean`), `skill` с `toLowerCase`, pagination `page`/`limit`.
- [ ] `matchmaking/matchmaking.dto.ts` — create/reject/query (контракты из спеки).
- [ ] Ответы: `showcase-response.dto.ts`, `match-request-response.dto.ts` — `PublicUserCardDto` с маскировкой `telegramUsername`/`gitUrl` (null, кроме пары в `ACCEPTED`), `PaginatedResponseDto<T>`.
- [ ] `@packages/dto` собран: `pnpm --filter @packages/dto build` + `pnpm --filter @packages/dto typecheck`.
- [ ] `search-parser.spec.ts` (vitest) — кейсы §10.1 + edge-кейсы (см. Фазу 6).

### Фаза 3 — `ShowcaseModule`

- [ ] `ShowcaseController` — все маршруты §7.1; `ThrottlerGuard` на `GET /showcase`, `POST /showcase`, `PATCH /showcase/:id`, `/status`, `/bump`, `/renew`, `DELETE`.
- [ ] `createCard` — проверка профиля (`displayName >= 2`, `username`), лимит 5 активных (в `$transaction`), P2002→`409 Conflict`, `expiresAt = now() + 15d`.
- [ ] `findAll` — `status: ACTIVE` + `expiresAt > now()` + `user.deletedAt: null`, исключение себя, фильтры, парсер `+/-/terms` (terms = AND-пересечение), sort `BUMPED`/`NEWEST`/`LEVEL_*`.
- [ ] `findById` — не-автор видит только `ACTIVE` и неистекшие; маскировка контактов по `currentUserId`.
- [ ] `update` — автор-only; при смене `specialization`/`level` P2002→409; `expiresAt`/`bumpedAt` не обновляются через DTO.
- [ ] `updateStatus` — `ACTIVE↔INACTIVE`; `INACTIVE→ACTIVE` запрещён, если `expiresAt` истёк (→ `renew`), + проверка уникальности пары.
- [ ] `bump` — атомарно через `updateMany({ where: { id, bumpedAt: { lte: now-24h } }, data: { bumpedAt: now() } })`; иначе `400` с таймером ожидания.
- [ ] `renew` — только `EXPIRED`→`ACTIVE` (`409` для `ACTIVE`), владелец не `deletedAt`, комбо-конфликт→`409`, `expiresAt = now() + 15d`, `bumpedAt = now()`.
- [ ] `delete` — автор-only; задокументировано, что Cascade стирает историю заявок (осознанный трейдофф).
- [ ] `/showcase/my` — статистика `stats` через `groupBy` (`pending`/`accepted`), без N+1.

### Фаза 4 — `MatchmakingModule`

- [ ] `createRequest` — self-invite (`400`), лимит 10 `PENDING` входящих на карточку (`400`), лимит 5 `PENDING` исходящих (`429`), cooldown per-author 24ч после `REJECT` (`400`), `senderCardId` опционален.
- [ ] Auto-match — при встречном `PENDING` обе заявки → `ACCEPTED` в одной транзакции + публикация 2 событий.
- [ ] P2002 по `unique_pending_match_request_per_card` → `409 Conflict`.
- [ ] `acceptRequest` — автор-only (receiver), атомарно `updateMany({ where: { id, receiverId, status: PENDING } })`; повторный accept игнорируется/409; другие заявки остаются `PENDING`.
- [ ] `acceptRequest` — публикация в Redis `matchmaking:events` внутри `try/catch` (сбой Redis не фейлит accept).
- [ ] `rejectRequest` — автор-only, `PENDING`→`REJECTED` + `rejectReason`.
- [ ] `cancelRequest` — отправитель-only, только `PENDING`→`CANCELLED`; повторная отправка после cancel разрешена сразу.
- [ ] `getIncoming`/`getOutgoing` — фильтр `status` + пагинация; `rejectReason` показывается автору исходящей заявки.
- [ ] `getUnreadCount` — число входящих `PENDING` (для бейджа шапки).
- [ ] Маскировка контактов в ответах: `telegramUsername`/`gitUrl` только для пары в `ACCEPTED`.

### Фаза 5 — Cron-сервисы

- [ ] `ShowcaseCronService` — каждые 15 мин: `autoRenew=true` → продление (+15д, `bumpedAt=now`), `autoRenew=false` → `EXPIRED`; пакетная обработка; Redis distributed lock (паттерн `UserCleanupCron` `setNx`).
- [ ] `MatchmakingCronService` — каждый час: `PENDING` старше 72ч → `EXPIRED`; пакетная обработка; Redis distributed lock.
- [ ] Идемпотентность и обработка ошибок: логирование, `return 0` при занятом локе, освобождение лока в `finally`.

### Фаза 6 — Тесты и качество

- [ ] `ShowcaseService.spec` — prerequisites, create (success/дубль/лимит 5), bump (успех/24ч), renew (guards: active/owner deletedAt/конфликт), status (INACTIVE→ACTIVE expired), P2002→409, privacy-маска контактов.
- [ ] `ShowcaseCron.spec` — autoRenew true/false, distributed lock (занятый лок — пропуск).
- [ ] `MatchmakingService.spec` — create (success/queue 10/self-invite/cooldown), cooldown scope (блок к ЛЮБОЙ карточке автора), auto-match обе стороны, accept (double-click), reject (rejectReason), cancel (только PENDING), unread, expire.
- [ ] `MatchmakingCron.spec` — перевод просроченных в `EXPIRED`, lock.
- [ ] Парсер (unit в `@packages/dto`): `+`/`-` без термина, `++react`, `-react`, >10 токенов, спек-символы `% _ \`, control chars, `isUrgent=false` → `false` (query-схема).
- [ ] Покрытие `>= 85%`.
- [ ] Гейты: `pnpm lint`, `pnpm test:api`, `pnpm --filter @packages/dto test`, `pnpm --filter @packages/dto typecheck` — без ошибок.

### Фаза 7 — Swagger и финальные проверки

- [ ] Новый пайп `apps/api/src/common/pipes/zod-query.pipe.ts` (аналог `ZodValidationPipe` для `@Query`) + unit-тест.
- [ ] `ZodBody` для request-схем; query-схемы подключены через query-пайп; enum'ы в Swagger корректны.
- [ ] Проверка `/api/docs`: эндпоинты showcase/matchmaking, схемы запроса/ответа.
- [ ] Финальный прогон DoD (§11 спеки, включая новые критерии 11–14).
- [ ] Версии обновлены: спека и план получают `patch`/`minor` бамп за финальные правки + записи в Changelog.
- [ ] Коммит в `dev` с описанием изменений (по `docs/pull-request.md`).

---

## 4. Прогресс по фазам

| Фаза | Статус | Задачи (выполнено/всего) |
| --- | --- | --- |
| Ф0 — Спека и версии | `Done` | 4 / 4 |
| Ф1 — Prisma | `Planned` | 0 / 8 |
| Ф2 — `@packages/dto` | `Planned` | 0 / 8 |
| Ф3 — `ShowcaseModule` | `Planned` | 0 / 10 |
| Ф4 — `MatchmakingModule` | `Planned` | 0 / 10 |
| Ф5 — Cron | `Planned` | 0 / 3 |
| Ф6 — Тесты и качество | `Planned` | 0 / 7 |
| Ф7 — Swagger и финал | `Planned` | 0 / 6 |

*Счётчик обновляется вручную по мере закрытия чекбоксов.*

---

## 5. Changelog

### v1.0.0 (2026-09-02)

* Первая версия плана.
* Фазы вынесены по слоям (Ф0–Ф7), приняты решения PMC:
  * `onDelete: Cascade` на `targetCard` оставлен (зафиксирован трейдофф);
  * cooldown 24ч после `REJECT` — per-author (все карточки автора);
  * колонки новых таблиц — camelCase без `@map` (единообразно с `users`);
  * рекомендации ревью зафиксированы в спеке `v2.0.0`.