/**
 * Tests for SVG print serializer utilities.
 *
 * Tests focus on the pure functions (escapeXml, buildPrintStyleSheet,
 * buildPrintDocument, svgToBlob, svgToDataUrl). DOM-dependent functions
 * (collectInlineStyles, collectImageUrls, serializeElementToSvg) require
 * a browser/jsdom environment and are validated via their pure sub-functions.
 */
import { describe, it, expect } from "vitest";

import {
  escapeXml,
  buildPrintStyleSheet,
  buildPrintDocument,
  svgToBlob,
  svgToDataUrl,
  type SvgPrintOptions,
  type SvgPrintResult,
} from "./svg-print-serializer";

// ────────────────────────────────────────────────────────────────────
// escapeXml
// ────────────────────────────────────────────────────────────────────

describe("escapeXml", () => {
  it("escapes ampersand", () => {
    expect(escapeXml("a & b")).toBe("a &amp; b");
  });

  it("escapes less-than", () => {
    expect(escapeXml("a < b")).toBe("a &lt; b");
  });

  it("escapes greater-than", () => {
    expect(escapeXml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escapeXml('a "b" c')).toBe("a &quot;b&quot; c");
  });

  it("escapes single quotes", () => {
    expect(escapeXml("a 'b' c")).toBe("a &apos;b&apos; c");
  });

  it("handles multiple special characters", () => {
    expect(escapeXml('<div class="a & b">')).toBe(
      "&lt;div class=&quot;a &amp; b&quot;&gt;",
    );
  });

  it("returns empty string for empty input", () => {
    expect(escapeXml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(escapeXml("hello world 123")).toBe("hello world 123");
  });

  it("handles unicode characters without escaping", () => {
    expect(escapeXml("hello \u00e9\u00e8\u00ea")).toBe("hello \u00e9\u00e8\u00ea");
  });

  it("handles all five XML entities in one string", () => {
    expect(escapeXml("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&apos;");
  });

  it("handles repeated entities", () => {
    expect(escapeXml("&&&")).toBe("&amp;&amp;&amp;");
  });
});

// ────────────────────────────────────────────────────────────────────
// buildPrintStyleSheet
// ────────────────────────────────────────────────────────────────────

describe("buildPrintStyleSheet", () => {
  it("includes width and height", () => {
    const css = buildPrintStyleSheet(960, 540);
    expect(css).toContain("960px");
    expect(css).toContain("540px");
  });

  it("includes print-color-adjust", () => {
    const css = buildPrintStyleSheet(960, 540);
    expect(css).toContain("print-color-adjust: exact");
    expect(css).toContain("-webkit-print-color-adjust: exact");
  });

  it("hides export-ignore elements", () => {
    const css = buildPrintStyleSheet(960, 540);
    expect(css).toContain('[data-export-ignore="true"]');
    expect(css).toContain("display: none");
  });

  it("removes scrollbars", () => {
    const css = buildPrintStyleSheet(960, 540);
    expect(css).toContain("scrollbar-width: none");
  });

  it("includes custom CSS when provided", () => {
    const css = buildPrintStyleSheet(960, 540, ".custom { color: red; }");
    expect(css).toContain(".custom { color: red; }");
  });

  it("works without custom CSS", () => {
    const css = buildPrintStyleSheet(960, 540);
    expect(typeof css).toBe("string");
    expect(css.length).toBeGreaterThan(0);
  });

  it("sets overflow hidden", () => {
    const css = buildPrintStyleSheet(960, 540);
    expect(css).toContain("overflow: hidden");
  });

  it("sets box-sizing border-box", () => {
    const css = buildPrintStyleSheet(960, 540);
    expect(css).toContain("box-sizing: border-box");
  });
});

// ────────────────────────────────────────────────────────────────────
// buildPrintDocument
// ────────────────────────────────────────────────────────────────────

describe("buildPrintDocument", () => {
  const simpleSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect fill="blue" width="960" height="540"/></svg>';

  it("produces valid HTML document", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540);
    expect(doc).toContain("<!doctype html>");
    expect(doc).toContain("<html>");
    expect(doc).toContain("</html>");
    expect(doc).toContain("<head>");
    expect(doc).toContain("<body>");
  });

  it("embeds SVG slides", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540);
    expect(doc).toContain(simpleSvg);
  });

  it("wraps each slide in a page section", () => {
    const doc = buildPrintDocument([simpleSvg, simpleSvg], 960, 540);
    const sectionCount = (doc.match(/class="print-slide-page"/g) || []).length;
    expect(sectionCount).toBe(2);
  });

  it("includes page-break CSS", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540);
    expect(doc).toContain("page-break-after: always");
  });

  it("applies landscape orientation by default", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540);
    expect(doc).toContain("size: landscape");
  });

  it("applies portrait orientation when specified", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540, {
      orientation: "portrait",
    });
    expect(doc).toContain("size: portrait");
  });

  it("includes print-color-adjust", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540);
    expect(doc).toContain("-webkit-print-color-adjust: exact");
    expect(doc).toContain("print-color-adjust: exact");
  });

  it("includes custom title", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540, {
      title: "My Presentation",
    });
    expect(doc).toContain("<title>My Presentation</title>");
  });

  it("escapes title HTML entities", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540, {
      title: "A & B <C>",
    });
    expect(doc).toContain("A &amp; B &lt;C&gt;");
  });

  it("applies colour filter", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540, {
      colorFilter: "filter: grayscale(1);",
    });
    expect(doc).toContain("filter: grayscale(1);");
  });

  it("includes screen preview styles", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540);
    expect(doc).toContain("@media screen");
    expect(doc).toContain("box-shadow");
  });

  it("handles empty SVG array", () => {
    const doc = buildPrintDocument([], 960, 540);
    expect(doc).toContain("<!doctype html>");
    // CSS class definition is still present, but no actual slide sections
    expect(doc).not.toContain('aria-label="Slide');
  });

  it("adds aria-label to slide pages", () => {
    const doc = buildPrintDocument([simpleSvg, simpleSvg], 960, 540);
    expect(doc).toContain('aria-label="Slide 1"');
    expect(doc).toContain('aria-label="Slide 2"');
  });

  it("includes @page rule", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540);
    expect(doc).toContain("@page");
  });

  it("last page section has no page-break-after in CSS", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540);
    expect(doc).toContain("page-break-after: auto");
  });

  it("includes landscape dimensions in screen media for landscape mode", () => {
    const doc = buildPrintDocument([simpleSvg], 960, 540, { orientation: "landscape" });
    expect(doc).toContain("297mm");
    expect(doc).toContain("210mm");
  });
});

// ────────────────────────────────────────────────────────────────────
// svgToBlob
// ────────────────────────────────────────────────────────────────────

describe("svgToBlob", () => {
  const testSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';

  it("returns a Blob", () => {
    const blob = svgToBlob(testSvg);
    expect(blob).toBeInstanceOf(Blob);
  });

  it("has correct MIME type", () => {
    const blob = svgToBlob(testSvg);
    expect(blob.type).toBe("image/svg+xml;charset=utf-8");
  });

  it("has non-zero size", () => {
    const blob = svgToBlob(testSvg);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("blob content matches input", async () => {
    const blob = svgToBlob(testSvg);
    const text = await blob.text();
    expect(text).toBe(testSvg);
  });

  it("handles empty string", () => {
    const blob = svgToBlob("");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// svgToDataUrl
// ────────────────────────────────────────────────────────────────────

describe("svgToDataUrl", () => {
  const testSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';

  it("starts with data: prefix", () => {
    const url = svgToDataUrl(testSvg);
    expect(url).toMatch(/^data:image\/svg\+xml/);
  });

  it("includes charset", () => {
    const url = svgToDataUrl(testSvg);
    expect(url).toContain("charset=utf-8");
  });

  it("encodes SVG content", () => {
    const url = svgToDataUrl(testSvg);
    const decoded = decodeURIComponent(url.split(",")[1]);
    expect(decoded).toBe(testSvg);
  });

  it("handles empty SVG", () => {
    const url = svgToDataUrl("");
    expect(url).toMatch(/^data:image\/svg\+xml/);
  });

  it("properly encodes special characters", () => {
    const svg = '<svg><text>Hello & "World"</text></svg>';
    const url = svgToDataUrl(svg);
    // Decode back
    const decoded = decodeURIComponent(url.split(",")[1]);
    expect(decoded).toBe(svg);
  });

  it("round-trips through encode/decode", () => {
    const complex = '<svg xmlns="http://www.w3.org/2000/svg"><text x="10" y="20" font-size="24">Test & <Special></text></svg>';
    const url = svgToDataUrl(complex);
    const decoded = decodeURIComponent(url.split(",")[1]);
    expect(decoded).toBe(complex);
  });
});

// ────────────────────────────────────────────────────────────────────
// SvgPrintOptions type shape
// ────────────────────────────────────────────────────────────────────

describe("SvgPrintOptions type", () => {
  it("requires width and height", () => {
    const opts: SvgPrintOptions = { width: 960, height: 540 };
    expect(opts.width).toBe(960);
    expect(opts.height).toBe(540);
  });

  it("accepts all optional properties", () => {
    const opts: SvgPrintOptions = {
      width: 1280,
      height: 720,
      backgroundColor: "#FFFFFF",
      inlineStyles: true,
      embedImages: true,
      customCss: ".test { color: red; }",
    };
    expect(opts.backgroundColor).toBe("#FFFFFF");
    expect(opts.inlineStyles).toBe(true);
    expect(opts.embedImages).toBe(true);
    expect(opts.customCss).toBe(".test { color: red; }");
  });

  it("allows omitting optional properties", () => {
    const opts: SvgPrintOptions = { width: 100, height: 100 };
    expect(opts.backgroundColor).toBeUndefined();
    expect(opts.inlineStyles).toBeUndefined();
    expect(opts.embedImages).toBeUndefined();
    expect(opts.customCss).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────
// SvgPrintResult type shape
// ────────────────────────────────────────────────────────────────────

describe("SvgPrintResult type", () => {
  it("has svg, width, and height properties", () => {
    const result: SvgPrintResult = {
      svg: "<svg></svg>",
      width: 960,
      height: 540,
    };
    expect(result.svg).toBe("<svg></svg>");
    expect(result.width).toBe(960);
    expect(result.height).toBe(540);
  });
});

// ────────────────────────────────────────────────────────────────────
// Module exports
// ────────────────────────────────────────────────────────────────────

describe("module exports", () => {
  it("exports serializeElementToSvg function", async () => {
    const mod = await import("./svg-print-serializer");
    expect(typeof mod.serializeElementToSvg).toBe("function");
  });

  it("exports collectInlineStyles function", async () => {
    const mod = await import("./svg-print-serializer");
    expect(typeof mod.collectInlineStyles).toBe("function");
  });

  it("exports collectImageUrls function", async () => {
    const mod = await import("./svg-print-serializer");
    expect(typeof mod.collectImageUrls).toBe("function");
  });

  it("exports imageToBase64 function", async () => {
    const mod = await import("./svg-print-serializer");
    expect(typeof mod.imageToBase64).toBe("function");
  });
});
