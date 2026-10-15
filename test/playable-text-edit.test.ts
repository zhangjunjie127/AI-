import { describe, expect, it } from "vitest";
import {
  insertPlayableText,
  parsePlayableSourceLocation,
  removePlayableElement,
  replacePlayableElementText,
} from "../src/shared/playable-text-edit.js";

const html = [
  "<main>",
  '  <h1 class="title">Night Train</h1>',
  '  <button data-signal="start" title="a > b">',
  "    Board the train",
  "  </button>",
  "  <p>Tea &amp; biscuits</p>",
  "  <div><span>Nested</span></div>",
  "</main>",
].join("\n");

describe("parsePlayableSourceLocation", () => {
  it("reads file, line, and column", () => {
    expect(parsePlayableSourceLocation("nodes/menu/index.html:12:3")).toEqual({
      file: "nodes/menu/index.html",
      line: 12,
      column: 3,
    });
    expect(
      parsePlayableSourceLocation("nodes/menu/index.html"),
    ).toBeUndefined();
    expect(parsePlayableSourceLocation("a.html:0:1")).toBeUndefined();
  });
});

describe("replacePlayableElementText", () => {
  it("replaces the text of a text-only element", () => {
    expect(
      replacePlayableElementText(
        html,
        { line: 2, column: 3 },
        "Night Train",
        "Day Train",
      ),
    ).toContain('<h1 class="title">Day Train</h1>');
  });

  it("keeps surrounding whitespace and reads past quoted >", () => {
    const next = replacePlayableElementText(
      html,
      { line: 3, column: 3 },
      "Board the train",
      "Get on",
    );
    expect(next).toContain(
      '<button data-signal="start" title="a > b">\n    Get on\n  </button>',
    );
  });

  it("matches decoded entities and escapes the new text", () => {
    const next = replacePlayableElementText(
      html,
      { line: 6, column: 3 },
      "Tea & biscuits",
      "Tea < coffee & cake",
    );
    expect(next).toContain("<p>Tea &lt; coffee &amp; cake</p>");
  });

  it("refuses stale text, nested elements, and a location that is not a tag", () => {
    expect(
      replacePlayableElementText(
        html,
        { line: 2, column: 3 },
        "Old title",
        "New",
      ),
    ).toBeUndefined();
    expect(
      replacePlayableElementText(html, { line: 7, column: 3 }, "Nested", "New"),
    ).toBeUndefined();
    expect(
      replacePlayableElementText(
        html,
        { line: 4, column: 5 },
        "Board the train",
        "New",
      ),
    ).toBeUndefined();
    expect(
      replacePlayableElementText(
        html,
        { line: 40, column: 1 },
        "Night Train",
        "New",
      ),
    ).toBeUndefined();
  });

  it("changes nothing else", () => {
    const next = replacePlayableElementText(
      html,
      { line: 2, column: 3 },
      "Night Train",
      "Day Train",
    )!;
    expect(next.replace("Day Train", "Night Train")).toBe(html);
  });
});

describe("insertPlayableText", () => {
  it("inserts escaped, positioned text and reports its source location", () => {
    const inserted = insertPlayableText("<main>\n  <p>Existing</p>\n</main>", {
      id: "putenggame-text-123-1",
      text: "New < caption",
      x: 12.345,
      y: 67.891,
    })!;
    expect(inserted.html).toContain(
      '<p id="putenggame-text-123-1" style="position:absolute;left:12.35cqw;top:67.89cqh;margin:0">New &lt; caption</p>',
    );
    expect(
      parsePlayableSourceLocation(
        `nodes/test/index.html:${inserted.line}:${inserted.column}`,
      ),
    ).toEqual({
      file: "nodes/test/index.html",
      line: 3,
      column: 1,
    });
  });

  it("rejects invalid positions, duplicate IDs, and missing text", () => {
    const edit = {
      id: "putenggame-text-123-1",
      text: "Caption",
      x: 0,
      y: 0,
    };
    expect(
      insertPlayableText("<main></main>", { ...edit, x: 101 }),
    ).toBeUndefined();
    expect(
      insertPlayableText(
        '<main><p id="putenggame-text-123-1"></p></main>',
        edit,
      ),
    ).toBeUndefined();
    expect(
      insertPlayableText("<main></main>", { ...edit, text: " " }),
    ).toBeUndefined();
  });
});

describe("removePlayableElement", () => {
  it("removes a paired element and its nested same-tag content", () => {
    const next = removePlayableElement(
      "<main>\n  <div><div>Nested</div></div>\n  <p>Keep</p>\n</main>",
      { line: 2, column: 3 },
      "div",
    );
    expect(next).toBe("<main>\n  \n  <p>Keep</p>\n</main>");
  });

  it("removes void elements and rejects stale locations", () => {
    expect(
      removePlayableElement(
        '<main>\n  <img src="a.png" />\n</main>',
        { line: 2, column: 3 },
        "img",
      ),
    ).toBe("<main>\n  \n</main>");
    expect(
      removePlayableElement(
        "<main><p>Keep</p></main>",
        { line: 4, column: 1 },
        "p",
      ),
    ).toBeUndefined();
  });
});
