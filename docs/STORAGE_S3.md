# S3 Object Storage Architecture & Integration Guide

Данный документ описывает архитектуру, локальную инфраструктуру (MinIO), спецификацию конфигурации и структуру хранения файлов в проекте **MockInterviewAI**.

---

## 1. Архитектура хранилища

Для хранения всех бинарных и медиафайлов проекта используется **единое S3-совместимое объектное хранилище**:

```
 ┌────────────────┐          ┌──────────────────────┐          ┌────────────────────────┐
 │ Next.js Client │ ───────> │ NestJS API           │ ───────> │ S3 Object Storage      │
 │ (Frontend)     │  Upload  │ - Sharp / Media proc │  Put     │ (MinIO / R2 / AWS S3)  │
 └────────────────┘          │ - Prisma DB metadata │          └────────────────────────┘
         │                   └──────────────────────┘                       │
         │                                                                  │
         ├─────────────────── Direct GET (Public Assets) ───────────────────┤
         │                                                                  │
         └───────────── Presigned GET (Private Files: Resumes/Videos) ──────┘
```

### Преимущества подхода:
- **Единый стандарт (S3 API)**: для локальной разработки используется MinIO, а в продакшене — любое облачное S3 (Cloudflare R2, AWS S3, Yandex Object Storage, Timeweb/Selectel S3) без изменения кода приложения.
- **Универсальность**: один бакет обслуживает все типы контента приложения с разделением по префиксам (каталогам).
- **Разгрузка бэкенда**: API не тратит ресурсы на отдачу тяжелой статики и видеопотоков.
- **Горизонтальное масштабирование**: инстансы API остаются stateless.

---

## 2. Структура бакета и типов данных

Основной бакет по умолчанию: **`mock-interview-storage`** (настраивается через `S3_BUCKET_NAME`).

Хранилище разделено на логические префиксы с разными уровнями доступа:

```
mock-interview-storage/
├── avatars/         # [PUBLIC] Аватарки пользователей (WebP, оптимизированные)
├── public/          # [PUBLIC] Общие публичные ассеты, логотипы, баннеры
├── resumes/         # [PRIVATE] Резюме кандидатов (PDF/DOCX)
├── recordings/      # [PRIVATE] Аудио/видеозаписи проведенных интервью
└── reports/         # [PRIVATE] Сгенерированные AI-отчеты и фидбеки (PDF/JSON)
```

### Спецификация доступа:

| Префикс | Тип доступа | Как отдается клиенту | Пример ключа (Key) |
| :--- | :--- | :--- | :--- |
| `avatars/` | **Public Read** | Прямой URL / CDN | `avatars/{userId}/{hash}.webp` |
| `public/` | **Public Read** | Прямой URL / CDN | `public/assets/sample-problem.png` |
| `resumes/` | **Private** | Временный Presigned URL (TTL 15m) | `resumes/{userId}/{resumeId}.pdf` |
| `recordings/` | **Private** | Временный Presigned URL (TTL 1h) | `recordings/{sessionId}/{trackId}.mp4` |
| `reports/` | **Private** | Временный Presigned URL (TTL 30m) | `reports/{interviewId}/feedback.pdf` |

---

## 3. Локальное окружение (Docker Compose + MinIO)

Локальная инфраструктура монорепозитория развернута в корневом [`docker-compose.yml`](../docker-compose.yml) и включает:
- **`postgres`** (порт `5432`): реляционная база данных PostgreSQL.
- **`redis`** (порт `6379`): кэш, сессии, рейт-лимиты и брокер сообщений.
- **`minio`** (порты `9000` API, `9001` Web Console): S3-совместимое объектное хранилище.
- **`minio-init`**: автосоздание бакета `mock-interview-storage` и настройка публичного доступа к `avatars/` и `public/`.

### Запуск и управление:

```bash
# Запуск всей локальной инфраструктуры (PostgreSQL + Redis + MinIO)
pnpm run infra:up

# Остановка инфраструктуры
pnpm run infra:down
```

### Доступ к MinIO Web Console:
- **URL**: `http://localhost:9001`
- **User (Access Key)**: `minioadmin` (или значение `S3_ACCESS_KEY` из `.env`)
- **Password (Secret Key)**: `minioadmin` (или значение `S3_SECRET_KEY` из `.env`)

---

## 4. Переменные окружения (`.env`)

Конфигурация задается в корневом [`.env.example`](../.env.example):

| Переменная | Описание | Локальное значение (MinIO) | Пример в Production (Cloudflare R2 / AWS) |
| :--- | :--- | :--- | :--- |
| `S3_ENDPOINT` | URL эндпоинта S3 API | `http://localhost:9000` | `https://<account_id>.r2.cloudflarestorage.com` |
| `S3_REGION` | Регион S3 бакета | `us-east-1` | `auto` (для R2) или `eu-central-1` (для AWS) |
| `S3_ACCESS_KEY` | Access Key / Root User | `minioadmin` | `<your-r2-access-key>` |
| `S3_SECRET_KEY` | Secret Key / Root Password | `minioadmin` | `<your-r2-secret-key>` |
| `S3_BUCKET_NAME` | Название бакета | `mock-interview-storage` | `mock-interview-storage-prod` |
| `S3_PUBLIC_URL` | Базовый публичный URL | `http://localhost:9000/mock-interview-storage` | `https://cdn.yourdomain.com` |
| `S3_FORCE_PATH_STYLE` | Path-style адресация (`true` для MinIO) | `true` | `false` (для AWS/R2 virtual-host style) |

---

## 5. Рекомендации по интеграции с Backend (NestJS)

При последующей реализации модулей на бэкенде:

### 1. Зависимости
- `@aws-sdk/client-s3` — базовый клиент S3 v3 (PutObject, GetObject, DeleteObject).
- `@aws-sdk/s3-request-presigner` — генерация временных безопасных ссылок (Presigned URLs) для приватных файлов.
- `sharp` — сжатие, ресайз и конвертация аватарок/картинок.
- `multer` и `@types/multer` — загрузка `multipart/form-data`.

### 2. Сценарии работы
- **Публичные файлы (аватарки)**:
  - API валидирует изображение -> сжимает в WebP через `sharp` -> загружает в `avatars/{userId}/{hash}.webp` -> сохраняет URL в БД.
- **Приватные файлы (резюме, отчеты, записи)**:
  - Клиент запрашивает доступ -> API проверяет JWT и права пользователя на конкретный ресурс -> генерирует короткоживущий `getSignedUrl(s3Client, getObjectCommand, { expiresIn: 900 })` -> клиент скачивает файл напрямую из S3.

---

## 6. Рекомендации по интеграции с Frontend (Next.js)

### Настройка `next.config.js`
Для работы компонента `<Image />` из Next.js с публичными изображениями из MinIO / S3:
```javascript
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/mock-interview-storage/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.yourdomain.com',
        pathname: '/**',
      },
    ],
  },
};
```

---

## 7. Переход в Production

При деплое в продакшен:
1. Создать бакет `mock-interview-storage-prod` в **Cloudflare R2** или **AWS S3** / **Yandex Object Storage**.
2. Сгенерировать S3 API credentials с правами чтения/записи для сервиса.
3. Привязать Custom Domain / CDN для публичной отдачи (`https://cdn.mockinterview.ai`).
4. Настроить правила CORS в бакете при необходимости прямого аплоада с фронтенда.
5. Заполнить переменные `S3_*` в production окружении.
