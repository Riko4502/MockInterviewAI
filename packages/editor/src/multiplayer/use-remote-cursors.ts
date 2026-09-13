import type { editor } from "monaco-editor";
import { useEffect, useRef } from "react";
import type { Collaborator } from "@/components";
import { updateRemoteCursorStyles } from "./cursor-css";

/**
 * Хук, который синхронизирует пропс \`collaborators\` с декорациями Monaco Editor.
 * Он рисует цветные каретки и выделения текста поверх кода.
 *
 * @param editorInstance Инстанс редактора Monaco
 * @param collaborators Массив соавторов (цвет уже должен быть определен снаружи)
 */
export function useRemoteCursors(
  editorInstance: editor.IStandaloneCodeEditor | null,
  collaborators: Collaborator[],
) {
  const decorationsCollectionRef =
    useRef<editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    if (!editorInstance) return;

    // 1. Обновляем глобальный CSS стили (каретки и флажки с именами)
    updateRemoteCursorStyles(collaborators);

    // 2. Формируем массив новых декораций для Monaco
    const newDecorations: editor.IModelDeltaDecoration[] = [];

    collaborators.forEach((collaborator) => {
      if (!collaborator.cursor) return;

      const { line, column, selectionEndLine, selectionEndColumn } =
        collaborator.cursor;

      // Декорация для самой каретки (линия + флажок с именем)
      newDecorations.push({
        range: {
          startLineNumber: line,
          startColumn: column,
          endLineNumber: line,
          endColumn: column,
        },
        options: {
          className: `remote-cursor-${collaborator.id}`,
        },
      });

      // Декорация для выделенного текста
      const hasSelection =
        selectionEndLine &&
        selectionEndColumn &&
        (selectionEndLine !== line || selectionEndColumn !== column);

      if (hasSelection && selectionEndLine && selectionEndColumn) {
        const endLine = selectionEndLine;
        const endCol = selectionEndColumn;
        newDecorations.push({
          range: {
            startLineNumber: Math.min(line, endLine),
            startColumn: line <= endLine ? column : endCol,
            endLineNumber: Math.max(line, endLine),
            endColumn: line >= endLine ? column : endCol,
          },
          options: {
            className: `remote-selection-${collaborator.id}`,
          },
        });
      }
    });

    // 3. Применяем декорации к редактору
    if (!decorationsCollectionRef.current) {
      decorationsCollectionRef.current =
        editorInstance.createDecorationsCollection(newDecorations);
    } else {
      decorationsCollectionRef.current.set(newDecorations);
    }
  }, [editorInstance, collaborators]);
}
