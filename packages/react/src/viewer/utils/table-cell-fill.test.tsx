import { describe, it, expect } from "vitest";
import {
  parseGradientFillCss,
  parsePatternFillCss,
  parseCellBorders,
  parseCellTextEffects,
} from "./table-cell-fill";

// ── parseGradientFillCss ──────────────────────────────────────────────

describe("parseGradientFillCss", () => {
  it("returns undefined for undefined input", () => {
    expect(parseGradientFillCss(undefined)).toBeUndefined();
  });

  it("returns undefined when gsLst is missing", () => {
    expect(parseGradientFillCss({})).toBeUndefined();
  });

  it("returns undefined when gs array is empty", () => {
    expect(parseGradientFillCss({ "a:gsLst": {} })).toBeUndefined();
  });

  it("produces a linear gradient with a:lin angle", () => {
    const gradFill = {
      "a:gsLst": {
        "a:gs": [
          {
            "@_pos": "0",
            "a:srgbClr": { "@_val": "FF0000" },
          },
          {
            "@_pos": "100000",
            "a:srgbClr": { "@_val": "0000FF" },
          },
        ],
      },
      "a:lin": { "@_ang": "5400000" }, // 90 degrees
    };
    const result = parseGradientFillCss(gradFill);
    expect(result).toBeDefined();
    expect(result).toContain("linear-gradient(90deg");
    expect(result).toContain("0.0%");
    expect(result).toContain("100.0%");
  });

  it("produces a radial gradient for a:path with circle", () => {
    const gradFill = {
      "a:gsLst": {
        "a:gs": [
          {
            "@_pos": "0",
            "a:srgbClr": { "@_val": "FFFFFF" },
          },
          {
            "@_pos": "100000",
            "a:srgbClr": { "@_val": "000000" },
          },
        ],
      },
      "a:path": { "@_path": "circle" },
    };
    const result = parseGradientFillCss(gradFill);
    expect(result).toBeDefined();
    expect(result).toContain("radial-gradient(circle");
  });

  it("produces a radial ellipse for a:path with rect", () => {
    const gradFill = {
      "a:gsLst": {
        "a:gs": {
          "@_pos": "50000",
          "a:srgbClr": { "@_val": "00FF00" },
        },
      },
      "a:path": { "@_path": "rect" },
    };
    const result = parseGradientFillCss(gradFill);
    expect(result).toBeDefined();
    expect(result).toContain("radial-gradient(ellipse");
  });

  it("defaults to 180deg linear when no a:lin or a:path", () => {
    const gradFill = {
      "a:gsLst": {
        "a:gs": {
          "@_pos": "0",
          "a:srgbClr": { "@_val": "AABBCC" },
        },
      },
    };
    const result = parseGradientFillCss(gradFill);
    expect(result).toBeDefined();
    expect(result).toContain("linear-gradient(180deg");
  });

  it("sorts gradient stops by position", () => {
    const gradFill = {
      "a:gsLst": {
        "a:gs": [
          {
            "@_pos": "100000",
            "a:srgbClr": { "@_val": "0000FF" },
          },
          {
            "@_pos": "0",
            "a:srgbClr": { "@_val": "FF0000" },
          },
        ],
      },
      "a:lin": { "@_ang": "0" },
    };
    const result = parseGradientFillCss(gradFill);
    expect(result).toBeDefined();
    // First stop should be at 0%, second at 100%
    const stopPattern = /(\d+\.\d+)%/g;
    const positions: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = stopPattern.exec(result!)) !== null) {
      positions.push(parseFloat(match[1]));
    }
    expect(positions[0]).toBeLessThan(positions[1]);
  });
});

// ── parsePatternFillCss ───────────────────────────────────────────────

describe("parsePatternFillCss", () => {
  it("returns undefined for undefined input", () => {
    expect(parsePatternFillCss(undefined)).toBeUndefined();
  });

  it("returns a repeating-linear-gradient for horizontal patterns", () => {
    const pattFill = {
      "@_prst": "ltHorz",
      "a:fgClr": { "a:srgbClr": { "@_val": "000000" } },
      "a:bgClr": { "a:srgbClr": { "@_val": "FFFFFF" } },
    };
    const result = parsePatternFillCss(pattFill);
    expect(result).toBeDefined();
    expect(result).toContain("repeating-linear-gradient(0deg");
  });

  it("returns 90deg gradient for vertical patterns", () => {
    const pattFill = {
      "@_prst": "ltVert",
      "a:fgClr": { "a:srgbClr": { "@_val": "000000" } },
      "a:bgClr": { "a:srgbClr": { "@_val": "FFFFFF" } },
    };
    const result = parsePatternFillCss(pattFill);
    expect(result).toContain("repeating-linear-gradient(90deg");
  });

  it("returns 135deg gradient for diagonal-down patterns", () => {
    const pattFill = { "@_prst": "dnDiag" };
    const result = parsePatternFillCss(pattFill);
    expect(result).toContain("repeating-linear-gradient(135deg");
  });

  it("returns 45deg gradient for diagonal-up patterns", () => {
    const pattFill = { "@_prst": "upDiag" };
    const result = parsePatternFillCss(pattFill);
    expect(result).toContain("repeating-linear-gradient(45deg");
  });

  it("returns a repeating-conic-gradient for check patterns", () => {
    const pattFill = { "@_prst": "smCheck" };
    const result = parsePatternFillCss(pattFill);
    expect(result).toContain("repeating-conic-gradient");
  });

  it("returns a radial-gradient for dot/percent patterns", () => {
    const pattFill = { "@_prst": "pct50" };
    const result = parsePatternFillCss(pattFill);
    expect(result).toContain("radial-gradient");
  });

  it("returns a grid background for grid patterns", () => {
    const pattFill = { "@_prst": "smGrid" };
    const result = parsePatternFillCss(pattFill);
    expect(result).toContain("repeating-linear-gradient(0deg");
    expect(result).toContain("repeating-linear-gradient(90deg");
  });

  it("uses default fallback for unknown preset", () => {
    const pattFill = { "@_prst": "unknownPreset" };
    const result = parsePatternFillCss(pattFill);
    expect(result).toContain("repeating-linear-gradient(135deg");
  });

  it("falls back to ltDnDiag when no preset is specified", () => {
    const pattFill = {};
    const result = parsePatternFillCss(pattFill);
    expect(result).toContain("repeating-linear-gradient(135deg");
  });
});

// ── parseCellBorders ──────────────────────────────────────────────────

describe("parseCellBorders", () => {
  it("returns empty object for undefined input", () => {
    expect(parseCellBorders(undefined)).toEqual({});
  });

  it("returns empty object when no border line elements exist", () => {
    expect(parseCellBorders({})).toEqual({});
  });

  it("parses a left border with solid fill", () => {
    const cellProps = {
      "a:lnL": {
        "@_w": "12700", // 1 pt = 1 px
        "a:solidFill": {
          "a:srgbClr": { "@_val": "FF0000" },
        },
      },
    };
    const result = parseCellBorders(cellProps);
    expect(result.borderLeft).toBeDefined();
    expect(result.borderLeft).toContain("1px");
    expect(result.borderLeft).toContain("solid");
  });

  it("parses multiple borders", () => {
    const cellProps = {
      "a:lnL": {
        "@_w": "12700",
        "a:solidFill": { "a:srgbClr": { "@_val": "FF0000" } },
      },
      "a:lnR": {
        "@_w": "25400",
        "a:solidFill": { "a:srgbClr": { "@_val": "00FF00" } },
      },
      "a:lnT": {
        "@_w": "38100",
        "a:solidFill": { "a:srgbClr": { "@_val": "0000FF" } },
      },
      "a:lnB": {
        "@_w": "12700",
        "a:solidFill": { "a:srgbClr": { "@_val": "FFFF00" } },
      },
    };
    const result = parseCellBorders(cellProps);
    expect(result.borderLeft).toBeDefined();
    expect(result.borderRight).toBeDefined();
    expect(result.borderTop).toBeDefined();
    expect(result.borderBottom).toBeDefined();
  });

  it("ignores borders without solid fill color", () => {
    const cellProps = {
      "a:lnL": { "@_w": "12700" }, // no solidFill
    };
    const result = parseCellBorders(cellProps);
    expect(result.borderLeft).toBeUndefined();
  });

  it("applies dashed style from prstDash", () => {
    const cellProps = {
      "a:lnT": {
        "@_w": "12700",
        "a:prstDash": { "@_val": "dash" },
        "a:solidFill": { "a:srgbClr": { "@_val": "000000" } },
      },
    };
    const result = parseCellBorders(cellProps);
    expect(result.borderTop).toContain("dashed");
  });

  it("applies dotted style from prstDash", () => {
    const cellProps = {
      "a:lnB": {
        "@_w": "12700",
        "a:prstDash": { "@_val": "dot" },
        "a:solidFill": { "a:srgbClr": { "@_val": "000000" } },
      },
    };
    const result = parseCellBorders(cellProps);
    expect(result.borderBottom).toContain("dotted");
  });

  it("clamps width to minimum 1px", () => {
    const cellProps = {
      "a:lnL": {
        "@_w": "0",
        "a:solidFill": { "a:srgbClr": { "@_val": "000000" } },
      },
    };
    const result = parseCellBorders(cellProps);
    expect(result.borderLeft).toContain("1px");
  });
});

// ── parseCellTextEffects ──────────────────────────────────────────────

describe("parseCellTextEffects", () => {
  it("returns undefined for undefined input", () => {
    expect(parseCellTextEffects(undefined)).toBeUndefined();
  });

  it("returns undefined when no effectLst", () => {
    expect(parseCellTextEffects({})).toBeUndefined();
  });

  it("returns undefined for an empty effectLst", () => {
    expect(parseCellTextEffects({ "a:effectLst": {} })).toBeUndefined();
  });

  it("parses an outer shadow effect", () => {
    const runProps = {
      "a:effectLst": {
        "a:outerShdw": {
          "@_blurRad": "50800", // ~4px
          "@_dist": "38100",
          "@_dir": "2700000", // 45 degrees
          "a:srgbClr": { "@_val": "000000" },
        },
      },
    };
    const result = parseCellTextEffects(runProps);
    expect(result).toBeDefined();
    expect(result).toContain("px");
    expect(result).toContain("#000000");
  });

  it("parses a glow effect", () => {
    const runProps = {
      "a:effectLst": {
        "a:glow": {
          "@_rad": "63500", // ~5px
          "a:srgbClr": { "@_val": "FFFF00" },
        },
      },
    };
    const result = parseCellTextEffects(runProps);
    expect(result).toBeDefined();
    expect(result).toContain("0px 0px");
    expect(result).toContain("#FFFF00");
  });

  it("combines outer shadow and glow effects", () => {
    const runProps = {
      "a:effectLst": {
        "a:outerShdw": {
          "@_blurRad": "25400",
          "@_dist": "0",
          "@_dir": "0",
          "a:srgbClr": { "@_val": "333333" },
        },
        "a:glow": {
          "@_rad": "25400",
          "a:srgbClr": { "@_val": "FFFF00" },
        },
      },
    };
    const result = parseCellTextEffects(runProps);
    expect(result).toBeDefined();
    // Should contain both shadow and glow, separated by comma
    expect(result!.split(",").length).toBe(2);
  });
});
