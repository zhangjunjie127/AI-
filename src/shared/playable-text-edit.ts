/** A `<file>:<line>:<column>` source location from a preview build. */
export interface PlayableSourceLocation {
  file: string;
  line: number;
  column: number;
}

export function parsePlayableSourceLocation(
  value: string,
): PlayableSourceLocation | undefined {
  const match = /^(.+):(\d+):(\d+)$/.exec(value);
  if (!match) return undefined;
  const line = Number(match[2]);
  const column = Number(match[3]);
  if (line < 1 || column < 1) return undefined;
  return { file: match[1]!, line, column };
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Replaces the text of the element whose start tag is at `location` in
 * surface HTML. The element must hold only text, and that text must still
 * read `before`, so a stale preview or text set by a script is never
 * overwritten. Surrounding whitespace is kept. Returns undefined when the
 * edit cannot be made in place.
 */
export function replacePlayableElementText(
  html: string,
  location: Pick<PlayableSourceLocation, "line" | "column">,
  before: string,
  after: string,
): string | undefined {
  const start = offsetOf(html, location.line, location.column);
  if (start === undefined || html[start] !== "<") return undefined;
  const tag = /^<([A-Za-z][\w-]*)/.exec(html.slice(start))?.[1];
  if (!tag) return undefined;
  const open = startTagEnd(html, start);
  if (open === undefined || html[open - 2] === "/") return undefined;
  const close = html.indexOf("<", open);
  if (
    close < 0 ||
    html.slice(close, close + tag.length + 2).toLowerCase() !==
      `</${tag.toLowerCase()}`
  )
    return undefined;
  const content = html.slice(open, close);
  if (normalize(decode(content)) !== normalize(before)) return undefined;
  const leading = /^\s*/.exec(content)![0];
  const trailing = /\s*$/.exec(content.slice(leading.length))![0];
  return `${html.slice(0, open)}${leading}${escapeText(after.trim())}${trailing}${html.slice(close)}`;
}

/** Inserts a positioned text element into the surface's first root element. */
export function insertPlayableText(
  html: string,
  edit: { id: string; text: string; x: number; y: number },
): { html: string; line: number; column: number } | undefined {
  if (
    !/^putenggame-text-[\w-]+$/.test(edit.id) ||
    html.includes(edit.id) ||
    !edit.text.trim() ||
    !Number.isFinite(edit.x) ||
    !Number.isFinite(edit.y) ||
    edit.x < 0 ||
    edit.x > 100 ||
    edit.y < 0 ||
    edit.y > 100
  )
    return undefined;
  const opening = /<([A-Za-z][\w-]*)\b[^>]*>/i.exec(html);
  if (!opening) return undefined;
  const tag = opening[1]!;
  const closingPattern = new RegExp(`<\\/\\s*${tag}\\s*>`, "gi");
  let closing: RegExpExecArray | null;
  let lastClosing: RegExpExecArray | null = null;
  while ((closing = closingPattern.exec(html))) lastClosing = closing;
  if (!lastClosing) return undefined;
  const offset = lastClosing.index;
  const element = `<p id="${edit.id}" style="position:absolute;left:${roundPosition(edit.x)}cqw;top:${roundPosition(edit.y)}cqh;margin:0">${escapeText(edit.text.trim())}</p>`;
  const next = `${html.slice(0, offset)}${element}${html.slice(offset)}`;
  const line = html.slice(0, offset).split("\n").length;
  const lineStart = html.lastIndexOf("\n", offset - 1) + 1;
  return { html: next, line, column: offset - lineStart + 1 };
}

/** Removes the element at a source location, including its paired contents. */
export function removePlayableElement(
  html: string,
  location: Pick<PlayableSourceLocation, "line" | "column">,
  tag: string,
): string | undefined {
  const start = offsetOf(html, location.line, location.column);
  if (start === undefined || html[start] !== "<") return undefined;
  const name = /^<([A-Za-z][\w-]*)/.exec(html.slice(start))?.[1];
  if (!name || name.toLowerCase() !== tag.toLowerCase()) return undefined;
  const open = startTagEnd(html, start);
  if (open === undefined) return undefined;
  const opening = html.slice(start, open);
  if (isVoidElement(name) || /\/\s*>$/.test(opening))
    return `${html.slice(0, start)}${html.slice(open)}`;

  let depth = 1;
  let cursor = open;
  while (cursor < html.length) {
    const next = html.indexOf("<", cursor);
    if (next < 0) return undefined;
    if (html.startsWith("<!--", next)) {
      const endComment = html.indexOf("-->", next + 4);
      if (endComment < 0) return undefined;
      cursor = endComment + 3;
      continue;
    }
    const end = startTagEnd(html, next);
    if (end === undefined) return undefined;
    const token = html.slice(next, end);
    const close = new RegExp(`^<\\/\\s*${escapeRegExp(name)}\\s*>$`, "i").test(
      token,
    );
    if (close) {
      depth -= 1;
      if (!depth) return `${html.slice(0, start)}${html.slice(end)}`;
    } else if (
      new RegExp(`^<${escapeRegExp(name)}(?:\\s|>)`, "i").test(token) &&
      !/\/\s*>$/.test(token)
    ) {
      depth += 1;
    }
    cursor = end;
  }
  return undefined;
}

/** The offset of a 1-based line and column in `html`, or undefined past its end. */
export function offsetOf(
  html: string,
  line: number,
  column: number,
): number | undefined {
  let offset = 0;
  for (let current = 1; current < line; current += 1) {
    const next = html.indexOf("\n", offset);
    if (next < 0) return undefined;
    offset = next + 1;
  }
  const result = offset + column - 1;
  return result < html.length ? result : undefined;
}

/** The offset just after a start tag's `>`, skipping quoted attribute values. */
export function startTagEnd(html: string, start: number): number | undefined {
  let quote: string | undefined;
  for (let index = start + 1; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = undefined;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return index + 1;
    }
  }
  return undefined;
}

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function isVoidElement(tag: string): boolean {
  return VOID_ELEMENTS.has(tag.toLowerCase());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decode(text: string): string {
  return text.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (entity, name: string) => {
      if (name[0] === "#") {
        const code =
          name[1] === "x" || name[1] === "X"
            ? parseInt(name.slice(2), 16)
            : Number(name.slice(1));
        return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
      }
      return ENTITIES[name.toLowerCase()] ?? entity;
    },
  );
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function escapeText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function roundPosition(value: number): number {
  return Math.round(value * 100) / 100;
}
