import "server-only";
import PDFDocument from "pdfkit";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InputError } from "../mutation-errors";
const fonts = Object.fromEntries(
  [
    "NotoSans-Regular",
    "NotoSans-Bold",
    "NotoSansDevanagari-Regular",
    "NotoSansDevanagari-Bold"
  ].map((name) => [
    name,
    readFileSync(join(process.cwd(), "src/server/documents/fonts", name + ".ttf"))
  ])
);
// Shared page/font/wrapping foundation for quotations and payment acknowledgements.
export function a4Document(title: string) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 42,
    bufferPages: true,
    autoFirstPage: false,
    info: { Title: title, Author: "Sarathi", Creator: "Sarathi Business Manager" }
  });
  for (const [name, bytes] of Object.entries(fonts)) doc.registerFont(name, bytes);
  const chunks: Buffer[] = [];
  let bytes = 0;
  const buffer = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 10 * 1024 * 1024) {
        reject(new InputError("The document is too large. Shorten its content and try again."));
      } else chunks.push(chunk);
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  // Avoid an unhandled promise if a synchronous layout/glyph validation fails.
  void buffer.catch(() => {});
  const runs = (value: string) => {
    const output: { value: string; family: string }[] = [];
    for (const char of value) {
      const family = /[\u0900-\u097f\u200c\u200d]/u.test(char) ? "NotoSansDevanagari" : "NotoSans";
      const previous = output.at(-1);
      if (previous?.family === family) previous.value += char;
      else output.push({ value: char, family });
    }
    return output;
  };
  const prepare = (value: string, bold = false, size = 10, family = "NotoSans") => {
    doc.font(family + (bold ? "-Bold" : "-Regular")).fontSize(size);
    const embedded = (
      doc as unknown as { _font: { font: { hasGlyphForCodePoint: (code: number) => boolean } } }
    )._font.font;
    for (const char of value) {
      if (
        !/[\r\n\t\u200c\u200d]/.test(char) &&
        !embedded.hasGlyphForCodePoint(char.codePointAt(0)!)
      )
        throw new InputError(
          "A character in this document cannot be printed. Use supported Latin or Devanagari text and retry."
        );
    }
  };
  const measure = (value: string, bold = false, size = 10) =>
    runs(value).reduce((sum, run) => {
      prepare(run.value, bold, size, run.family);
      return sum + doc.widthOfString(run.value);
    }, 0);
  const wrap = (value: string, width: number, bold = false, size = 10): string[] => {
    measure(value, bold, size);
    const result: string[] = [];
    for (const paragraph of value.replace(/\r/g, "").split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/u)) {
        const candidate = line ? line + " " + word : word;
        if (measure(candidate, bold, size) <= width) {
          line = candidate;
          continue;
        }
        if (line) {
          result.push(line);
          line = "";
        }
        // Long identifiers/URLs wrap at grapheme boundaries, preserving Hindi marks.
        for (const { segment } of new Intl.Segmenter("en", { granularity: "grapheme" }).segment(
          word
        )) {
          if (line && measure(line + segment, bold, size) > width) {
            result.push(line);
            line = "";
          }
          line += segment;
        }
      }
      result.push(line);
    }
    return result;
  };
  const text = (
    value: string,
    x: number,
    y: number,
    width: number,
    bold = false,
    size = 10,
    color = "#182f4d"
  ) => {
    let offset = 0;
    for (const run of runs(value)) {
      prepare(run.value, bold, size, run.family);
      doc.fillColor(color).text(run.value, x + offset, y + size, {
        width: width - offset,
        lineBreak: false,
        baseline: "alphabetic"
      });
      offset += doc.widthOfString(run.value);
    }
  };
  return { doc, buffer, wrap, text };
}
