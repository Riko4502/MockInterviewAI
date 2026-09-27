import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";
import {
  getAwarenessStyleId,
  removeYjsAwarenessStyles,
  updateYjsAwarenessStyles,
} from "./cursor-css";

describe("cursor-css awareness styles sanitization (CWE-74)", () => {
  let doc: Y.Doc;
  let awareness: Awareness;

  beforeEach(() => {
    doc = new Y.Doc();
    awareness = new Awareness(doc);
  });

  afterEach(() => {
    removeYjsAwarenessStyles(awareness);
    awareness.destroy();
    doc.destroy();
  });

  it("should escape quotes, backslashes and newlines in username to prevent CSS injection", () => {
    // Add remote client state (clientID !== awareness.doc.clientID)
    awareness.states.set(999, {
      user: {
        name: 'EvilUser\\"; background: red; --fake: "\nnewline',
        color: "#3b82f6",
      },
    });

    updateYjsAwarenessStyles(awareness);

    const styleEl = document.getElementById(getAwarenessStyleId(awareness));
    expect(styleEl).not.toBeNull();
    const css = styleEl?.textContent || "";

    // Quotes and backslashes should be escaped
    expect(css).not.toContain('content: "EvilUser";');
    expect(css).toContain('content: "EvilUser\\\\\\"');
    // Newline should be replaced with \\A
    expect(css).toContain("\\A newline");
  });

  it("should reject invalid color strings and fallback to safe default color", () => {
    // Add remote client state with malicious color
    awareness.states.set(888, {
      user: {
        name: "TestUser",
        color: "red; } * { color: black !important; } /*",
      },
    });

    updateYjsAwarenessStyles(awareness);

    const styleEl = document.getElementById(getAwarenessStyleId(awareness));
    const css = styleEl?.textContent || "";

    // Malicious color must NOT appear in the CSS rules
    expect(css).not.toContain("red; }");
    // Default fallback color #e91e63 must be used instead
    expect(css).toContain("#e91e63");
  });
});
