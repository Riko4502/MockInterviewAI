#!/usr/bin/env node

/**
 * CLI-скрипт для отправки различных типов SSE-уведомлений в сервис realtime через Redis.
 *
 * Имена событий, значения `category` и `severity`, а также форма payload'а
 * берутся из общего словаря `@packages/dto` — того же, которым пользуются
 * `apps/api` и клиент. Своих перечислений у скрипта нет: `apps/realtime`
 * payload не декодирует, поэтому расхождение со словарём уехало бы в браузер
 * как валидный кадр (ADR-004:86-87).
 *
 * Примеры использования:
 *   # Персональное уведомление в шторку:
 *   pnpm sse:send --type notification.new --category INTERVIEW --title "Собеседование" --message "Вас пригласили"
 *   pnpm sse:send --category INTERVIEW --severity warning --title "Собеседование" --message "Вас пригласили"
 *   pnpm sse:send --user user-123 --raw '{"reason":"password_reset"}' --type auth.revoked
 *
 *   # Быстрые пресеты:
 *   pnpm sse:send --interview
 *   pnpm sse:send --system
 *   pnpm sse:send --message-preset
 *   pnpm sse:send --badge 5
 *   pnpm sse:broadcast --severity warning --message "Технические работы"
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

// Словарь событий — тот же, что у apps/api и клиента. Резолвится из пакета
// @packages/dto, поэтому требует его сборки (pnpm build:dto).
const requireFromDto = createRequire(
  path.join(rootDir, "packages", "dto", "package.json"),
);
let dictionary;
try {
  dictionary = requireFromDto("@packages/dto");
} catch {
  console.error(
    "❌ Ошибка: не удалось загрузить словарь событий из @packages/dto.",
  );
  console.error("💡 Соберите пакет: pnpm build:dto");
  process.exit(1);
}

const EVENT_TYPES = dictionary.sseEventTypes;
const SEVERITIES = dictionary.sseSeveritySchema.options;
const CATEGORIES = dictionary.notificationTypeSchema.options;

/**
 * Типы, payload которых скрипт умеет собрать из флагов.
 *
 * Остальные события требуют `--raw`: их payload состоит из доменных данных
 * (идентификатор сессии, результаты прогона), которых у CLI нет, и подстановка
 * туда формы `notification.new` отправляла бы в поток кадр, не соответствующий
 * словарю.
 */
const BUILDABLE_TYPES = [
  "notification.new",
  "notification.badge",
  "system.broadcast",
];

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
};

// Проверка на локальный или внутренний адрес хоста (Docker, Render, k8s, RFC 1918)
function isLocalOrInternalHost(host) {
  if (!host) return true;
  const normalized = host.toLowerCase().trim();
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "redis" ||
    normalized === "mock-interview-redis" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".docker.internal") ||
    !normalized.includes(".")
  ) {
    return true;
  }

  // Проверка приватных диапазонов IPv4 (RFC 1918 и loopback)
  const ipv4Match = normalized.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }

  return false;
}

function parseArgs(args) {
  const result = {
    user: "dev-user-1",
    type: "notification.new",
    category: "SYSTEM",
    severity: null,
    title: "Тестовое уведомление",
    message: "Это тестовое сообщение для проверки SSE в realtime",
    actionUrl: null,
    broadcast: false,
    raw: null,
    unreadCount: null,
    tls: false,
    insecure: false,
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
    } else if (arg === "--severity" || arg === "-s") {
      result.severity = args[++i].toLowerCase();
    } else if (arg === "--title") {
      result.title = args[++i];
    } else if (arg === "--message" || arg === "-m") {
      result.message = args[++i];
    } else if (arg === "--action-url" || arg === "-a") {
      result.actionUrl = args[++i];
    } else if (arg === "--raw") {
      result.raw = args[++i];
    } else if (arg === "--tls") {
      result.tls = true;
    } else if (arg === "--insecure") {
      result.insecure = true;
    } else if (arg === "--badge") {
      result.type = "notification.badge";
      result.unreadCount = parseInt(args[++i], 10) || 1;
    } else if (arg === "--interview") {
      Object.assign(result, PRESETS.interview);
    } else if (arg === "--system") {
      Object.assign(result, PRESETS.system);
    } else if (arg === "--message-preset") {
      Object.assign(result, PRESETS.message);
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
  --type, -t <type>        Тип события SSE (обязателен в словаре @packages/dto):
                             ${EVENT_TYPES.join(" ")}
                             Типы вне этого списка отклоняются: apps/realtime
                             payload не проверяет, и кадр с несуществующим именем
                             уехал бы в браузер как валидный.
  --category, -c <cat>     Доменный тип уведомления из БД: ${CATEGORIES.join(" | ")}
  --severity, -s <sev>     Визуальная severity: ${SEVERITIES.join(" | ")}
                             (для system.broadcast обязательна, по умолчанию info)
  --title <title>          Заголовок уведомления
  --message, -m <text>     Текст сообщения
  --action-url, -a <url>   Ссылка для перехода при клике (напр. /sessions/123)
  --badge <count>          Отправить обновление счетчика непрочитанных (notification.badge)
  --broadcast, -b          Отправить как общесистемный бродкаст (Redis Pub/Sub)
  --tls                    Использовать TLS-шифрование для подключения к Redis
  --insecure               Разрешить незашифрованное подключение к внешнему Redis (не рекомендуется)
  --raw <json>             Передать собственный JSON payload (обязателен для
                             остальных типов событий)
  --interactive, -i        Запустить интерактивный пошаговый мастер
  --help, -h               Показать эту справку

Пресеты (быстрые шаблоны):
  --interview              Шаблон приглашения на интервью (INTERVIEW)
  --system                 Шаблон системного уведомления (SYSTEM)
  --message-preset         Шаблон текстового сообщения (MESSAGE)

Примеры:
  # 1. Уведомление в шторку с категорией и severity:
  pnpm sse:send --category INTERVIEW --severity warning --title "Собеседование началось" --message "Интервьюер подключился"

  # 2. Быстрый пресет:
  pnpm sse:send --interview --user user-123

  # 3. Обновление счетчика бейджа:
  pnpm sse:send --badge 5 --user user-123

  # 4. Общесистемный бродкаст:
  pnpm sse:broadcast --severity warning --message "Технические работы через 10 минут"

  # 5. Событие вне набора флагов — только со своим payload:
  pnpm sse:send --type auth.revoked --raw '{"reason":"password_reset"}' --user user-123

  # 6. Подключение к удаленному защищенному Redis с TLS:
  pnpm sse:send --tls --user user-123 --interview

  # 7. Интерактивный режим:
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
  console.log(
    "  [3] Ввести другой тип из словаря (потребует --raw на следующем шаге)",
  );
  console.log(
    `     остальные: ${EVENT_TYPES.filter((type) => !BUILDABLE_TYPES.includes(type)).join(", ")}`,
  );

  const typeChoice = await rl.question("3. Выберите тип [1-3]: ");
  switch (typeChoice.trim()) {
    case "2": {
      args.type = "notification.badge";
      const count = await rl.question("   Количество непрочитанных [1]: ");
      args.unreadCount = parseInt(count, 10) || 1;
      rl.close();
      return;
    }
    case "3": {
      const customType = await rl.question("   Введите имя события (type): ");
      if (customType.trim()) args.type = customType.trim();
      if (!args.raw && !BUILDABLE_TYPES.includes(args.type)) {
        args.raw = await rl.question("   Введите payload (JSON): ");
      }
      if (args.raw) {
        rl.close();
        return;
      }
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

  const severity = await rl.question(
    `5. Severity ([1] info, [2] success, [3] warning, [4] error, [Enter] — не задавать): `,
  );
  const severityByChoice = {
    1: "info",
    2: "success",
    3: "warning",
    4: "error",
  };
  if (severityByChoice[severity.trim()]) {
    args.severity = severityByChoice[severity.trim()];
  }

  args.title =
    (await rl.question(`6. Заголовок (по умолч.: "${args.title}"): `)) ||
    args.title;
  args.message =
    (await rl.question(`7. Сообщение (по умолч.: "${args.message}"): `)) ||
    args.message;
  args.actionUrl =
    (await rl.question(
      "8. Ссылка действия actionUrl (например /sessions/123, опционально): ",
    )) || null;

  rl.close();
}

/**
 * Проверка флагов по словарю — до подключения к Redis.
 *
 * Ошибка в имени типа или в значении перечисления иначе уехала бы в поток как
 * валидный кадр: `apps/realtime` передаёт payload как `json.RawMessage` и не
 * сверяет ни имя события, ни его форму.
 */
function validateArgs(args) {
  if (!EVENT_TYPES.includes(args.type)) {
    console.error(`❌ Неизвестный тип события "${args.type}".`);
    console.error(`   Допустимые типы: ${EVENT_TYPES.join(", ")}`);
    process.exit(1);
  }

  if (!CATEGORIES.includes(args.category)) {
    console.error(`❌ Неизвестная категория "${args.category}".`);
    console.error(`   Допустимые категории: ${CATEGORIES.join(", ")}`);
    process.exit(1);
  }

  if (args.severity !== null && !SEVERITIES.includes(args.severity)) {
    console.error(`❌ Неизвестная severity "${args.severity}".`);
    console.error(`   Допустимые значения: ${SEVERITIES.join(", ")}`);
    process.exit(1);
  }

  if (!args.raw && !BUILDABLE_TYPES.includes(args.type)) {
    console.error(
      `❌ Событие "${args.type}" нельзя собрать из флагов: его payload состоит из доменных данных.`,
    );
    console.error(`   Передайте payload флагом --raw, например:`);
    console.error(
      `   pnpm sse:send --type ${args.type} --raw '{"...":"..."}' --user <id>`,
    );
    process.exit(1);
  }
}

/**
 * Сборка payload по словарю события.
 *
 * Финальная проверка идёт через ту же функцию `parseSseEventPayload`, которой
 * пользуется `apps/api`, поэтому форма кадра у CLI и у приложения одна.
 */
function buildPayload(args, now) {
  let payload;

  if (args.raw) {
    try {
      payload = JSON.parse(args.raw);
    } catch {
      console.error("❌ Невалидный JSON в --raw");
      process.exit(1);
    }
  } else if (args.type === "notification.badge") {
    payload = { unreadCount: args.unreadCount !== null ? args.unreadCount : 1 };
  } else if (args.type === "system.broadcast") {
    payload = {
      severity: args.severity ?? "info",
      message: args.message,
    };
  } else {
    payload = {
      id: `ntf_dev_${Date.now()}`,
      category: args.category,
      ...(args.severity ? { severity: args.severity } : {}),
      title: args.title,
      message: args.message,
      actionUrl: args.actionUrl,
      createdAt: now,
      read: false,
    };
  }

  try {
    return dictionary.parseSseEventPayload(args.type, payload);
  } catch (error) {
    console.error(
      `❌ Payload не соответствует словарю события "${args.type}": ${error.message}`,
    );
    process.exit(1);
  }
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

  validateArgs(args);

  // Payload собирается и проверяется по словарю до подключения к Redis:
  // ошибка в форме кадра не должна требовать поднятого Redis.
  const now = new Date().toISOString();
  const payloadObj = buildPayload(args, now);

  const env = loadEnv();
  let redisHost = env.REDIS_HOST || "localhost";
  let redisPort = parseInt(env.REDIS_PORT || "6379", 10);
  let redisPassword = env.REDIS_PASSWORD || undefined;
  let useTls = args.tls || env.REDIS_TLS === "true" || env.REDIS_TLS === "1";

  if (env.REDIS_URL) {
    try {
      const parsedUrl = new URL(env.REDIS_URL);
      if (parsedUrl.protocol === "rediss:") {
        useTls = true;
      }
      if (parsedUrl.hostname) {
        redisHost = parsedUrl.hostname;
      }
      if (parsedUrl.port) {
        redisPort = parseInt(parsedUrl.port, 10);
      }
      if (parsedUrl.password) {
        redisPassword = decodeURIComponent(parsedUrl.password);
      }
    } catch {
      // Игнорируем ошибку парсинга некорректного REDIS_URL
    }
  }

  const isInternal = isLocalOrInternalHost(redisHost);

  if (
    !isInternal &&
    !useTls &&
    !args.insecure &&
    env.ALLOW_INSECURE_REDIS !== "true"
  ) {
    console.error(
      `\n❌ Ошибка безопасности (CWE-319: Cleartext Transmission of Sensitive Information):`,
    );
    console.error(
      `  Попытка незашифрованного подключения к удалённому Redis хосту (значение скрыто).`,
    );
    console.error(
      `  Передача пароля и SSE payload через открытую сеть без TLS запрещена.`,
    );
    console.error(`\n💡 Решение:`);
    console.error(
      `  1. Используйте флаг --tls или переменную REDIS_TLS=true (или схему rediss://).`,
    );
    console.error(
      `  2. Для локального/внутреннего Docker подключения используйте localhost или внутреннюю сеть.`,
    );
    console.error(
      `  3. Для принудительного отключения проверки: флаг --insecure (не рекомендуется).\n`,
    );
    process.exit(1);
  }

  const redisOptions = {
    host: redisHost,
    port: redisPort,
    password: redisPassword || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    connectTimeout: 3000,
  };

  if (useTls) {
    redisOptions.tls = {
      rejectUnauthorized: env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false",
    };
  }

  const redis = new Redis(redisOptions);

  try {
    await redis.connect();
  } catch (err) {
    console.error(`❌ Не удалось подключиться к Redis: ${err.message}`);
    console.error(
      "💡 Убедитесь, что запущен Docker контейнер Redis: pnpm infra:up",
    );
    process.exit(1);
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
      console.log(`  Severity:       ${args.severity || "-"}`);
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
