#!/usr/bin/env node

/**
 * CLI-скрипт для отправки различных типов SSE-уведомлений в сервис realtime через Redis.
 *
 * Примеры использования:
 *   # Смена типа события:
 *   pnpm sse:send --type notification.new --category INTERVIEW --title "Собеседование" --message "Вас пригласили"
 *   pnpm sse:send --type interview.invite --user user-123
 *   pnpm sse:send --type ai.report.ready --title "Отчет готов" --action-url "/reports/123"
 *
 *   # Быстрые пресеты:
 *   pnpm sse:send --interview
 *   pnpm sse:send --system
 *   pnpm sse:send --message
 *   pnpm sse:send --badge 5
 *   pnpm sse:broadcast --message "Технические работы"
 *
 *   # Интерактивный режим:
 *   pnpm sse:send -i
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Загружаем ioredis из apps/api или корневого node_modules
const require = createRequire(
  path.join(rootDir, "apps", "api", "package.json"),
);
let Redis;
try {
  Redis = require("ioredis");
} catch {
  console.error(
    "❌ Ошибка: пакет ioredis не найден. Убедитесь, что выполнен pnpm install.",
  );
  process.exit(1);
}

// Чтение .env файла
function loadEnv() {
  const envPath = path.join(rootDir, ".env");
  const env = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
  }
  return { ...env, ...process.env };
}

const PRESETS = {
  interview: {
    type: "notification.new",
    category: "INTERVIEW",
    title: "Приглашение на собеседование",
    message: "Вас пригласили на техническое интервью Frontend Senior",
    actionUrl: "/sessions/dev-session-1",
  },
  system: {
    type: "notification.new",
    category: "SYSTEM",
    title: "Системное оповещение",
    message: "Платформа обновлена до версии 2.0. Доступны новые функции.",
    actionUrl: null,
  },
  message: {
    type: "notification.new",
    category: "MESSAGE",
    title: "Новое сообщение",
    message: "Интервьюер оставил комментарий к вашей сессии",
    actionUrl: "/sessions/dev-session-1#chat",
  },
  "ai-report": {
    type: "ai.report.ready",
    category: "SYSTEM",
    title: "AI-отчет готов",
    message: "Анализ сессии интервью успешно завершен. Посмотрите результаты.",
    actionUrl: "/reports/report-dev-1",
  },
  "code-run": {
    type: "code.run.completed",
    category: "SYSTEM",
    title: "Код успешно выполнен",
    message: "Все 12 тестов пройдены успешно за 42мс",
    actionUrl: null,
  },
};

function parseArgs(args) {
  const result = {
    user: "dev-user-1",
    type: "notification.new",
    category: "SYSTEM",
    title: "Тестовое уведомление",
    message: "Это тестовое сообщение для проверки SSE в realtime",
    actionUrl: null,
    broadcast: false,
    raw: null,
    unreadCount: null,
    interactive: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--interactive" || arg === "-i") {
      result.interactive = true;
    } else if (arg === "--broadcast" || arg === "-b") {
      result.broadcast = true;
      result.type = "system.broadcast";
    } else if (arg === "--user" || arg === "-u") {
      result.user = args[++i];
    } else if (arg === "--type" || arg === "-t") {
      result.type = args[++i];
    } else if (arg === "--category" || arg === "-c") {
      result.category = args[++i].toUpperCase();
    } else if (arg === "--title") {
      result.title = args[++i];
    } else if (arg === "--message" || arg === "-m") {
      result.message = args[++i];
    } else if (arg === "--action-url" || arg === "-a") {
      result.actionUrl = args[++i];
    } else if (arg === "--raw") {
      result.raw = args[++i];
    } else if (arg === "--badge") {
      result.type = "notification.badge";
      result.unreadCount = parseInt(args[++i], 10) || 1;
    } else if (arg === "--interview") {
      Object.assign(result, PRESETS.interview);
    } else if (arg === "--system") {
      Object.assign(result, PRESETS.system);
    } else if (arg === "--message-preset") {
      Object.assign(result, PRESETS.message);
    } else if (arg === "--ai-report") {
      Object.assign(result, PRESETS["ai-report"]);
    } else if (arg === "--code-run") {
      Object.assign(result, PRESETS["code-run"]);
    } else if (arg === "--preset" || arg === "-p") {
      const presetName = args[++i];
      if (PRESETS[presetName]) {
        Object.assign(result, PRESETS[presetName]);
      } else {
        console.warn(
          `⚠️ Неизвестный пресет "${presetName}". Доступные: ${Object.keys(PRESETS).join(", ")}`,
        );
      }
    }
  }

  return result;
}

function printHelp() {
  console.log(`
🔔 Утилита отправки SSE-уведомлений в Realtime (через Redis)

Использование:
  pnpm sse:send [опции]
  pnpm sse:broadcast [опции]
  node scripts/send-sse.mjs [опции]

Опции:
  --user, -u <id>          ID пользователя (по умолчанию: dev-user-1)
  --type, -t <type>        Тип события SSE:
                             notification.new   (новое уведомление в шторку)
                             notification.badge (счетчик непрочитанных)
                             system.broadcast   (общесистемный алерт)
                             interview.invite   (приглашение на интервью)
                             ai.report.ready    (готовность AI отчета)
                             code.run.completed (результат запуска кода)
                             ...любой произвольный тип
  --category, -c <cat>     Категория: SYSTEM | INTERVIEW | MESSAGE (или info, warning, error, success)
  --title <title>          Заголовок уведомления
  --message, -m <text>     Текст сообщения
  --action-url, -a <url>   Ссылка для перехода при клике (напр. /sessions/123)
  --badge <count>          Отправить обновление счетчика непрочитанных (notification.badge)
  --broadcast, -b          Отправить как общесистемный бродкаст (Redis Pub/Sub)
  --raw <json>             Передать собственный JSON payload
  --interactive, -i        Запустить интерактивный пошаговый мастер
  --help, -h               Показать эту справку

Пресеты (быстрые шаблоны):
  --interview              Шаблон приглашения на интервью (INTERVIEW)
  --system                 Шаблон системного уведомления (SYSTEM)
  --message-preset         Шаблон текстового сообщения (MESSAGE)
  --ai-report              Шаблон готовности AI-отчета (ai.report.ready)
  --code-run               Шаблон завершения тестов (code.run.completed)

Примеры:
  # 1. Смена типа события на кастомный:
  pnpm sse:send --type interview.invite --user user-123 --title "Инвайт" --action-url "/sessions/abc"

  # 2. Уведомление с категорией INTERVIEW:
  pnpm sse:send --category INTERVIEW --title "Собеседование началось" --message "Интервьюер подключился"

  # 3. Быстрый пресет:
  pnpm sse:send --interview --user user-123

  # 4. Обновление счетчика бейджа:
  pnpm sse:send --badge 5 --user user-123

  # 5. Общесистемный бродкаст:
  pnpm sse:broadcast --message "Технические работы через 10 минут"

  # 6. Интерактивный режим:
  pnpm sse:send -i
`);
}

async function runInteractive(args) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n🧙 Интерактивный мастер отправки SSE-уведомления:\n");

  const mode = await rl.question(
    "1. Тип отправки ([1] Персональное в стрим юзера, [2] Бродкаст всем): ",
  );
  if (mode.trim() === "2") {
    args.broadcast = true;
    args.type = "system.broadcast";
    args.message =
      (await rl.question(
        `2. Текст оповещения (по умолч.: "${args.message}"): `,
      )) || args.message;
    rl.close();
    return;
  }

  args.user =
    (await rl.question(`2. ID пользователя (по умолч.: "${args.user}"): `)) ||
    args.user;

  console.log("\nДоступные типы событий:");
  console.log("  [1] notification.new (стандартное уведомление в шторку)");
  console.log("  [2] notification.badge (обновить счетчик на колокольчике)");
  console.log("  [3] interview.invite (приглашение в комнату)");
  console.log("  [4] ai.report.ready (AI отчет готов)");
  console.log("  [5] Ввести свой кастомный тип");

  const typeChoice = await rl.question("3. Выберите тип [1-5]: ");
  switch (typeChoice.trim()) {
    case "2": {
      args.type = "notification.badge";
      const count = await rl.question("   Количество непрочитанных [1]: ");
      args.unreadCount = parseInt(count, 10) || 1;
      rl.close();
      return;
    }
    case "3":
      args.type = "interview.invite";
      args.category = "INTERVIEW";
      break;
    case "4":
      args.type = "ai.report.ready";
      args.category = "SYSTEM";
      break;
    case "5": {
      const customType = await rl.question("   Введите имя события (type): ");
      if (customType.trim()) args.type = customType.trim();
      break;
    }
    default:
      args.type = "notification.new";
      break;
  }

  const category = await rl.question(
    `4. Категория ([1] SYSTEM, [2] INTERVIEW, [3] MESSAGE): `,
  );
  if (category.trim() === "2") args.category = "INTERVIEW";
  else if (category.trim() === "3") args.category = "MESSAGE";
  else if (category.trim() === "1") args.category = "SYSTEM";

  args.title =
    (await rl.question(`5. Заголовок (по умолч.: "${args.title}"): `)) ||
    args.title;
  args.message =
    (await rl.question(`6. Сообщение (по умолч.: "${args.message}"): `)) ||
    args.message;
  args.actionUrl =
    (await rl.question(
      "7. Ссылка действия actionUrl (например /sessions/123, опционально): ",
    )) || null;

  rl.close();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.interactive) {
    await runInteractive(args);
  }

  const env = loadEnv();
  const redisHost = env.REDIS_HOST || "localhost";
  const redisPort = parseInt(env.REDIS_PORT || "6379", 10);
  const redisPassword = env.REDIS_PASSWORD || undefined;

  const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    connectTimeout: 3000,
  });

  try {
    await redis.connect();
  } catch (err) {
    console.error(
      `❌ Не удалось подключиться к Redis (${redisHost}:${redisPort}): ${err.message}`,
    );
    console.error(
      "💡 Убедитесь, что запущен Docker контейнер Redis: pnpm infra:up",
    );
    process.exit(1);
  }

  const now = new Date().toISOString();

  let payloadObj;
  if (args.raw) {
    try {
      payloadObj = JSON.parse(args.raw);
    } catch {
      console.error("❌ Невалидный JSON в --raw");
      process.exit(1);
    }
  } else if (args.type === "notification.badge") {
    payloadObj = {
      unreadCount: args.unreadCount !== null ? args.unreadCount : 1,
    };
  } else {
    payloadObj = {
      id: `ntf_dev_${Date.now()}`,
      category: args.category,
      title: args.title,
      message: args.message,
      actionUrl: args.actionUrl,
      createdAt: now,
      read: false,
    };
  }

  try {
    if (args.broadcast) {
      // Публикация в Pub/Sub канал notifications:broadcast
      const channel = "notifications:broadcast";
      const broadcastMsg = JSON.stringify({
        type: args.type,
        timestamp: now,
        payload: payloadObj,
      });

      const receivers = await redis.publish(channel, broadcastMsg);

      console.log("\n📢 [SSE BROADCAST ОТПРАВЛЕН В REDIS PUB/SUB]");
      console.log(`  Канал:          ${channel}`);
      console.log(`  Тип события:    ${args.type}`);
      console.log(`  Подписчиков:    ${receivers} активных нод`);
      console.log(`  Payload:        ${JSON.stringify(payloadObj, null, 2)}\n`);
    } else {
      // Публикация в Redis Stream пользователя user:{userId}:notifications
      const streamKey = `user:${args.user}:notifications`;
      const payloadStr = JSON.stringify(payloadObj);

      const streamId = await redis.xadd(
        streamKey,
        "MAXLEN",
        "~",
        "100",
        "*",
        "type",
        args.type,
        "payload",
        payloadStr,
        "timestamp",
        now,
      );

      // Продлеваем TTL стрима (7 дней)
      await redis.expire(streamKey, 7 * 24 * 60 * 60);

      console.log("\n✅ [SSE УВЕДОМЛЕНИЕ ОТПРАВЛЕНО В REDIS STREAM]");
      console.log(`  Стрим:          ${streamKey}`);
      console.log(`  Stream ID:      ${streamId}`);
      console.log(`  User ID:        ${args.user}`);
      console.log(`  Тип события:    ${args.type}`);
      console.log(`  Категория:      ${args.category || "-"}`);
      console.log(`  Payload:        ${JSON.stringify(payloadObj, null, 2)}\n`);
    }
  } catch (err) {
    console.error(`❌ Ошибка при отправке в Redis: ${err.message}`);
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}

main();
