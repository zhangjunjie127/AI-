import { readFile } from "node:fs/promises";
import { inflateRawSync, inflateSync } from "node:zlib";
import yauzl from "yauzl";

const MAX_SCRIPT_TEXT = 200_000;

export interface ExtractedScript {
  format: "text" | "word" | "pdf";
  text: string;
}

/** Extracts the readable part of a supported script attachment for the Agent. */
export async function extractScriptText(filePath: string, fileName: string): Promise<ExtractedScript | undefined> {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if ([".txt", ".md", ".mdx"].includes(extension)) {
    return { format: "text", text: limitScriptText(await readFile(filePath, "utf8")) };
  }
  if (extension === ".docx") {
    return { format: "word", text: limitScriptText(await extractDocxText(await readFile(filePath))) };
  }
  if (extension === ".doc") {
    return { format: "word", text: limitScriptText(extractLegacyWordText(await readFile(filePath))) };
  }
  if (extension === ".pdf") {
    return { format: "pdf", text: limitScriptText(extractPdfText(await readFile(filePath))) };
  }
  return undefined;
}

function extractLegacyWordText(buffer: Buffer): string {
  const utf16 = buffer.toString("utf16le").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
  const ascii = buffer.toString("latin1").replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ");
  return `${utf16}\n${ascii}`;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await yauzl.fromBufferPromise(buffer, { lazyEntries: true });
  try {
    for await (const entry of zip.eachEntry()) {
      if (entry.fileName !== "word/document.xml") continue;
      const stream = await zip.openReadStreamPromise(entry);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return xmlDocumentText(Buffer.concat(chunks).toString("utf8"));
    }
  } finally {
    zip.close();
  }
  return "";
}

function xmlDocumentText(xml: string): string {
  return xml
    .split(/<w:p(?:\s[^>]*)?>/i)
    .slice(1)
    .map((paragraph) => {
      const body = paragraph.split(/<\/w:p>/i, 1)[0] ?? "";
      const pieces = [...body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi)].map((match) => decodeXml(match[1] ?? ""));
      return pieces.join("");
    })
    .filter((paragraph) => paragraph.trim())
    .join("\n");
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Handles ordinary text PDFs without depending on an external command or a
 * platform-specific PDF executable. PDFs with embedded custom CMaps may still
 * need the original file to be read by a provider that supports PDF input.
 */
function extractPdfText(buffer: Buffer): string {
  const source = buffer.toString("latin1");
  const output: string[] = [];
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of source.matchAll(streamPattern)) {
    const raw = Buffer.from(match[1] ?? "", "latin1");
    const header = source.slice(Math.max(0, (match.index ?? 0) - 500), match.index ?? 0);
    let decoded = raw;
    if (/\/FlateDecode/.test(header)) {
      try { decoded = inflateSync(raw); }
      catch { try { decoded = inflateRawSync(raw); } catch { continue; } }
    }
    const content = decoded.toString("latin1");
    for (const text of extractPdfOperators(content)) {
      if (text.trim()) output.push(text);
    }
  }
  return output.join("\n");
}

function extractPdfOperators(content: string): string[] {
  const lines: string[] = [];
  const simple = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  for (const match of content.matchAll(simple)) lines.push(decodePdfLiteral(match[1] ?? ""));
  const arrays = /\[((?:\s*(?:\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]+>|[-+]?\d+(?:\.\d+)?))*\s*)\]\s*TJ/g;
  for (const match of content.matchAll(arrays)) {
    const values = [...(match[1] ?? "").matchAll(/\(((?:\\.|[^\\)])*)\)|<([0-9a-fA-F\s]+)>/g)]
      .map((item) => item[1] !== undefined ? decodePdfLiteral(item[1]) : decodePdfHex(item[2] ?? ""));
    if (values.length) lines.push(values.join(""));
  }
  return lines;
}

function decodePdfLiteral(value: string): string {
  return value.replace(/\\(n|r|t|b|f|\\|\(|\)|([0-7]{1,3}))/g, (_, escape: string, octal?: string) => {
    if (octal) return String.fromCharCode(Number.parseInt(octal, 8));
    return { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "\\": "\\", "(": "(", ")": ")" }[escape] ?? escape;
  });
}

function decodePdfHex(value: string): string {
  const bytes = Buffer.from(value.replace(/\s/g, "").padEnd(value.replace(/\s/g, "").length % 2 ? value.replace(/\s/g, "").length + 1 : value.replace(/\s/g, "").length, "0"), "hex");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let text = "";
    for (let index = 2; index + 1 < bytes.length; index += 2) text += String.fromCharCode((bytes[index]! << 8) | bytes[index + 1]!);
    return text;
  }
  return bytes.toString("utf8").replace(/�/g, "");
}

function limitScriptText(value: string): string {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, MAX_SCRIPT_TEXT);
}
