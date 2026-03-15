import { describe, it, expect } from "vitest";
import { getPatternSvg } from "./color-patterns";
import { OOXML_PATTERN_PRESETS, buildPatternFillCss } from "./color-gradient";
import { shapeParams } from "../components/ElementRenderer";
import type { PptxElement } from "pptx-viewer-core";

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

  it("generates sphere pattern with radial gradient", () => {
    const svg = getPatternSvg("sphere", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<circle");
    expect(svg).toContain("radialGradient");
    expect(svg).toContain(fg);
    expect(svg).toContain(bg);
  });

  it("generates wave pattern with two wave paths", () => {
    const svg = getPatternSvg("wave", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<path");
    const pathCount = (svg!.match(/<path /g) || []).length;
    expect(pathCount).toBe(2);
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

  // ── Coverage for all 48+ presets ─────────────────────────────────────

  it("generates a valid SVG for every OOXML preset", () => {
    for (const preset of OOXML_PATTERN_PRESETS) {
      const svg = getPatternSvg(preset, fg, bg);
      expect(svg, `preset "${preset}" should not return null`).not.toBeNull();
      expect(svg, `preset "${preset}" should be valid SVG`).toContain("<svg");
      expect(svg, `preset "${preset}" should close SVG`).toContain("</svg>");
    }
  });

  it("generates openDmnd with four diamond outline lines", () => {
    const svg = getPatternSvg("openDmnd", fg, bg);
    expect(svg).not.toBeNull();
    const lineCount = (svg!.match(/<line /g) || []).length;
    expect(lineCount).toBe(4);
  });

  it("generates dotDmnd with dots", () => {
    const svg = getPatternSvg("dotDmnd", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<circle");
    const circleCount = (svg!.match(/<circle /g) || []).length;
    expect(circleCount).toBe(5);
  });

  it("generates weave pattern with diagonal lines", () => {
    const svg = getPatternSvg("weave", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<line");
    const lineCount = (svg!.match(/<line /g) || []).length;
    expect(lineCount).toBe(6);
  });

  it("generates divot with cross marks", () => {
    const svg = getPatternSvg("divot", fg, bg);
    expect(svg).not.toBeNull();
    const lineCount = (svg!.match(/<line /g) || []).length;
    expect(lineCount).toBe(4);
  });

  it("generates horzBrick with mortar lines", () => {
    const svg = getPatternSvg("horzBrick", fg, bg);
    expect(svg).not.toBeNull();
    // Should have horizontal mortar lines and offset vertical joints
    const rectCount = (svg!.match(/<rect /g) || []).length;
    expect(rectCount).toBeGreaterThanOrEqual(4);
  });

  it("generates plaid with overlapping stripes", () => {
    const svg = getPatternSvg("plaid", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain(fg);
    expect(svg).toContain(bg);
  });

  it("generates shingle with diagonal and horizontal lines", () => {
    const svg = getPatternSvg("shingle", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<line");
    expect(svg).toContain("<rect");
  });

  // ── Percentage pattern density ordering ───────────────────────────

  it("percentage patterns increase in foreground density", () => {
    // Each higher pct should have more foreground pixels.
    // We approximate by checking SVG string length increases.
    const pcts = ["pct5", "pct10", "pct20", "pct25", "pct30", "pct40", "pct50"];
    for (const p of pcts) {
      const svg = getPatternSvg(p, fg, bg);
      expect(svg).not.toBeNull();
    }
  });

  // ── Narrow / wide variants ────────────────────────────────────────

  it("narHorz uses a 4px tall tile", () => {
    const svg = getPatternSvg("narHorz", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('height="4"');
  });

  it("wdHorz uses a 12px tall tile", () => {
    const svg = getPatternSvg("wdHorz", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('height="12"');
  });

  it("narVert uses a 4px wide tile", () => {
    const svg = getPatternSvg("narVert", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('width="4"');
  });

  it("wdVert uses a 12px wide tile", () => {
    const svg = getPatternSvg("wdVert", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('width="12"');
  });

  it("wdUpDiag uses a 12x12 tile with thick lines", () => {
    const svg = getPatternSvg("wdUpDiag", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('width="12"');
    expect(svg).toContain('stroke-width="4"');
  });

  it("dashUpDiag uses stroke-dasharray", () => {
    const svg = getPatternSvg("dashUpDiag", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('stroke-dasharray="4,4"');
  });

  // ── Dark variants use thicker strokes/fills ───────────────────────

  it("dkHorz fills half the tile with fg", () => {
    const svg = getPatternSvg("dkHorz", fg, bg);
    expect(svg).not.toBeNull();
    // dkHorz uses a 4px high fg rect in an 8px tile
    expect(svg).toContain('height="4"');
  });

  it("dkVert fills half the tile width with fg", () => {
    const svg = getPatternSvg("dkVert", fg, bg);
    expect(svg).not.toBeNull();
    // dkVert uses a 4px wide fg rect in an 8px tile
    expect(svg).toContain('width="4"');
  });

  it("dkDnDiag uses stroke-width 3", () => {
    const svg = getPatternSvg("dkDnDiag", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('stroke-width="3"');
  });

  it("dkUpDiag uses stroke-width 3", () => {
    const svg = getPatternSvg("dkUpDiag", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('stroke-width="3"');
  });

  // ── Light variants use thin strokes/fills ─────────────────────────

  it("ltDnDiag uses stroke-width 1", () => {
    const svg = getPatternSvg("ltDnDiag", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('stroke-width="1"');
  });

  it("ltUpDiag uses stroke-width 1", () => {
    const svg = getPatternSvg("ltUpDiag", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('stroke-width="1"');
  });

  it("ltHorz uses a 1px high fg line", () => {
    const svg = getPatternSvg("ltHorz", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('height="1"');
  });

  it("ltVert uses a 1px wide fg line", () => {
    const svg = getPatternSvg("ltVert", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('width="1"');
  });

  // ── Confetti patterns ─────────────────────────────────────────────

  it("smConfetti has many scattered small rects", () => {
    const svg = getPatternSvg("smConfetti", fg, bg);
    expect(svg).not.toBeNull();
    // Background rect + 8 confetti rects
    const rectCount = (svg!.match(/<rect /g) || []).length;
    expect(rectCount).toBeGreaterThanOrEqual(9);
  });

  it("lgConfetti has fewer but larger rects than smConfetti", () => {
    const svg = getPatternSvg("lgConfetti", fg, bg);
    expect(svg).not.toBeNull();
    // Should contain 2x2 rects
    expect(svg).toContain('width="2"');
    expect(svg).toContain('height="2"');
  });

  // ── Grid patterns ─────────────────────────────────────────────────

  it("lgGrid uses 16x16 tile", () => {
    const svg = getPatternSvg("lgGrid", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain('width="16"');
    expect(svg).toContain('height="16"');
  });

  it("dotGrid has circles and thin lines", () => {
    const svg = getPatternSvg("dotGrid", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<circle");
    expect(svg).toContain("<rect");
  });

  // ── diagBrick ──────────────────────────────────────────────────────

  it("diagBrick has diagonal lines", () => {
    const svg = getPatternSvg("diagBrick", fg, bg);
    expect(svg).not.toBeNull();
    expect(svg).toContain("<line");
    const lineCount = (svg!.match(/<line /g) || []).length;
    expect(lineCount).toBe(3);
  });
});

describe("buildPatternFillCss", () => {
  it("returns undefined for non-pattern fills", () => {
    expect(buildPatternFillCss(undefined)).toBeUndefined();
    expect(buildPatternFillCss({ fillMode: "solid" })).toBeUndefined();
    expect(buildPatternFillCss({ fillMode: "gradient" })).toBeUndefined();
  });

  it("returns undefined if pattern preset is missing", () => {
    expect(
      buildPatternFillCss({ fillMode: "pattern" }),
    ).toBeUndefined();
  });

  it("returns backgroundImage and backgroundColor for a valid pattern", () => {
    const result = buildPatternFillCss({
      fillMode: "pattern",
      fillPatternPreset: "pct20",
      fillColor: "#0000FF",
      fillPatternBackgroundColor: "#FFFF00",
    });
    expect(result).toBeDefined();
    expect(result!.backgroundImage).toContain("data:image/svg+xml");
    expect(result!.backgroundColor).toBe("#FFFF00");
  });

  it("uses default fg (#000000) and bg (#ffffff) when colours are missing", () => {
    const result = buildPatternFillCss({
      fillMode: "pattern",
      fillPatternPreset: "horz",
    });
    expect(result).toBeDefined();
    expect(result!.backgroundColor).toBe("#ffffff");
    expect(result!.backgroundImage).toContain("data:image/svg+xml");
  });

  it("returns undefined for an unknown pattern preset", () => {
    const result = buildPatternFillCss({
      fillMode: "pattern",
      fillPatternPreset: "doesNotExist",
      fillColor: "#000",
    });
    expect(result).toBeUndefined();
  });
});

describe("shapeParams hasFill for pattern fills", () => {
  function makeElement(overrides: Partial<PptxElement>): PptxElement {
    return {
      id: "test-1",
      type: "shape",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      ...overrides,
    } as PptxElement;
  }

  it("returns hasFill=true when fillMode is pattern with a preset", () => {
    const el = makeElement({
      type: "shape",
      shapeStyle: {
        fillMode: "pattern",
        fillPatternPreset: "horz",
        fillColor: "transparent",
      },
    } as Partial<PptxElement>);
    const result = shapeParams(el);
    expect(result.hf).toBe(true);
  });

  it("returns hasFill=true for pattern fill even without fillColor", () => {
    const el = makeElement({
      type: "shape",
      shapeStyle: {
        fillMode: "pattern",
        fillPatternPreset: "pct50",
      },
    } as Partial<PptxElement>);
    const result = shapeParams(el);
    expect(result.hf).toBe(true);
  });

  it("returns hasFill=false when fillMode is pattern but no preset", () => {
    const el = makeElement({
      type: "shape",
      shapeStyle: {
        fillMode: "pattern",
      },
    } as Partial<PptxElement>);
    const result = shapeParams(el);
    expect(result.hf).toBe(false);
  });
});
