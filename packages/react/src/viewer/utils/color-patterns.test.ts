import { describe, it, expect } from "vitest";
import { getPatternSvg } from "./color-patterns";

describe("getPatternSvg", () => {
  const fg = "#FF0000";
  const bg = "#FFFFFF";

  it("returns null for an unknown preset", () => {
    expect(getPatternSvg("unknownPreset", fg, bg)).toBeNull();
  });

  it("returns a valid SVG string for pct5", () => {
    const svg = getPatternSvg("pct5", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain(fg);
    expect(svg).toContain(bg);
  });

  it("returns a valid SVG string for pct50", () => {
    const svg = getPatternSvg("pct50", fg, bg);
    expect(svg).not.toBeNull();
    // pct50 uses a 2x2 tile
    expect(svg).toContain('width="2"');
    expect(svg).toContain('height="2"');
  });

  it("generates correct tile size for pct20 (4x4)", () => {
    const svg = getPatternSvg("pct20", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('width="4"');
    expect(svg).toContain('height="4"');
  });

  it("generates horizontal line patterns (horz)", () => {
    const svg = getPatternSvg("horz", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('width="8"');
    expect(svg).toContain('height="8"');
    expect(svg).toContain(fg);
  });

  it("generates vertical line patterns (vert)", () => {
    const svg = getPatternSvg("vert", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain(fg);
    expect(svg).toContain(bg);
  });

  it("generates diagonal down patterns (dnDiag)", () => {
    const svg = getPatternSvg("dnDiag", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<line");
    expect(svg).toContain('stroke-width="2"');
  });

  it("generates diagonal up patterns (upDiag)", () => {
    const svg = getPatternSvg("upDiag", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<line");
    expect(svg).toContain('stroke-width="2"');
  });

  it("generates cross pattern", () => {
    const svg = getPatternSvg("cross", fg, bg);
    expect(svg).not.toBeNull();
    // Cross should have both horizontal and vertical rects
    expect(svg).toContain(fg);
  });

  it("generates small check pattern (smCheck)", () => {
    const svg = getPatternSvg("smCheck", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('width="4"');
    expect(svg).toContain('height="4"');
  });

  it("generates large check pattern (lgCheck)", () => {
    const svg = getPatternSvg("lgCheck", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('width="8"');
    expect(svg).toContain('height="8"');
  });

  it("generates diagCross pattern with multiple lines", () => {
    const svg = getPatternSvg("diagCross", fg, bg);
    expect(svg).not.toBeNull();
    // diagCross should have 6 lines
    const lineCount = (svg!.match(/<line /g) || []).length;
    expect(lineCount).toBe(6);
  });

  it("generates small grid pattern (smGrid)", () => {
    const svg = getPatternSvg("smGrid", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain(fg);
    expect(svg).toContain(bg);
  });

  it("generates sphere pattern with circles", () => {
    const svg = getPatternSvg("sphere", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<circle");
  });

  it("generates wave pattern with path", () => {
    const svg = getPatternSvg("wave", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<path");
  });

  it("generates solidDmnd pattern with polygon", () => {
    const svg = getPatternSvg("solidDmnd", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<polygon");
  });

  it("generates zigZag pattern with two paths", () => {
    const svg = getPatternSvg("zigZag", fg, bg);
    expect(svg).not.toBeNull();
    const pathCount = (svg!.match(/<path /g) || []).length;
    expect(pathCount).toBe(2);
  });

  it("generates dashHorz pattern", () => {
    const svg = getPatternSvg("dashHorz", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('height="4"');
  });

  it("generates dashVert pattern", () => {
    const svg = getPatternSvg("dashVert", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('width="4"');
  });

  it("uses correct foreground and background colours in all patterns", () => {
    const customFg = "#00FF00";
    const customBg = "#0000FF";
    const svg = getPatternSvg("pct10", customFg, customBg);
    expect(svg).not.toBeNull();
    expect(svg).toContain(customFg);
    expect(svg).toContain(customBg);
  });

  it("generates wider diagonal patterns (wdDnDiag) with 12x12 tile", () => {
    const svg = getPatternSvg("wdDnDiag", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('width="12"');
    expect(svg).toContain('height="12"');
    expect(svg).toContain('stroke-width="4"');
  });

  it("generates dashed diagonal pattern (dashDnDiag) with stroke-dasharray", () => {
    const svg = getPatternSvg("dashDnDiag", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('stroke-dasharray="4,4"');
  });

  it("generates trellis pattern with 4x4 tile", () => {
    const svg = getPatternSvg("trellis", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('width="4"');
    expect(svg).toContain('height="4"');
  });

  it("generates pct90 as an inverted pattern (mostly fg)", () => {
    const svg = getPatternSvg("pct90", fg, bg);
    expect(svg).not.toBeNull();
    // pct90 fills with fg first, then adds small bg rect
    expect(svg).toContain(fg);
    expect(svg).toContain(bg);
  });
});
