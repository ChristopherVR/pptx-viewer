/**
 * Tests for PptxHandlerRuntimeSaveTableStyles:
 *   - writeTableCellText logic (cell text writing with style preservation)
 *   - writeTableCellStyle logic (fill, alignment, borders, margins)
 */
import { describe, it, expect } from "vitest";

import type { XmlObject, PptxTableCellStyle } from "../../types";
import {
  writeCellFill,
  writeDiagonalBorders,
  writeCellTextFormatting,
} from "./table-cell-save-helpers";

const EMU_PER_PX = 9525;

function ensureArray(value: unknown): XmlObject[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as XmlObject[];
  return [value as XmlObject];
}

// ---------------------------------------------------------------------------
// Reimplemented: writeTableCellText
// ---------------------------------------------------------------------------
function writeTableCellText(xmlCell: XmlObject, text: string): void {
  if (!xmlCell["a:txBody"]) {
    xmlCell["a:txBody"] = { "a:bodyPr": {}, "a:p": {} };
  }
  const txBody = xmlCell["a:txBody"] as XmlObject;
  if (!txBody["a:bodyPr"]) txBody["a:bodyPr"] = {};

  const existingParagraphs = ensureArray(txBody["a:p"]);
  const firstRPr = ensureArray(existingParagraphs[0]?.["a:r"])[0]?.[
    "a:rPr"
  ];
  const firstPPr = existingParagraphs[0]?.["a:pPr"];

  const lines = text.split("\n");
  const paragraphs = lines.map((line) => {
    const paragraph: XmlObject = {};
    if (firstPPr) paragraph["a:pPr"] = firstPPr;
    paragraph["a:r"] = {
      ...(firstRPr ? { "a:rPr": firstRPr } : {}),
      "a:t": line,
    };
    return paragraph;
  });

  txBody["a:p"] = paragraphs.length === 1 ? paragraphs[0] : paragraphs;
}

// ---------------------------------------------------------------------------
// Reimplemented: writeTableCellStyle (partial — for testable portions)
// ---------------------------------------------------------------------------
function writeTableCellStyle(
  xmlCell: XmlObject,
  style: PptxTableCellStyle,
): void {
  if (!xmlCell["a:tcPr"]) xmlCell["a:tcPr"] = {};
  const tcPr = xmlCell["a:tcPr"] as XmlObject;

  // Background fill
  writeCellFill(tcPr, style);

  // Vertical alignment
  if (style.vAlign) {
    const vAlignMap: Record<string, string> = {
      top: "t",
      middle: "ctr",
      bottom: "b",
    };
    tcPr["@_anchor"] = vAlignMap[style.vAlign] || "t";
  }

  // Text direction
  if (style.textDirection) {
    tcPr["@_vert"] =
      style.textDirection === "vertical" ? "vert" : "vert270";
  }

  // Text alignment
  if (style.align) {
    const firstP = ensureArray(xmlCell["a:txBody"]?.["a:p"])[0];
    if (firstP) {
      if (!firstP["a:pPr"]) firstP["a:pPr"] = {};
      const alignMap: Record<string, string> = {
        left: "l",
        center: "ctr",
        right: "r",
        justify: "just",
      };
      firstP["a:pPr"]["@_algn"] = alignMap[style.align] || "l";
    }
  }

  // Per-edge borders
  const borderEdges = [
    {
      xmlKey: "a:lnT",
      width: style.borderTopWidth,
      color: style.borderTopColor,
      dash: style.borderTopDash,
    },
    {
      xmlKey: "a:lnB",
      width: style.borderBottomWidth,
      color: style.borderBottomColor,
      dash: style.borderBottomDash,
    },
    {
      xmlKey: "a:lnL",
      width: style.borderLeftWidth,
      color: style.borderLeftColor,
      dash: style.borderLeftDash,
    },
    {
      xmlKey: "a:lnR",
      width: style.borderRightWidth,
      color: style.borderRightColor,
      dash: style.borderRightDash,
    },
  ] as const;

  for (const edge of borderEdges) {
    if (edge.width !== undefined || edge.color !== undefined || edge.dash !== undefined) {
      if (!tcPr[edge.xmlKey]) tcPr[edge.xmlKey] = {};
      const ln = tcPr[edge.xmlKey] as XmlObject;
      if (edge.width !== undefined) {
        ln["@_w"] = String(Math.round(edge.width * EMU_PER_PX));
      }
      if (edge.color) {
        ln["a:solidFill"] = {
          "a:srgbClr": { "@_val": edge.color.replace("#", "") },
        };
      }
      if (edge.dash && edge.dash !== "solid") {
        ln["a:prstDash"] = { "@_val": edge.dash };
      } else if (edge.dash === "solid") {
        delete ln["a:prstDash"];
      }
    }
  }

  // Cell margins
  if (
    style.marginLeft !== undefined ||
    style.marginRight !== undefined ||
    style.marginTop !== undefined ||
    style.marginBottom !== undefined
  ) {
    if (!tcPr["a:tcMar"]) tcPr["a:tcMar"] = {};
    const tcMar = tcPr["a:tcMar"] as XmlObject;
    if (style.marginLeft !== undefined) {
      tcMar["a:marL"] = { "@_w": String(Math.round(style.marginLeft * EMU_PER_PX)) };
    }
    if (style.marginRight !== undefined) {
      tcMar["a:marR"] = { "@_w": String(Math.round(style.marginRight * EMU_PER_PX)) };
    }
    if (style.marginTop !== undefined) {
      tcMar["a:marT"] = { "@_w": String(Math.round(style.marginTop * EMU_PER_PX)) };
    }
    if (style.marginBottom !== undefined) {
      tcMar["a:marB"] = { "@_w": String(Math.round(style.marginBottom * EMU_PER_PX)) };
    }
  }

  // Diagonal borders
  writeDiagonalBorders(tcPr, style, EMU_PER_PX);

  // Font properties
  writeCellTextFormatting(xmlCell, style, ensureArray);
}

// ---------------------------------------------------------------------------
// Tests: writeTableCellText
// ---------------------------------------------------------------------------
describe("writeTableCellText", () => {
  it("should create txBody when missing", () => {
    const cell: XmlObject = {};
    writeTableCellText(cell, "Hello");
    expect(cell["a:txBody"]).toBeDefined();
    const txBody = cell["a:txBody"] as XmlObject;
    expect(txBody["a:bodyPr"]).toBeDefined();
  });

  it("should write single line as a single paragraph object", () => {
    const cell: XmlObject = {};
    writeTableCellText(cell, "Hello");
    const txBody = cell["a:txBody"] as XmlObject;
    const p = txBody["a:p"] as XmlObject;
    expect(Array.isArray(p)).toBe(false);
    expect((p["a:r"] as XmlObject)["a:t"]).toBe("Hello");
  });

  it("should write multiline as array of paragraphs", () => {
    const cell: XmlObject = {};
    writeTableCellText(cell, "Line1\nLine2\nLine3");
    const txBody = cell["a:txBody"] as XmlObject;
    const paragraphs = txBody["a:p"] as XmlObject[];
    expect(paragraphs).toHaveLength(3);
    expect((paragraphs[0]["a:r"] as XmlObject)["a:t"]).toBe("Line1");
    expect((paragraphs[2]["a:r"] as XmlObject)["a:t"]).toBe("Line3");
  });

  it("should preserve existing run properties", () => {
    const cell: XmlObject = {
      "a:txBody": {
        "a:bodyPr": {},
        "a:p": {
          "a:r": {
            "a:rPr": { "@_b": "1", "@_sz": "1200" },
            "a:t": "Old text",
          },
        },
      },
    };
    writeTableCellText(cell, "New text");
    const txBody = cell["a:txBody"] as XmlObject;
    const p = txBody["a:p"] as XmlObject;
    const rPr = (p["a:r"] as XmlObject)["a:rPr"] as XmlObject;
    expect(rPr["@_b"]).toBe("1");
    expect(rPr["@_sz"]).toBe("1200");
  });

  it("should preserve existing paragraph properties", () => {
    const cell: XmlObject = {
      "a:txBody": {
        "a:bodyPr": {},
        "a:p": {
          "a:pPr": { "@_algn": "ctr" },
          "a:r": { "a:t": "Old" },
        },
      },
    };
    writeTableCellText(cell, "New");
    const txBody = cell["a:txBody"] as XmlObject;
    const p = txBody["a:p"] as XmlObject;
    expect(p["a:pPr"]).toBeDefined();
    expect((p["a:pPr"] as XmlObject)["@_algn"]).toBe("ctr");
  });
});

// ---------------------------------------------------------------------------
// Tests: writeTableCellStyle
// ---------------------------------------------------------------------------
describe("writeTableCellStyle", () => {
  it("should set vertical alignment", () => {
    const cell: XmlObject = {};
    writeTableCellStyle(cell, { vAlign: "middle" });
    expect((cell["a:tcPr"] as XmlObject)["@_anchor"]).toBe("ctr");
  });

  it("should set bottom vertical alignment", () => {
    const cell: XmlObject = {};
    writeTableCellStyle(cell, { vAlign: "bottom" });
    expect((cell["a:tcPr"] as XmlObject)["@_anchor"]).toBe("b");
  });

  it("should set text direction for vertical", () => {
    const cell: XmlObject = {};
    writeTableCellStyle(cell, { textDirection: "vertical" });
    expect((cell["a:tcPr"] as XmlObject)["@_vert"]).toBe("vert");
  });

  it("should set text direction for vertical270", () => {
    const cell: XmlObject = {};
    writeTableCellStyle(cell, { textDirection: "vertical270" });
    expect((cell["a:tcPr"] as XmlObject)["@_vert"]).toBe("vert270");
  });

  it("should set text alignment on first paragraph", () => {
    const cell: XmlObject = {
      "a:txBody": {
        "a:p": { "a:r": { "a:t": "text" } },
      },
    };
    writeTableCellStyle(cell, { align: "center" });
    const firstP = (cell["a:txBody"] as XmlObject)["a:p"] as XmlObject;
    expect((firstP["a:pPr"] as XmlObject)["@_algn"]).toBe("ctr");
  });

  it("should set top border width and color", () => {
    const cell: XmlObject = {};
    writeTableCellStyle(cell, {
      borderTopWidth: 2,
      borderTopColor: "#FF0000",
    });
    const tcPr = cell["a:tcPr"] as XmlObject;
    const lnT = tcPr["a:lnT"] as XmlObject;
    expect(lnT["@_w"]).toBe(String(Math.round(2 * EMU_PER_PX)));
    expect(
      ((lnT["a:solidFill"] as XmlObject)["a:srgbClr"] as XmlObject)["@_val"],
    ).toBe("FF0000");
  });

  it("should set border dash style", () => {
    const cell: XmlObject = {};
    writeTableCellStyle(cell, { borderLeftDash: "dash" });
    const tcPr = cell["a:tcPr"] as XmlObject;
    const lnL = tcPr["a:lnL"] as XmlObject;
    expect((lnL["a:prstDash"] as XmlObject)["@_val"]).toBe("dash");
  });

  it("should remove prstDash for solid border style", () => {
    const cell: XmlObject = {
      "a:tcPr": { "a:lnR": { "a:prstDash": { "@_val": "dash" } } },
    };
    writeTableCellStyle(cell, { borderRightDash: "solid" });
    const tcPr = cell["a:tcPr"] as XmlObject;
    expect((tcPr["a:lnR"] as XmlObject)["a:prstDash"]).toBeUndefined();
  });

  it("should set cell margins", () => {
    const cell: XmlObject = {};
    writeTableCellStyle(cell, {
      marginLeft: 10,
      marginRight: 5,
      marginTop: 8,
      marginBottom: 12,
    });
    const tcMar = (cell["a:tcPr"] as XmlObject)["a:tcMar"] as XmlObject;
    expect((tcMar["a:marL"] as XmlObject)["@_w"]).toBe(
      String(Math.round(10 * EMU_PER_PX)),
    );
    expect((tcMar["a:marR"] as XmlObject)["@_w"]).toBe(
      String(Math.round(5 * EMU_PER_PX)),
    );
    expect((tcMar["a:marT"] as XmlObject)["@_w"]).toBe(
      String(Math.round(8 * EMU_PER_PX)),
    );
    expect((tcMar["a:marB"] as XmlObject)["@_w"]).toBe(
      String(Math.round(12 * EMU_PER_PX)),
    );
  });

  it("should set solid fill from backgroundColor", () => {
    const cell: XmlObject = {};
    writeTableCellStyle(cell, { backgroundColor: "#00FF00" });
    const tcPr = cell["a:tcPr"] as XmlObject;
    expect(
      ((tcPr["a:solidFill"] as XmlObject)["a:srgbClr"] as XmlObject)["@_val"],
    ).toBe("00FF00");
  });

  it("should remove fill when fillMode is none", () => {
    const cell: XmlObject = {
      "a:tcPr": {
        "a:solidFill": { "a:srgbClr": { "@_val": "FF0000" } },
      },
    };
    writeTableCellStyle(cell, { fillMode: "none" });
    const tcPr = cell["a:tcPr"] as XmlObject;
    expect(tcPr["a:solidFill"]).toBeUndefined();
  });

  it("should set diagonal down border", () => {
    const cell: XmlObject = {};
    writeTableCellStyle(cell, {
      borderDiagDownWidth: 3,
      borderDiagDownColor: "#0000FF",
    });
    const tcPr = cell["a:tcPr"] as XmlObject;
    const diag = tcPr["a:lnTlToBr"] as XmlObject;
    expect(diag["@_w"]).toBe(String(Math.round(3 * EMU_PER_PX)));
  });

  it("should apply font formatting to existing runs", () => {
    const cell: XmlObject = {
      "a:txBody": {
        "a:p": {
          "a:r": { "a:rPr": {}, "a:t": "text" },
        },
      },
    };
    writeTableCellStyle(cell, { bold: true, fontSize: 14, color: "#333333" });
    const run = (
      (cell["a:txBody"] as XmlObject)["a:p"] as XmlObject
    )["a:r"] as XmlObject;
    const rPr = run["a:rPr"] as XmlObject;
    expect(rPr["@_b"]).toBe("1");
    expect(rPr["@_sz"]).toBe(String(14 * 100));
  });
});
