import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ZipFile } from "yazl";
import { extractScriptText } from "../src/daemon/script-import.js";

describe("script attachment extraction", () => {
  it("reads UTF-8 text scripts", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "putenggame-script-text-"));
    const file = path.join(directory, "story.txt");
    await writeFile(file, "第一章\r\n开场\r\n", "utf8");
    await expect(extractScriptText(file, "story.txt")).resolves.toEqual({ format: "text", text: "第一章\n开场" });
  });

  it("extracts text operators from a simple PDF", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "putenggame-script-pdf-"));
    const file = path.join(directory, "story.pdf");
    const pdf = "%PDF-1.4\n1 0 obj\n<< /Length 24 >>\nstream\nBT\n(Script opening) Tj\nET\nendstream\nendobj\n%%EOF";
    await writeFile(file, pdf, "latin1");
    await expect(extractScriptText(file, "story.pdf")).resolves.toEqual({ format: "pdf", text: "Script opening" });
  });

  it("reads paragraphs from a Word document", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "putenggame-script-word-"));
    const file = path.join(directory, "story.docx");
    const zip = new ZipFile();
    zip.addBuffer(Buffer.from("<?xml version=\"1.0\"?><w:document><w:body><w:p><w:r><w:t>第一章</w:t></w:r></w:p><w:p><w:r><w:t>开场</w:t></w:r></w:p></w:body></w:document>"), "word/document.xml");
    const archive = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      zip.outputStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      zip.outputStream.on("error", reject);
      zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
      zip.end();
    });
    await writeFile(file, archive);
    await expect(extractScriptText(file, "story.docx")).resolves.toEqual({ format: "word", text: "第一章\n开场" });
  });
});
