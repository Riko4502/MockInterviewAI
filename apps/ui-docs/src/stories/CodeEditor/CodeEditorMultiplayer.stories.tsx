import { CodeEditorLazy, getTemplate } from "@packages/editor";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useMemo, useState } from "react";
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
    const [yDoc] = useState(() => {
      const doc = new Y.Doc();
      const text = doc.getText("monaco");
      text.insert(0, getTemplate("typescript", "algorithm"));
      return doc;
    });

    const yText = useMemo(() => yDoc.getText("monaco"), [yDoc]);

    const [candidateAwareness] = useState(() => new Awareness(yDoc));
    const [interviewerAwareness] = useState(() => new Awareness(yDoc));

    useEffect(() => {
      candidateAwareness.setLocalStateField("user", {
        name: "Кандидат",
        color: "#3b82f6",
      });
      interviewerAwareness.setLocalStateField("user", {
        name: "Интервьюер (Tech Lead)",
        color: "#a855f7",
      });

      const syncCandidateToInterviewer = ({
        added,
        updated,
        removed,
      }: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        const changed = added.concat(updated, removed);
        const update = encodeAwarenessUpdate(candidateAwareness, changed);
        applyAwarenessUpdate(interviewerAwareness, update, "remote");
      };

      const syncInterviewerToCandidate = ({
        added,
        updated,
        removed,
      }: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        const changed = added.concat(updated, removed);
        const update = encodeAwarenessUpdate(interviewerAwareness, changed);
        applyAwarenessUpdate(candidateAwareness, update, "remote");
      };

      candidateAwareness.on("update", syncCandidateToInterviewer);
      interviewerAwareness.on("update", syncInterviewerToCandidate);

      return () => {
        candidateAwareness.off("update", syncCandidateToInterviewer);
        interviewerAwareness.off("update", syncInterviewerToCandidate);
      };
    }, [candidateAwareness, interviewerAwareness]);

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
              yText={yText}
              awareness={candidateAwareness}
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
              yText={yText}
              awareness={interviewerAwareness}
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
    const [yDoc] = useState(() => {
      const doc = new Y.Doc();
      const text = doc.getText("monaco");
      text.insert(0, getTemplate("python", "algorithm"));
      return doc;
    });

    const yText = useMemo(() => yDoc.getText("monaco"), [yDoc]);

    const [userAwareness] = useState(() => new Awareness(yDoc));
    const [remoteAwareness] = useState(() => new Awareness(yDoc));

    useEffect(() => {
      userAwareness.setLocalStateField("user", {
        name: "Вы (Кандидат)",
        color: "#10b981",
      });
      remoteAwareness.setLocalStateField("user", {
        name: "Интервьюер (live)",
        color: "#f97316",
      });

      const handleRemoteUpdate = ({
        added,
        updated,
        removed,
      }: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        const changed = added.concat(updated, removed);
        const update = encodeAwarenessUpdate(remoteAwareness, changed);
        applyAwarenessUpdate(userAwareness, update, "remote");
      };

      remoteAwareness.on("update", handleRemoteUpdate);

      // Имитация активности удаленного интервьюера: добавление комментария и перемещение курсора
      let step = 0;
      const commentText = "  # Review: complexity is O(n)\n";
      const interval = setInterval(() => {
        if (step < commentText.length) {
          yDoc.transact(() => {
            const insertPos = Math.min(25 + step, yText.length);
            yText.insert(insertPos, commentText[step]);
          }, "remote-collaborator");
          step++;
        }
      }, 300);

      return () => {
        clearInterval(interval);
        remoteAwareness.off("update", handleRemoteUpdate);
      };
    }, [yDoc, yText, userAwareness, remoteAwareness]);

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
            yText={yText}
            awareness={userAwareness}
          />
        </div>
      </div>
    );
  },
};
