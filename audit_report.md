# Технический аудит репозитория MockInterviewAI

## Executive Summary

Репозиторий `MockInterviewAI` представляет собой монорепозиторий на основе Turborepo. Архитектура построена на NestJS (бэкенд), Next.js (фронтенд) и Go (realtime сервис). Код содержит сложную бизнес-логику управления сессиями, WebRTC (через LiveKit) и аутентификацией с JWT и Redis-сессиями.

В проекте уделено большое внимание безопасности (например, детальная обработка JWT, защита от race conditions, fail-closed паттерны), однако обнаружен ряд серьезных дефектов в тестах (false positives), уязвимости к TOCTOU в проверках Redis-сессий, проблемы с обработкой ошибок в бизнес-логике и неконсистентности в конфигурации. Наибольший риск представляют ложноположительные тесты и скрытые гонки, которые дают ложное чувство безопасности.

## Findings

| Priority | Category | Problem | Location | CWE |
| -------- | -------- | ------- | -------- | --- |
| P1 | Security / Logic | Ошибки отзыва сессий молча подавляются: `.catch(() => undefined)` | `apps/api/src/modules/auth/auth.service.ts` | CWE-391 |
| P1 | Test Quality | Ложноположительные тесты из-за подавления ошибок `.catch(() => undefined)` | `apps/api/src/modules/auth/auth.service.spec.ts` | CWE-695 |
| P2 | CI/CD | Выполнение `pnpm run codegen:check` в CI может падать из-за расхождения клиента с OpenAPI | `packages/api/package.json` | - |
| P2 | Test Quality | Неполная или неточная проверка утверждений `.rejects.toThrow()` без указания ожидаемой ошибки | `packages/api/src/transport.test.ts` | CWE-695 |
| P2 | Test Quality | Некорректное использование `.resolves.toBeUndefined()` для проверки успешного выполнения (скрывает ошибки) | `apps/api/src/modules/sessions/sessions.service.spec.ts` | CWE-695 |
| P3 | Architecture | Дублирование логики `revokeAllUserSessions` в разных местах | `apps/api/src/modules/auth/auth.service.ts` | CWE-1041 |

### Top 10 проблем (по убыванию риска)

1. **False-positive тесты (`auth.service.spec.ts`)**: Использование `.catch(() => undefined)` внутри тестов при проверке логирования (например, "raw токены не попадают в логи"). Если тестируемый метод завершится успешно (вместо ожидаемого сброса с ошибкой), `catch` ничего не поймает, логи не будут записаны, и `expect(logged).not.toContain(...)` успешно пройдет! Это маскирует отсутствие генерации ошибки.
2. **Молчаливое подавление ошибок удаления AuthRevocationTask (`auth.service.ts`, строки 447, 547, 827)**: Ошибки при удалении задач из базы глушатся. Если БД недоступна, задача останется висеть, что вызовет бесконечный цикл повторов.
4. **Неэффективные assertions `.rejects.toThrow()` (`transport.test.ts` и другие)**: В тестах часто используется `toThrow()` без указания конкретного типа ошибки (например, `toThrow(TransportNotInitializedError)`). Если выбросится любая другая ошибка (например, `TypeError`), тест всё равно пройдёт.
5. **Использование `.resolves.toBeUndefined()` (`sessions.service.spec.ts`:633)**: Этот assertion работает некорректно в некоторых версиях jest/vitest, так как Promise может резолвится с `undefined`, но если он реджектится, тест падает по неперехваченному исключению, а не по assertion'у. Правильно использовать `.resolves.not.toThrow()`.
6. **False-positive проверки URI в `SandboxRoom.test.tsx` (CWE-598)**: В компоненте написано "вычищаем чувствительный invite-токен из URL", но тестирование этой логики опирается на моки `replaceState` и может не отлавливать реальные утечки, если `window.location` используется напрямую сторонними скриптами.
7. **Отсутствие проверки аргументов в `.not.toHaveBeenCalledWith` (`auth-session.service.spec.ts`)**: Тесты проверяют, что `redisDelete` не был вызван с определенными ключами, но если логика сломается и он не будет вызван вообще, эти проверки пройдут (CWE-695).
8. **Codegen Drift (CI/CD)**: Команда `codegen:check` падает, если `openapi.yaml` и сгенерированный клиент рассинхронизированы, что говорит о нестабильности процесса кодогенерации (отсутствуют pre-commit хуки).
9. **Durable Tasks (AuthRevocationTask) не логируют причины сбоя корректно**: Подавление `delete` маскирует реальную проблему с БД.
10. **Необработанный Promise rejection**: `el.play?.().catch(() => {})` скрывает ошибки автовоспроизведения видео на клиенте.

---

### Security findings

ID: SEC-01
Priority: P1
Category: Security / Logic
CWE: CWE-391 (Unchecked Error Condition)
Location:
  `apps/api/src/modules/auth/auth.service.ts`:447, 547, 827
Problem:
Ошибки удаления `authRevocationTask` молча подавляются: `.catch(() => undefined)`.
Root cause:
Попытка сделать удаление "fire-and-forget", но в транзакционном блоке сбой удаления означает, что durable задача может зависнуть в неопределенном состоянии.
Impact:
Если БД перегружена или недоступна, задача не будет удалена, воркер будет бесконечно пытаться её обработать, что приведёт к спаму в Redis и БД.
Evidence:
```typescript
await this.prisma.authRevocationTask
  .delete({ where: { id: taskId } })
  .catch(() => undefined);
```
Recommended fix:
Логировать ошибку удаления (warning), чтобы её можно было отследить в мониторинге.
Regression test:
Добавить тест, где `prisma.authRevocationTask.delete` бросает ошибку, и убедиться, что система вызывает `logger.warn`.

---

### Test quality findings (False-Positives)

ID: TST-01
Priority: P0
Category: Test Quality / False Positive
CWE: CWE-695
Location:
  `apps/api/src/modules/auth/auth.service.spec.ts`:702, 716, 943, 1132
Problem:
В тестах активно используется `.catch(() => undefined)` при ожидании исключения (например, проверка безопасности логов).
Root cause:
Тестировщик не использовал `await expect(promise).rejects.toThrow()`, а просто проглотил ошибку, чтобы проверить побочные эффекты (логи).
Impact:
Если функция `register` (которая должна упасть из-за `redis down`) завершится УСПЕШНО из-за регрессии (bug), она НЕ запишет ошибки в лог, и `expect(logged).not.toContain(DTO.password)` успешно пройдет! Тест всегда "зеленый", даже если логика сломана.
Evidence:
```typescript
createSession.mockRejectedValue(new Error("redis down"));
await service.register(DTO).catch(() => undefined); // Если register НЕ бросит ошибку, тест все равно пройдет!
```
Recommended fix:
Использовать явное ожидание ошибки:
```typescript
await expect(service.register(DTO)).rejects.toThrow();
// затем проверки логов
```

ID: TST-02
Priority: P2
Category: Test Quality
CWE: CWE-695
Location:
  `packages/api/src/transport.test.ts`
Problem:
Использование `.rejects.toThrow()` без указания ожидаемой ошибки (например, строки или класса).
Root cause:
Неполные assertions.
Impact:
Тест может маскировать падения из-за синтаксических ошибок (например `TypeError: undefined is not a function`) вместо ожидаемых `TransportNotInitializedError`.
Evidence:
В `packages/api/src/transport.test.ts` (и других файлах тестов) используются утверждения вроде `.rejects.toThrow()` без указания конкретного типа ошибки (например, `toThrow(TransportNotInitializedError)`).
Recommended fix:
Всегда указывать тип или сообщение ошибки: `.rejects.toThrow(TransportNotInitializedError)`.
Regression test:
Проверить, что тесты падают при выбросе неожиданной ошибки, например `TypeError`.

ID: TST-03
Priority: P2
Category: Test Quality
CWE: CWE-695
Location:
  `apps/api/src/modules/sessions/sessions.service.spec.ts`:633
Problem:
Использование `.resolves.toBeUndefined()`.
Root cause:
Проверка `await expect(...).resolves.toBeUndefined()` семантически слабее, чем `.resolves.not.toThrow()`.
Impact:
Усложняет понимание того, что именно тестируется (отсутствие ошибки).
Evidence:
```typescript
await expect(service.reconcileMirrors()).resolves.toBeUndefined();
```
Recommended fix:
Использовать `await expect(service.reconcileMirrors()).resolves.not.toThrow()`.
Regression test:
Проверить, что тест корректно завершается, когда методы не падают.


---

### Architecture findings

ID: ARCH-01
Priority: P3
Category: Architecture
CWE: CWE-1041 (Use of Redundant Code)
Location:
  `apps/api/src/modules/auth/services/auth-session.service.ts` и `apps/api/src/modules/users/users.service.ts`
Problem:
Сложная логика атомарного обновления сессий и проверки `generation` реализована через inline Lua скрипты внутри сервисов TypeScript.
Root cause:
Бизнес-логика защиты от гонок смешана с кодом.
Impact:
Сложность поддержки. Изменение структуры сессии в Redis требует правки сложных строковых Lua скриптов.
Evidence:
Использование констант с Lua кодом (например, `UPDATE_MIN_GEN_LUA`) в TypeScript-файлах, вызываемых через `this.redisService.eval`.
Recommended fix:
Вынести все Lua скрипты в отдельную директорию/модуль `redis-scripts` и покрыть их изолированными тестами.
Regression test:
Проверить, что тесты `AuthSessionService` проходят при использовании вынесенных скриптов.

---

### CI/CD findings

ID: CI-01
Priority: P2
Category: CI/CD
Location:
  `.github/workflows/ci-api.yml`
Problem:
Команда `pnpm run codegen:check` в CI падает, если сгенерированные файлы отличаются от тех, что в Git.
Root cause:
Отсутствие pre-commit хука для автоматической кодогенерации OpenAPI клиента.
Impact:
Блокировка мержа при обновлении DTO, если разработчик забыл запустить `pnpm run codegen`.
Evidence:
В `package.json` имеется скрипт `codegen:check` (`pnpm run generate:client && git diff --exit-code`), который вызывается в `ci-api.yml`.
Recommended fix:
Настроить pre-commit hook (Husky) или lint-staged для автоматического выполнения `pnpm run codegen` перед коммитом.
Regression test:
Убедиться, что при локальном изменении DTO `git diff` для сгенерированных файлов `packages/api/src/generated` не показывает изменений, а CI успешно проходит.

---

### Recommended remediation order

1. **TST-01**: Немедленно исправить ложноположительные тесты с `.catch(() => undefined)` в `auth.service.spec.ts`. Это P0 задача для обеспечения реальной защиты, так как текущие тесты пропускают регрессии.
2. **SEC-01**: Убрать подавление ошибок при удалении `AuthRevocationTask` и добавить корректный Error Handling.
3. **TST-02**: Уточнить `toThrow()` assertions в `transport.test.ts` и других тестах.
4. **CI-01**: Добавить Husky pre-commit hook для синхронизации OpenAPI.

### Verification plan

- **TST-01**: Закомментировать вызов мока `createSession.mockRejectedValue(...)` в `auth.service.spec.ts` — убедиться, что исправленный тест **падает**, тогда как старый тест с `catch(() => undefined)` проходил бы.
- **SEC-01**: Искусственно сгенерировать ошибку БД при вызове `prisma.authRevocationTask.delete` и убедиться, что система вызывает `logger.warn` или `logger.error`.
- **CI-01**: Выполнить `pnpm run codegen:check` локально и убедиться, что `git diff` пустой.