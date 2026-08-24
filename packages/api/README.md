# @packages/api

Сгенерированные OpenAPI-артефакты API Mock Interview AI (§63 SPEC.md).

## Содержимое

- `openapi.yaml` — OpenAPI 3.0 в YAML
- `openapi.json` — OpenAPI 3.0 в JSON

Оба файла **генерируются** из исходников (`apps/api`) и коммитятся, чтобы
frontend мог типизировать контракт без запуска backend'а.

## Регенерация

```bash
pnpm generate:api          # корневой скрипт
# или
pnpm --filter api generate:openapi
```

PostgreSQL и Redis не требуются — сервисы замещаются заглушками (§62 SPEC.md).

## Использование

```ts
import openapi from "@packages/api/openapi.json";
```

Контракт описан также в `docs/frontend/data/api-contracts.md`.
