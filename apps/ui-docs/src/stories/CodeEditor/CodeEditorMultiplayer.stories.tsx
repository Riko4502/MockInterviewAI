import { CodeEditorLazy, getTemplate } from "@packages/editor";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import * as Y from "yjs";

const meta = {
  title: "Editor/Multiplayer",
  component: CodeEditorLazy,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
### **CodeEditor — Yjs CRDT Мультиплеер**

Демонстрация совместной работы в реальном времени на базе **Yjs CRDT** и **Yjs Awareness**:
- **Детерминированный CRDT-мердж**: Все правки синхронизируются через бинарные дельты документа \`Y.Doc\`.
- **Многопользовательские курсоры и селекшены**: Позиции курсоров участников, имена и цвета транслируются через протокол Awareness.
- **Изолированный Undo/Redo**: Локальный \`Y.UndoManager\` отменяет только собственные действия пользователя и не затирает правки соавторов.
`,
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ height: "650px", padding: "16px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeEditorLazy>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Парное программирование (Кандидат и Интервьюер).
 * Два редактора работают с единым документом Y.Doc и обмениваются курсорами через Awareness.
 * Любой ввод в левом окне моментально отображается в правом и наоборот!
 */
export const PairProgramming: Story = {
  render: () => {
    const [session, setSession] = useState<{
      candidateYText: Y.Text;
      interviewerYText: Y.Text;
      candidateAwareness: Awareness;
      interviewerAwareness: Awareness;
    } | null>(null);

    useEffect(() => {
      const candidateDoc = new Y.Doc();
      const candidateYText = candidateDoc.getText("monaco");
      candidateYText.insert(0, getTemplate("typescript", "algorithm"));

      const interviewerDoc = new Y.Doc();
      Y.applyUpdate(interviewerDoc, Y.encodeStateAsUpdate(candidateDoc));
      const interviewerYText = interviewerDoc.getText("monaco");

      const candidateAwareness = new Awareness(candidateDoc);
      const interviewerAwareness = new Awareness(interviewerDoc);

      const syncDocToInterviewer = (update: Uint8Array, origin: unknown) => {
        if (origin !== "interviewer-sync") {
          Y.applyUpdate(interviewerDoc, update, "candidate-sync");
        }
      };
      const syncDocToCandidate = (update: Uint8Array, origin: unknown) => {
        if (origin !== "candidate-sync") {
          Y.applyUpdate(candidateDoc, update, "interviewer-sync");
        }
      };

      candidateDoc.on("update", syncDocToInterviewer);
      interviewerDoc.on("update", syncDocToCandidate);

      candidateAwareness.setLocalStateField("user", {
        name: "Кандидат",
        color: "#3b82f6",
      });
      interviewerAwareness.setLocalStateField("user", {
        name: "Интервьюер (Tech Lead)",
        color: "#a855f7",
      });

      // Начальные позиции курсоров участников для немедленного отображения
      candidateAwareness.setLocalStateField("selection", {
        anchor: Y.createRelativePositionFromTypeIndex(candidateYText, 0),
        head: Y.createRelativePositionFromTypeIndex(candidateYText, 0),
      });
      interviewerAwareness.setLocalStateField("selection", {
        anchor: Y.createRelativePositionFromTypeIndex(interviewerYText, 62),
        head: Y.createRelativePositionFromTypeIndex(interviewerYText, 62),
      });

      const syncCandidateToInterviewer = (
        {
          added,
          updated,
          removed,
        }: {
          added: number[];
          updated: number[];
          removed: number[];
        },
        origin: unknown,
      ) => {
        if (origin === "remote") return;
        const changed = added.concat(updated, removed);
        const update = encodeAwarenessUpdate(candidateAwareness, changed);
        applyAwarenessUpdate(interviewerAwareness, update, "remote");
      };

      const syncInterviewerToCandidate = (
        {
          added,
          updated,
          removed,
        }: {
          added: number[];
          updated: number[];
          removed: number[];
        },
        origin: unknown,
      ) => {
        if (origin === "remote") return;
        const changed = added.concat(updated, removed);
        const update = encodeAwarenessUpdate(interviewerAwareness, changed);
        applyAwarenessUpdate(candidateAwareness, update, "remote");
      };

      candidateAwareness.on("update", syncCandidateToInterviewer);
      interviewerAwareness.on("update", syncInterviewerToCandidate);

      const initCandidate = encodeAwarenessUpdate(candidateAwareness, [
        candidateAwareness.clientID,
      ]);
      applyAwarenessUpdate(interviewerAwareness, initCandidate, "remote");

      const initInterviewer = encodeAwarenessUpdate(interviewerAwareness, [
        interviewerAwareness.clientID,
      ]);
      applyAwarenessUpdate(candidateAwareness, initInterviewer, "remote");

      setSession({
        candidateYText,
        interviewerYText,
        candidateAwareness,
        interviewerAwareness,
      });

      return () => {
        candidateDoc.off("update", syncDocToInterviewer);
        interviewerDoc.off("update", syncDocToCandidate);
        candidateAwareness.off("update", syncCandidateToInterviewer);
        interviewerAwareness.off("update", syncInterviewerToCandidate);
        candidateAwareness.destroy();
        interviewerAwareness.destroy();
        candidateDoc.destroy();
        interviewerDoc.destroy();
      };
    }, []);

    if (!session) {
      return <div style={{ height: "100%" }} />;
    }

    return (
      <div style={{ display: "flex", gap: "16px", height: "100%" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            border: "1px solid #3b82f6",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "#1e293b",
              color: "#3b82f6",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            👤 Окно кандидата (Синий курсор)
          </div>
          <div style={{ flex: 1 }}>
            <CodeEditorLazy
              language="typescript"
              yText={session.candidateYText}
              awareness={session.candidateAwareness}
            />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            border: "1px solid #a855f7",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "#1e293b",
              color: "#a855f7",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            👤 Окно интервьюера (Фиолетовый курсор)
          </div>
          <div style={{ flex: 1 }}>
            <CodeEditorLazy
              language="typescript"
              yText={session.interviewerYText}
              awareness={session.interviewerAwareness}
            />
          </div>
        </div>
      </div>
    );
  },
};

/**
 * Анимированный удаленный соавтор.
 * Имитирует живой набор кода удаленным участником в документе Yjs и трансляцию его курсора.
 */
export const AnimatedRemoteCollaborator: Story = {
  render: () => {
    const [session, setSession] = useState<{
      userYText: Y.Text;
      userAwareness: Awareness;
    } | null>(null);

    useEffect(() => {
      const userDoc = new Y.Doc();
      const userYText = userDoc.getText("monaco");
      userYText.insert(0, getTemplate("python", "algorithm"));

      const remoteDoc = new Y.Doc();
      Y.applyUpdate(remoteDoc, Y.encodeStateAsUpdate(userDoc));
      const remoteYText = remoteDoc.getText("monaco");

      const userAwareness = new Awareness(userDoc);
      const remoteAwareness = new Awareness(remoteDoc);

      const syncRemoteDoc = (update: Uint8Array, origin: unknown) => {
        if (origin !== "user-sync") {
          Y.applyUpdate(userDoc, update, "remote-sync");
        }
      };
      const syncUserDoc = (update: Uint8Array, origin: unknown) => {
        if (origin !== "remote-sync") {
          Y.applyUpdate(remoteDoc, update, "user-sync");
        }
      };

      remoteDoc.on("update", syncRemoteDoc);
      userDoc.on("update", syncUserDoc);

      userAwareness.setLocalStateField("user", {
        name: "Вы (Кандидат)",
        color: "#10b981",
      });
      remoteAwareness.setLocalStateField("user", {
        name: "Интервьюер (live)",
        color: "#f97316",
      });

      const handleRemoteUpdate = (
        {
          added,
          updated,
          removed,
        }: {
          added: number[];
          updated: number[];
          removed: number[];
        },
        origin: unknown,
      ) => {
        if (origin === "remote") return;
        const changed = added.concat(updated, removed);
        const update = encodeAwarenessUpdate(remoteAwareness, changed);
        applyAwarenessUpdate(userAwareness, update, "remote");
      };

      remoteAwareness.on("update", handleRemoteUpdate);

      const baseOffset = 25;
      remoteAwareness.setLocalStateField("selection", {
        anchor: Y.createRelativePositionFromTypeIndex(remoteYText, baseOffset),
        head: Y.createRelativePositionFromTypeIndex(remoteYText, baseOffset),
      });

      const initRemote = encodeAwarenessUpdate(remoteAwareness, [
        remoteAwareness.clientID,
      ]);
      applyAwarenessUpdate(userAwareness, initRemote, "remote");

      // Имитация активности удаленного интервьюера: набор комментария и перемещение курсора
      let step = 0;
      let isPaused = false;
      let loopTimer: ReturnType<typeof setTimeout> | null = null;
      const commentText = "    # Review: time complexity is O(n)\n";

      const interval = setInterval(() => {
        if (isPaused) return;

        if (step < commentText.length) {
          const char = commentText[step];
          const insertPos = baseOffset + step;

          remoteDoc.transact(() => {
            remoteYText.insert(Math.min(insertPos, remoteYText.length), char);
          }, "remote-collaborator");

          const cursorIndex = Math.min(insertPos + 1, remoteYText.length);
          remoteAwareness.setLocalStateField("selection", {
            anchor: Y.createRelativePositionFromTypeIndex(
              remoteYText,
              cursorIndex,
            ),
            head: Y.createRelativePositionFromTypeIndex(
              remoteYText,
              cursorIndex,
            ),
          });

          step++;
        } else {
          isPaused = true;
          // Выделяем набранный комментарий для демонстрации selection
          remoteAwareness.setLocalStateField("selection", {
            anchor: Y.createRelativePositionFromTypeIndex(
              remoteYText,
              baseOffset,
            ),
            head: Y.createRelativePositionFromTypeIndex(
              remoteYText,
              baseOffset + commentText.length,
            ),
          });

          loopTimer = setTimeout(() => {
            // Очищаем комментарий и зацикливаем демонстрацию
            remoteDoc.transact(() => {
              remoteYText.delete(baseOffset, commentText.length);
            }, "remote-collaborator");
            remoteAwareness.setLocalStateField("selection", {
              anchor: Y.createRelativePositionFromTypeIndex(
                remoteYText,
                baseOffset,
              ),
              head: Y.createRelativePositionFromTypeIndex(
                remoteYText,
                baseOffset,
              ),
            });
            step = 0;
            isPaused = false;
          }, 4000);
        }
      }, 200);

      setSession({
        userYText,
        userAwareness,
      });

      return () => {
        clearInterval(interval);
        if (loopTimer) clearTimeout(loopTimer);
        remoteDoc.off("update", syncRemoteDoc);
        userDoc.off("update", syncUserDoc);
        remoteAwareness.off("update", handleRemoteUpdate);
        userAwareness.destroy();
        remoteAwareness.destroy();
        userDoc.destroy();
        remoteDoc.destroy();
      };
    }, []);

    if (!session) {
      return <div style={{ height: "100%" }} />;
    }

    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          border: "1px solid #334155",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "#1e293b",
            color: "#f97316",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          ● Совместная сессия: Интервьюер комментирует решение в реальном
          времени
        </div>
        <div style={{ flex: 1 }}>
          <CodeEditorLazy
            language="python"
            yText={session.userYText}
            awareness={session.userAwareness}
          />
        </div>
      </div>
    );
  },
};
