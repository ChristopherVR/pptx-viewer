import { describe, it, expect } from "vitest";
import { segmentsToEditorHtml } from "./notes-html";
import type { TextSegment } from "pptx-viewer-core";

describe("segmentsToEditorHtml", () => {
  it("renders a single plain text segment as a wrapped div with span", () => {
    const segments: TextSegment[] = [{ text: "Hello", style: {} }];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain("<span>Hello</span>");
    expect(html).toMatch(/^<div>/);
    expect(html).toMatch(/<\/div>$/);
  });

  it("renders an empty text segment as a div with an empty span", () => {
    const segments: TextSegment[] = [{ text: "", style: {} }];
    const html = segmentsToEditorHtml(segments);
    // normalizeSegments keeps a single empty segment; the renderer wraps it in a span
    expect(html).toContain("<span></span>");
    expect(html).toMatch(/^<div>/);
  });

  it("renders bold text with font-weight:700 inline style", () => {
    const segments: TextSegment[] = [
      { text: "Bold text", style: { bold: true } },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain("font-weight:700");
    expect(html).toContain("Bold text");
  });

  it("renders italic text with font-style:italic inline style", () => {
    const segments: TextSegment[] = [
      { text: "Italic text", style: { italic: true } },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain("font-style:italic");
  });

  it("renders underline text with text-decoration:underline", () => {
    const segments: TextSegment[] = [
      { text: "Underlined", style: { underline: true } },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain("text-decoration:underline");
  });

  it("renders strikethrough with text-decoration:line-through", () => {
    const segments: TextSegment[] = [
      { text: "Struck", style: { strikethrough: true } },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain("text-decoration:line-through");
  });

  it("renders color as inline style", () => {
    const segments: TextSegment[] = [
      { text: "Red", style: { color: "#ff0000" } },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain("color:#ff0000");
  });

  it("renders fontSize as pt inline style", () => {
    const segments: TextSegment[] = [
      { text: "Big", style: { fontSize: 24 } },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain("font-size:24pt");
  });

  it("renders fontFamily as inline style", () => {
    const segments: TextSegment[] = [
      { text: "Custom", style: { fontFamily: "Arial" } },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain("font-family:Arial");
  });

  it("renders hyperlinks as anchor tags", () => {
    const segments: TextSegment[] = [
      { text: "Click me", style: { hyperlink: "https://example.com" } },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain("Click me</a>");
    expect(html).toContain('data-hyperlink="https://example.com"');
  });

  it("escapes HTML special characters in text content", () => {
    const segments: TextSegment[] = [
      { text: '<script>alert("xss")</script>', style: {} },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;xss&quot;");
    expect(html).not.toContain("<script>");
  });

  it("separates paragraphs into separate div elements", () => {
    const segments: TextSegment[] = [
      { text: "Paragraph 1", style: {} },
      { text: "", style: {}, isParagraphBreak: true },
      { text: "Paragraph 2", style: {} },
    ];
    const html = segmentsToEditorHtml(segments);
    // Should produce two <div> wrappers
    const divMatches = html.match(/<div/g);
    expect(divMatches).not.toBeNull();
    expect(divMatches!.length).toBe(2);
    expect(html).toContain("Paragraph 1");
    expect(html).toContain("Paragraph 2");
  });

  it("renders bullet paragraphs with bullet prefix and data attribute", () => {
    const segments: TextSegment[] = [
      { text: "Bullet item", style: {}, bulletInfo: { char: "\u2022" } },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain('data-bullet-type="bullet"');
    expect(html).toContain("\u2022");
    expect(html).toContain('contenteditable="false"');
  });

  it("renders numbered paragraphs with numbered prefix and data attribute", () => {
    const segments: TextSegment[] = [
      {
        text: "First item",
        style: {},
        bulletInfo: { autoNumType: "arabicPeriod" },
      },
      { text: "", style: {}, isParagraphBreak: true },
      {
        text: "Second item",
        style: {},
        bulletInfo: { autoNumType: "arabicPeriod" },
      },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain('data-bullet-type="numbered"');
    expect(html).toContain("1.");
    expect(html).toContain("2.");
  });

  it("resets numbered counter after a non-numbered paragraph", () => {
    const segments: TextSegment[] = [
      {
        text: "Num 1",
        style: {},
        bulletInfo: { autoNumType: "arabicPeriod" },
      },
      { text: "", style: {}, isParagraphBreak: true },
      { text: "Plain text", style: {} },
      { text: "", style: {}, isParagraphBreak: true },
      {
        text: "Num 1 again",
        style: {},
        bulletInfo: { autoNumType: "arabicPeriod" },
      },
    ];
    const html = segmentsToEditorHtml(segments);
    // The last numbered paragraph should start at 1 again
    // We should find "1." twice in the output
    const oneMatches = html.match(
      /contenteditable="false">1\.<\/span>/g,
    );
    expect(oneMatches).not.toBeNull();
    expect(oneMatches!.length).toBe(2);
  });

  it("renders indented paragraphs with padding-left style and data attribute", () => {
    const segments: TextSegment[] = [
      { text: "Indented", style: { paragraphMarginLeft: 48 } },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain('data-indent-level="2"');
    expect(html).toContain("padding-left:48px");
  });

  it("combines multiple styles in a single span", () => {
    const segments: TextSegment[] = [
      {
        text: "Multi",
        style: { bold: true, italic: true, color: "#00ff00" },
      },
    ];
    const html = segmentsToEditorHtml(segments);
    expect(html).toContain("font-weight:700");
    expect(html).toContain("font-style:italic");
    expect(html).toContain("color:#00ff00");
  });

  it("renders multiple segments within the same paragraph", () => {
    const segments: TextSegment[] = [
      { text: "Normal ", style: {} },
      { text: "bold", style: { bold: true } },
    ];
    const html = segmentsToEditorHtml(segments);
    // Should be a single div with two spans
    const divMatches = html.match(/<div/g);
    expect(divMatches).not.toBeNull();
    expect(divMatches!.length).toBe(1);
    expect(html).toContain("<span>Normal </span>");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("bold</span>");
  });
});
