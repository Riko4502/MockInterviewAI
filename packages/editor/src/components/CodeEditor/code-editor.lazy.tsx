import { lazy, Suspense } from "react";
import type { CodeEditorProps } from "./types";

export interface CodeEditorLazyProps extends CodeEditorProps {}

/**
 * Ленивая загрузка (Lazy wrapper) для CodeEditor.
 * Monaco Editor работает только в браузере (ему нужен объект window).
 * В Next.js (apps/web) этот компонент позволит избежать ошибок SSR (Server-Side Rendering).
 */
const LazyEditor = lazy(() =>
  import("./code-editor").then((mod) => ({ default: mod.CodeEditor })),
);

export const CodeEditorLazy = (props: CodeEditorLazyProps) => {
  return (
    <Suspense>
      <LazyEditor {...props} />
    </Suspense>
  );
};
