/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { translateSandboxTextNodes } from "../src/renderer/playable-sandbox-language.js";

describe("playable sandbox language", () => {
  it("does not rewrite text while the author is typing", () => {
    const root = document.createElement("div");
    const editor = document.createElement("p");
    editor.setAttribute("contenteditable", "plaintext-only");
    editor.textContent = "a";
    root.append(editor);
    const originals = new WeakMap<Text, string>();

    translateSandboxTextNodes(root, (value) => value, originals);
    editor.firstChild!.nodeValue = "ab";
    translateSandboxTextNodes(root, (value) => value, originals);

    expect(editor.textContent).toBe("ab");
  });

  it("continues translating static labels", () => {
    const root = document.createElement("div");
    const label = document.createElement("p");
    label.textContent = "Back";
    root.append(label);

    translateSandboxTextNodes(root, (value) => value === "Back" ? "返回" : value, new WeakMap());

    expect(label.textContent).toBe("返回");
  });
});
