# S3 Объектное хранилище (MinIO / R2)

Для хранения всех бинарных данных, аватарок пользователей, записей интервью и сгенерированных отчетов используется **единое S3-совместимое хранилище** (бакет `mock-interview-storage`).

> 📖 **Полная документация по S3 и пайплайну обработки изображений:**
> Подробное руководство доступно в корневом документе [**`docs/STORAGE_S3.md`**](../../STORAGE_S3.md).

---

## 1. Краткая схема структуры бакета

```text
mock-interview-storage/
├── avatars/         # [PUBLIC] Аватарки пользователей (WebP, сжатые через sharp)
├── public/          # [PUBLIC] Общие статические ассеты
├── resumes/         # [PRIVATE] Резюме кандидатов (доступ по Presigned URL)
├── recordings/      # [PRIVATE] Видео/аудио записи звонков (Presigned URL)
└── reports/         # [PRIVATE] Итоговые AI-фидбеки и оценки в PDF (Presigned URL)
```

---

## 2. Публичный доступ vs Приватные файлы (Presigned URLs)

1. **Публичные файлы (`avatars/`, `public/`)**:
   - Отдаются напрямую через Nginx / CDN / MinIO без участия бэкенда:
     `http://localhost:9000/mock-interview-storage/avatars/{userId}/{hash}.webp`
2. **Приватные файлы (`resumes/`, `recordings/`, `reports/`)**:
   - Клиент запрашивает ссылку у API -> API проверяет права пользователя -> генерирует временный Presigned URL (TTL 15 минут) через `@aws-sdk/s3-request-presigner`.
