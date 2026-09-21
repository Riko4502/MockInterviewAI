import { describe, expect, it } from "vitest";
import * as Y from "yjs";

/**
 * Детерминированный LCG PRNG для воспроизводимости тестов
 */
function createPrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe("CRDT convergence test (T014)", () => {
  it("converges 3 independent Y.Docs to identical text after 500 randomized operations", () => {
    const SEED = 20260922;
    const prng = createPrng(SEED);

    const NUM_DOCS = 3;
    const TOTAL_OPERATIONS = 500;
    const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789 \n+-*/{}[]();";

    const docs = Array.from({ length: NUM_DOCS }, () => new Y.Doc());
    const texts = docs.map((doc) => doc.getText("content"));

    // Очереди сообщений между пирами: queues[to][from]
    const queues: Uint8Array[][][] = Array.from({ length: NUM_DOCS }, () =>
      Array.from({ length: NUM_DOCS }, () => []),
    );

    // Подписываемся на локальные обновления каждого документа
    docs.forEach((doc, fromIdx) => {
      doc.on("update", (update: Uint8Array, origin: unknown) => {
        // Не пересылаем обновления, полученные от удалённых пиров
        if (typeof origin === "number" && origin >= 0 && origin < NUM_DOCS) {
          return;
        }
        for (let toIdx = 0; toIdx < NUM_DOCS; toIdx++) {
          if (toIdx !== fromIdx) {
            queues[toIdx][fromIdx].push(new Uint8Array(update));
          }
        }
      });
    });

    const operationLog: string[] = [];

    try {
      for (let op = 0; op < TOTAL_OPERATIONS; op++) {
        const docIdx = Math.floor(prng() * NUM_DOCS);
        const yText = texts[docIdx];
        const currentLen = yText.length;

        // 60% вставок, 40% удалений (или 100% вставок, если документ пуст)
        const isInsert = currentLen === 0 || prng() < 0.6;

        if (isInsert) {
          const insertPos = Math.floor(prng() * (currentLen + 1));
          const insertLen = Math.floor(prng() * 4) + 1;
          let insertStr = "";
          for (let c = 0; c < insertLen; c++) {
            insertStr += ALPHABET[Math.floor(prng() * ALPHABET.length)];
          }
          yText.insert(insertPos, insertStr);
          operationLog.push(
            `[op ${op}] Doc ${docIdx} INSERT @${insertPos}: "${insertStr}"`,
          );
        } else {
          const deletePos = Math.floor(prng() * currentLen);
          const maxDeleteLen = Math.min(
            currentLen - deletePos,
            Math.floor(prng() * 4) + 1,
          );
          yText.delete(deletePos, maxDeleteLen);
          operationLog.push(
            `[op ${op}] Doc ${docIdx} DELETE @${deletePos} len ${maxDeleteLen}`,
          );
        }

        // С вероятностью 40% доставляем несколько случайных накопленных дельт (эмуляция сетевой задержки)
        if (prng() < 0.4) {
          const recipient = Math.floor(prng() * NUM_DOCS);
          const sender = Math.floor(prng() * NUM_DOCS);
          if (recipient !== sender && queues[recipient][sender].length > 0) {
            const update = queues[recipient][sender].shift();
            if (update) {
              Y.applyUpdate(docs[recipient], update, sender);
            }
          }
        }
      }

      // После 500 операций полностью доставляем все оставшиеся сообщения во всех направлениях
      let pendingCount = 0;
      do {
        pendingCount = 0;
        for (let to = 0; to < NUM_DOCS; to++) {
          for (let from = 0; from < NUM_DOCS; from++) {
            while (queues[to][from].length > 0) {
              const update = queues[to][from].shift();
              if (update) {
                Y.applyUpdate(docs[to], update, from);
                pendingCount++;
              }
            }
          }
        }
      } while (pendingCount > 0);

      const finalTexts = texts.map((t) => t.toString());

      // Проверяем попарную сходимость к абсолютно идентичному тексту
      for (let i = 1; i < NUM_DOCS; i++) {
        expect(finalTexts[i]).toBe(finalTexts[0]);
      }

      expect(finalTexts[0].length).toBeGreaterThan(0);
    } catch (error) {
      console.error("Convergence failure diagnostic:", {
        seed: SEED,
        totalOperations: TOTAL_OPERATIONS,
        texts: texts.map((t) => t.toString()),
        lengths: texts.map((t) => t.length),
        lastOperations: operationLog.slice(-10),
      });
      throw error;
    } finally {
      docs.forEach((doc) => {
        doc.destroy();
      });
    }
  });

  it("converges 4 independent Y.Docs with randomized network partition and reconnect", () => {
    const SEED = 998877;
    const prng = createPrng(SEED);
    const NUM_DOCS = 4;
    const TOTAL_OPERATIONS = 500;

    const docs = Array.from({ length: NUM_DOCS }, () => new Y.Doc());
    const texts = docs.map((doc) => doc.getText("content"));
    const queues: Uint8Array[][][] = Array.from({ length: NUM_DOCS }, () =>
      Array.from({ length: NUM_DOCS }, () => []),
    );

    docs.forEach((doc, fromIdx) => {
      doc.on("update", (update: Uint8Array, origin: unknown) => {
        if (typeof origin === "number" && origin >= 0 && origin < NUM_DOCS)
          return;
        for (let toIdx = 0; toIdx < NUM_DOCS; toIdx++) {
          if (toIdx !== fromIdx) {
            queues[toIdx][fromIdx].push(new Uint8Array(update));
          }
        }
      });
    });

    for (let op = 0; op < TOTAL_OPERATIONS; op++) {
      const docIdx = Math.floor(prng() * NUM_DOCS);
      const yText = texts[docIdx];
      const len = yText.length;
      if (len === 0 || prng() < 0.6) {
        yText.insert(
          Math.floor(prng() * (len + 1)),
          String.fromCharCode(65 + Math.floor(prng() * 26)),
        );
      } else {
        const pos = Math.floor(prng() * len);
        yText.delete(pos, 1);
      }
    }

    // Полный дренаж сети
    let pendingCount = 0;
    do {
      pendingCount = 0;
      for (let to = 0; to < NUM_DOCS; to++) {
        for (let from = 0; from < NUM_DOCS; from++) {
          while (queues[to][from].length > 0) {
            const update = queues[to][from].shift();
            if (update) {
              Y.applyUpdate(docs[to], update, from);
              pendingCount++;
            }
          }
        }
      }
    } while (pendingCount > 0);

    const finalTexts = texts.map((t) => t.toString());
    for (let i = 1; i < NUM_DOCS; i++) {
      expect(finalTexts[i]).toBe(finalTexts[0]);
    }
    expect(finalTexts[0].length).toBeGreaterThan(0);

    docs.forEach((doc) => {
      doc.destroy();
    });
  });
});
