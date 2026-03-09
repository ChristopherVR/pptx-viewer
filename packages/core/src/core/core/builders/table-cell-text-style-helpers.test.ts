import { describe, it, expect } from "vitest";
import {
  applyCellAlignmentStyle,
  applyCellTextFormat,
} from "./table-cell-text-style-helpers";
import type { TableCellTextStyleContext } from "./table-cell-text-style-helpers";
import type { PptxTableCellStyle, XmlObject } from "../../types";

function makeContext(
  overrides: Partial<TableCellTextStyleContext> = {},
): TableCellTextStyleContext {
  return {
    emuPerPx: 9525,
    ensureArray: (value: unknown): unknown[] => {
      if (Array.isArray(value)) return value;
      if (value === undefined || value === null) return [];
      return [value];
    },
    parseColor: (colorNode: XmlObject | undefined) => {
      if (!colorNode) return undefined;
      const srgb = colorNode["a:srgbClr"] as XmlObject | undefined;
      if (srgb) return `#${srgb["@_val"]}`;
      return undefined;
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// applyCellAlignmentStyle — vertical alignment
// ---------------------------------------------------------------------------

describe("applyCellAlignmentStyle — vertical alignment", () => {
  it("returns false for undefined cellProperties", () => {
    const style: PptxTableCellStyle = {};
    expect(applyCellAlignmentStyle(undefined, style)).toBe(false);
  });

  it("sets vAlign to top for anchor 't'", () => {
    const style: PptxTableCellStyle = {};
    applyCellAlignmentStyle({ "@_anchor": "t" }, style);
    expect(style.vAlign).toBe("top");
  });

  it("sets vAlign to middle for anchor 'ctr'", () => {
    const style: PptxTableCellStyle = {};
    applyCellAlignmentStyle({ "@_anchor": "ctr" }, style);
    expect(style.vAlign).toBe("middle");
  });

  it("sets vAlign to bottom for anchor 'b'", () => {
    const style: PptxTableCellStyle = {};
    applyCellAlignmentStyle({ "@_anchor": "b" }, style);
    expect(style.vAlign).toBe("bottom");
  });

  it("returns true when anchor is set", () => {
    const style: PptxTableCellStyle = {};
    expect(applyCellAlignmentStyle({ "@_anchor": "ctr" }, style)).toBe(true);
  });

  it("returns false when no relevant properties are present", () => {
    const style: PptxTableCellStyle = {};
    expect(applyCellAlignmentStyle({}, style)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyCellAlignmentStyle — text direction
// ---------------------------------------------------------------------------

describe("applyCellAlignmentStyle — text direction", () => {
  it("sets textDirection to vertical for 'vert'", () => {
    const style: PptxTableCellStyle = {};
    applyCellAlignmentStyle({ "@_vert": "vert" }, style);
    expect(style.textDirection).toBe("vertical");
  });

  it("sets textDirection to vertical for 'eaVert'", () => {
    const style: PptxTableCellStyle = {};
    applyCellAlignmentStyle({ "@_vert": "eaVert" }, style);
    expect(style.textDirection).toBe("vertical");
  });

  it("sets textDirection to vertical for 'wordArtVert'", () => {
    const style: PptxTableCellStyle = {};
    applyCellAlignmentStyle({ "@_vert": "wordArtVert" }, style);
    expect(style.textDirection).toBe("vertical");
  });

  it("sets textDirection to vertical for 'mongolianVert'", () => {
    const style: PptxTableCellStyle = {};
    applyCellAlignmentStyle({ "@_vert": "mongolianVert" }, style);
    expect(style.textDirection).toBe("vertical");
  });

  it("sets textDirection to vertical270 for 'vert270'", () => {
    const style: PptxTableCellStyle = {};
    applyCellAlignmentStyle({ "@_vert": "vert270" }, style);
    expect(style.textDirection).toBe("vertical270");
  });

  it("sets textDirection to vertical270 for 'wordArtVertRtl'", () => {
    const style: PptxTableCellStyle = {};
    applyCellAlignmentStyle({ "@_vert": "wordArtVertRtl" }, style);
    expect(style.textDirection).toBe("vertical270");
  });

  it("does not set textDirection for unrecognized vert value", () => {
    const style: PptxTableCellStyle = {};
    applyCellAlignmentStyle({ "@_vert": "horz" }, style);
    expect(style.textDirection).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// applyCellTextFormat — paragraph alignment
// ---------------------------------------------------------------------------

describe("applyCellTextFormat — paragraph alignment", () => {
  it("sets align to center for 'ctr'", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:pPr": { "@_algn": "ctr" },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    applyCellTextFormat(tableCell, style, makeContext());
    expect(style.align).toBe("center");
  });

  it("sets align to right for 'r'", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:pPr": { "@_algn": "r" },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    applyCellTextFormat(tableCell, style, makeContext());
    expect(style.align).toBe("right");
  });

  it("sets align to justify for 'just'", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:pPr": { "@_algn": "just" },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    applyCellTextFormat(tableCell, style, makeContext());
    expect(style.align).toBe("justify");
  });

  it("returns false when no paragraph is present", () => {
    const tableCell: XmlObject = {};
    const style: PptxTableCellStyle = {};
    expect(applyCellTextFormat(tableCell, style, makeContext())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyCellTextFormat — run properties (bold, italic, font size, color)
// ---------------------------------------------------------------------------

describe("applyCellTextFormat — run properties", () => {
  it("applies bold from run properties", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": { "@_b": "1" },
            "a:t": "Bold text",
          },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    applyCellTextFormat(tableCell, style, makeContext());
    expect(style.bold).toBe(true);
  });

  it("applies italic from run properties", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": { "@_i": "1" },
            "a:t": "Italic text",
          },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    applyCellTextFormat(tableCell, style, makeContext());
    expect(style.italic).toBe(true);
  });

  it("applies underline from run properties", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": { "@_u": "sng" },
            "a:t": "Underline text",
          },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    applyCellTextFormat(tableCell, style, makeContext());
    expect(style.underline).toBe(true);
  });

  it("does not apply underline when value is 'none'", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": { "@_u": "none" },
            "a:t": "Not underlined",
          },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    applyCellTextFormat(tableCell, style, makeContext());
    expect(style.underline).toBeUndefined();
  });

  it("applies font size from run properties (1800 => 18pt)", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": { "@_sz": "1800" },
            "a:t": "Sized text",
          },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    applyCellTextFormat(tableCell, style, makeContext());
    expect(style.fontSize).toBe(18);
  });

  it("applies text color from run properties", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": {
              "a:solidFill": { "a:srgbClr": { "@_val": "FF0000" } },
            },
            "a:t": "Red text",
          },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    applyCellTextFormat(tableCell, style, makeContext());
    expect(style.color).toBe("#FF0000");
  });

  it("applies multiple run properties at once", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": {
              "@_b": "1",
              "@_i": true,
              "@_sz": "2400",
              "a:solidFill": { "a:srgbClr": { "@_val": "0000FF" } },
            },
            "a:t": "Styled text",
          },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    const result = applyCellTextFormat(tableCell, style, makeContext());
    expect(result).toBe(true);
    expect(style.bold).toBe(true);
    expect(style.italic).toBe(true);
    expect(style.fontSize).toBe(24);
    expect(style.color).toBe("#0000FF");
  });
});

// ---------------------------------------------------------------------------
// applyCellTextFormat — text effects (shadow and glow)
// ---------------------------------------------------------------------------

describe("applyCellTextFormat — text effects", () => {
  it("applies text shadow from effect list", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": {
              "a:effectLst": {
                "a:outerShdw": {
                  "@_blurRad": "38100",
                  "@_dist": "19050",
                  "@_dir": "2700000",
                  "a:srgbClr": { "@_val": "000000" },
                },
              },
            },
            "a:t": "Shadow text",
          },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    applyCellTextFormat(tableCell, style, makeContext());
    expect(style.textShadowColor).toBe("#000000");
    // 38100 / 9525 = 4
    expect(style.textShadowBlur).toBe(4);
  });

  it("applies text glow from effect list", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": {
              "a:effectLst": {
                "a:glow": {
                  "@_rad": "57150",
                  "a:srgbClr": { "@_val": "FFFF00" },
                },
              },
            },
            "a:t": "Glowing text",
          },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    applyCellTextFormat(tableCell, style, makeContext());
    expect(style.textGlowColor).toBe("#FFFF00");
    // 57150 / 9525 = 6
    expect(style.textGlowRadius).toBe(6);
  });

  it("returns false when run properties have no effects", () => {
    const tableCell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:r": {
            "a:rPr": {},
            "a:t": "Plain text",
          },
        },
      },
    };
    const style: PptxTableCellStyle = {};
    expect(applyCellTextFormat(tableCell, style, makeContext())).toBe(false);
  });
});
