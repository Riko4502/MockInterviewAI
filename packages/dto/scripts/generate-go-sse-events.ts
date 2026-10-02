/**
 * Генератор Go-констант SSE-событий из словаря `src/realtime/sse-event.dto.ts`
 * (ADR-004:135-144).
 *
 * Формат задаёт ADR, место и способ запуска — этот файл. Причины именно такой
 * формы:
 *
 * * Генератор живёт рядом с источником правды. Словарь не может быть изменён
 *   без возможности перегенерировать Go-константы, поэтому знание о формате Go
 *   вывода не спрятано в `apps/realtime`.
 * * Чтение TypeScript выполняется рантаймом (`tsx`), а не разбором исходника:
 *   генератор обязан падать при расхождении схем, а не пропускать неизвестные
 *   поля, — значит он работает с реальными значениями словаря, а не с текстом.
 * * Результат коммитится. Иначе `go build` перестал бы быть воспроизводимым
 *   без Node, а CI — единственным местом, где расхождение видно.
 *
 * Генерация идемпотентна: файл перезаписывается только при изменении содержимого,
 * иначе `git diff` в CI шумел бы на каждом запуске.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type SseEventType,
  sseEventDescriptions,
  sseEventPayloadSchemas,
  sseEventTypes,
  sseSeveritySchema,
} from "../src/realtime/sse-event.dto";

const GENERATED_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "apps",
  "realtime",
  "internal",
  "sse",
  "events_gen.go",
);

/**
 * Аббревиатуры, которые Go пишет прописными: `ai.report_ready` →
 * `EventAIReportReady`, а не `EventAiReportReady`.
 *
 * Это соглашение об именах в Go, а не формат провода, поэтому словарь о нём не
 * знает и хранить его там не должен. Список исчерпывающий намеренно: сегмент
 * события, не попавший в таблицу, поднимается как есть, и новая аббревиатура
 * обнаружится ревью, а не молчаливым расхождением с типом `AIReportReadyPayload`
 * в самом словаре.
 */
const GO_INITIALISMS: Record<string, string> = {
  ai: "AI",
  http: "HTTP",
  id: "ID",
  sse: "SSE",
  url: "URL",
};

/**
 * Имя Go-константы из имени события: `code_runner.status` →
 * `EventCodeRunnerStatus`.
 *
 * Имя выводится, а не хранится в словаре: словарь описывает провод, а не
 * соглашения об именах в Go, и второе поле с именем константы разошлось бы с
 * первым при переименовании события.
 */
function goConstantName(type: SseEventType): string {
  const segments = type
    .split(/[._]/)
    .filter((segment) => segment.length > 0)
    .map(
      (segment) =>
        GO_INITIALISMS[segment] ??
        segment.charAt(0).toUpperCase() + segment.slice(1),
    );

  if (segments.length === 0) {
    throw new Error(`Event type "${type}" has no nameable segments`);
  }

  return `Event${segments.join("")}`;
}

/** Имя Go-константы severity: `warning` → `SeverityWarning`. */
function goSeverityConstantName(severity: string): string {
  return `Severity${severity.charAt(0).toUpperCase()}${severity.slice(1)}`;
}

/**
 * Проверка словаря перед генерацией.
 *
 * `satisfies` в TypeScript ловит расхождение на этапе `typecheck`, но не на
 * этапе запуска генератора, а CI обязан падать на устаревшем сгенерированном
 * файле. Падение здесь означает, что словарь и карты разошлись, и молча
 * генерировать неполный набор констант нельзя.
 */
function assertDictionaryConsistent(): void {
  const types = new Set<string>(sseEventTypes);
  const described = Object.keys(sseEventDescriptions);
  const withPayload = Object.keys(sseEventPayloadSchemas);

  const missingDescriptions = [...types].filter(
    (type) => !described.includes(type),
  );
  const missingPayloads = [...types].filter(
    (type) => !withPayload.includes(type),
  );
  const extraDescriptions = described.filter((type) => !types.has(type));
  const extraPayloads = withPayload.filter((type) => !types.has(type));

  if (
    missingDescriptions.length > 0 ||
    missingPayloads.length > 0 ||
    extraDescriptions.length > 0 ||
    extraPayloads.length > 0
  ) {
    throw new Error(
      [
        "SSE dictionary is inconsistent.",
        missingDescriptions.length > 0
          ? `  no description: ${missingDescriptions.join(", ")}`
          : "",
        missingPayloads.length > 0
          ? `  no payload schema: ${missingPayloads.join(", ")}`
          : "",
        extraDescriptions.length > 0
          ? `  description of an unknown event: ${extraDescriptions.join(", ")}`
          : "",
        extraPayloads.length > 0
          ? `  payload schema of an unknown event: ${extraPayloads.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const duplicates = sseEventTypes.filter(
    (type, index) => sseEventTypes.indexOf(type) !== index,
  );
  if (duplicates.length > 0) {
    throw new Error(`Duplicate event types: ${duplicates.join(", ")}`);
  }

  const duplicateConstants = sseEventTypes
    .map(goConstantName)
    .filter((name, index, all) => all.indexOf(name) !== index);
  if (duplicateConstants.length > 0) {
    throw new Error(
      `Event types collapse into the same Go constant: ${duplicateConstants.join(", ")}`,
    );
  }
}

function renderGoFile(): string {
  const eventConstants = sseEventTypes
    .map((type) => {
      const description = sseEventDescriptions[type];

      return [
        `\t// ${goConstantName(type)} ${description}.`,
        `\t${goConstantName(type)} EventType = "${type}"`,
      ].join("\n");
    })
    .join("\n\n");

  const severityNames = sseSeveritySchema.options.map(goSeverityConstantName);
  const severityWidth = Math.max(...severityNames.map((name) => name.length));
  const severityConstants = sseSeveritySchema.options
    .map(
      (severity, index) =>
        `\t${severityNames[index].padEnd(severityWidth)} Severity = "${severity}"`,
    )
    .join("\n");

  return `// Code generated by packages/dto/scripts/generate-go-sse-events.ts. DO NOT EDIT.
//
// Источник правды: packages/dto/src/realtime/sse-event.dto.ts (ADR-004:86).
// Правка вручную затрётся следующим запуском генератора, а CI-проверка
// актуальности файла упадёт на расхождении.

package sse

// EventType — имя кадра в глобальном SSE-потоке уведомлений.
type EventType string

const (
${eventConstants}
)

// Severity — визуальная severity уведомления для отрисовки.
//
// Отдельная от NotificationType сущность: NotificationType остаётся
// доменным перечислением из БД (SYSTEM | INTERVIEW | MESSAGE) и приходит в
// payload в поле category, тогда как severity описывает вид уведомления и
// приходит в поле severity (ADR-004:87).
type Severity string

const (
${severityConstants}
)
`;
}

async function main(): Promise<void> {
  assertDictionaryConsistent();

  const generated = renderGoFile();
  const current = await readFile(GENERATED_PATH, "utf8").catch(() => null);

  if (current === generated) {
    return;
  }

  await mkdir(path.dirname(GENERATED_PATH), { recursive: true });
  await writeFile(GENERATED_PATH, generated, "utf8");

  console.log(
    `Generated ${path.relative(process.cwd(), GENERATED_PATH)} from the SSE dictionary`,
  );
}

await main();
