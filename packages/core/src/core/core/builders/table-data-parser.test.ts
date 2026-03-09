import { describe, it, expect } from "vitest";
import {
  PptxTableDataParser,
  type PptxTableDataParserContext,
} from "./PptxTableDataParser";
import type { XmlObject } from "../../types";

const EMU_PER_PX = 9525;

function makeContext(
  overrides: Partial<PptxTableDataParserContext> = {},
): PptxTableDataParserContext {
  return {
    emuPerPx: EMU_PER_PX,
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

function makeCell(text: string, extra: Record<string, unknown> = {}): XmlObject {
  return {
    "a:txBody": {
      "a:bodyPr": {},
      "a:p": { "a:r": { "a:t": text } },
    },
    "a:tcPr": {},
    ...extra,
  };
}

function makeTableXml(opts: {
  gridCols: string[];
  rows: Array<{ height: string; cells: XmlObject[] }>;
  tblPrAttrs?: Record<string, unknown>;
}): XmlObject {
  const gridCol =
    opts.gridCols.length === 1
      ? { "@_w": opts.gridCols[0] }
      : opts.gridCols.map((w) => ({ "@_w": w }));

  const trs = opts.rows.map((row) => ({
    "@_h": row.height,
    "a:tc": row.cells.length === 1 ? row.cells[0] : row.cells,
  }));

  return {
    "a:tbl": {
      "a:tblPr": opts.tblPrAttrs || {},
      "a:tblGrid": { "a:gridCol": gridCol },
      "a:tr": trs.length === 1 ? trs[0] : trs,
    },
  };
}

// ---------------------------------------------------------------------------
// Grid column widths
// ---------------------------------------------------------------------------

describe("PptxTableDataParser — grid column widths", () => {
  it("computes proportional widths for equal-width columns", () => {
    const graphicData = makeTableXml({
      gridCols: ["3048000", "3048000"],
      rows: [{ height: "370840", cells: [makeCell("A"), makeCell("B")] }],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeDefined();
    expect(result!.columnWidths).toHaveLength(2);
    expect(result!.columnWidths[0]).toBeCloseTo(0.5, 5);
    expect(result!.columnWidths[1]).toBeCloseTo(0.5, 5);
  });

  it("computes proportional widths for unequal columns", () => {
    const graphicData = makeTableXml({
      gridCols: ["2286000", "6858000"],
      rows: [{ height: "370840", cells: [makeCell("A"), makeCell("B")] }],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    // 2286000 / 9144000 = 0.25, 6858000 / 9144000 = 0.75
    expect(result!.columnWidths[0]).toBeCloseTo(0.25, 5);
    expect(result!.columnWidths[1]).toBeCloseTo(0.75, 5);
  });

  it("handles zero-width columns gracefully (equal distribution)", () => {
    const graphicData = makeTableXml({
      gridCols: ["0", "0", "0"],
      rows: [
        {
          height: "370840",
          cells: [makeCell("A"), makeCell("B"), makeCell("C")],
        },
      ],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    // When total width is 0, columns default to 1/N
    expect(result!.columnWidths).toHaveLength(3);
    expect(result!.columnWidths[0]).toBeCloseTo(1 / 3, 5);
  });
});

// ---------------------------------------------------------------------------
// Row heights
// ---------------------------------------------------------------------------

describe("PptxTableDataParser — row heights", () => {
  it("converts row height from EMU to rounded pixels", () => {
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [
        { height: "370840", cells: [makeCell("Row 1")] },
        { height: "914400", cells: [makeCell("Row 2")] },
      ],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[0].height).toBe(Math.round(370840 / EMU_PER_PX));
    expect(result!.rows[1].height).toBe(Math.round(914400 / EMU_PER_PX));
  });

  it("defaults row height to 0 when @_h is missing", () => {
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {},
        "a:tblGrid": { "a:gridCol": { "@_w": "9144000" } },
        "a:tr": {
          "a:tc": makeCell("No height"),
        },
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[0].height).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cell text extraction
// ---------------------------------------------------------------------------

describe("PptxTableDataParser — cell text extraction", () => {
  it("extracts simple cell text", () => {
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [{ height: "370840", cells: [makeCell("Hello")] }],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[0].cells[0].text).toBe("Hello");
  });

  it("concatenates multiple runs within a paragraph", () => {
    const cell: XmlObject = {
      "a:txBody": {
        "a:bodyPr": {},
        "a:p": {
          "a:r": [
            { "a:rPr": { "@_b": "1" }, "a:t": "Bold" },
            { "a:rPr": {}, "a:t": " Normal" },
          ],
        },
      },
      "a:tcPr": {},
    };
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [{ height: "370840", cells: [cell] }],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[0].cells[0].text).toBe("Bold Normal");
  });

  it("joins multiple paragraphs with newline", () => {
    const cell: XmlObject = {
      "a:txBody": {
        "a:bodyPr": {},
        "a:p": [
          { "a:r": { "a:t": "Line 1" } },
          { "a:r": { "a:t": "Line 2" } },
        ],
      },
      "a:tcPr": {},
    };
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [{ height: "370840", cells: [cell] }],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[0].cells[0].text).toBe("Line 1\nLine 2");
  });

  it("includes field text from a:fld elements", () => {
    const cell: XmlObject = {
      "a:txBody": {
        "a:bodyPr": {},
        "a:p": {
          "a:fld": { "@_type": "slidenum", "a:t": "42" },
        },
      },
      "a:tcPr": {},
    };
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [{ height: "370840", cells: [cell] }],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[0].cells[0].text).toBe("42");
  });
});

// ---------------------------------------------------------------------------
// Cell merge detection
// ---------------------------------------------------------------------------

describe("PptxTableDataParser — cell merge detection", () => {
  it("parses gridSpan for horizontal merge", () => {
    const graphicData = makeTableXml({
      gridCols: ["3048000", "3048000", "3048000"],
      rows: [
        {
          height: "370840",
          cells: [
            { ...makeCell("Merged"), "@_gridSpan": "2" },
            { ...makeCell(""), "@_hMerge": "1" },
            makeCell("Normal"),
          ],
        },
      ],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[0].cells[0].gridSpan).toBe(2);
    expect(result!.rows[0].cells[1].hMerge).toBe(true);
    expect(result!.rows[0].cells[2].gridSpan).toBeUndefined();
    expect(result!.rows[0].cells[2].hMerge).toBe(false);
  });

  it("parses rowSpan and vMerge for vertical merge", () => {
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [
        { height: "370840", cells: [{ ...makeCell("Spanning"), "@_rowSpan": "2" }] },
        { height: "370840", cells: [{ ...makeCell(""), "@_vMerge": "1" }] },
      ],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[0].cells[0].rowSpan).toBe(2);
    expect(result!.rows[0].cells[0].vMerge).toBe(false);
    expect(result!.rows[1].cells[0].vMerge).toBe(true);
  });

  it("detects vMerge with boolean true value", () => {
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [
        { height: "370840", cells: [makeCell("Top")] },
        { height: "370840", cells: [{ ...makeCell(""), "@_vMerge": true }] },
      ],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[1].cells[0].vMerge).toBe(true);
  });

  it("detects hMerge with boolean true value", () => {
    const graphicData = makeTableXml({
      gridCols: ["3048000", "3048000"],
      rows: [
        {
          height: "370840",
          cells: [
            { ...makeCell("Main"), "@_gridSpan": "2" },
            { ...makeCell(""), "@_hMerge": true },
          ],
        },
      ],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[0].cells[1].hMerge).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Table style properties
// ---------------------------------------------------------------------------

describe("PptxTableDataParser — table style properties", () => {
  it("parses firstRow, bandRow, and bandCol flags", () => {
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [{ height: "370840", cells: [makeCell("Data")] }],
      tblPrAttrs: {
        "@_firstRow": "1",
        "@_bandRow": "1",
        "@_bandCol": "1",
        "@_lastRow": "0",
        "@_firstCol": "0",
        "@_lastCol": "0",
      },
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.firstRowHeader).toBe(true);
    expect(result!.bandedRows).toBe(true);
    expect(result!.bandedColumns).toBe(true);
    expect(result!.lastRow).toBe(false);
    expect(result!.firstCol).toBe(false);
    expect(result!.lastCol).toBe(false);
  });

  it("parses boolean true values for table property flags", () => {
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [{ height: "370840", cells: [makeCell("Data")] }],
      tblPrAttrs: {
        "@_firstRow": true,
        "@_lastRow": true,
        "@_firstCol": true,
        "@_lastCol": true,
        "@_bandRow": true,
        "@_bandCol": true,
      },
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.firstRowHeader).toBe(true);
    expect(result!.lastRow).toBe(true);
    expect(result!.firstCol).toBe(true);
    expect(result!.lastCol).toBe(true);
    expect(result!.bandedRows).toBe(true);
    expect(result!.bandedColumns).toBe(true);
  });

  it("parses table style ID from a:tblStyle/@val", () => {
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [{ height: "370840", cells: [makeCell("Styled")] }],
      tblPrAttrs: {
        "a:tblStyle": {
          "@_val": "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}",
        },
      },
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.tableStyleId).toBe(
      "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}",
    );
  });

  it("parses table style ID from @_tblStyle fallback", () => {
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [{ height: "370840", cells: [makeCell("")] }],
      tblPrAttrs: {
        "@_tblStyle": "{D7AC3CCA-C797-4891-BE02-D94E43425B78}",
      },
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.tableStyleId).toBe(
      "{D7AC3CCA-C797-4891-BE02-D94E43425B78}",
    );
  });

  it("sets default band cycle values", () => {
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [{ height: "370840", cells: [makeCell("X")] }],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.bandRowCycle).toBe(1);
    expect(result!.bandColCycle).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("PptxTableDataParser — edge cases", () => {
  it("returns undefined when a:tbl node is missing", () => {
    const graphicData: XmlObject = {
      "c:chart": { "@_r:id": "rId1" },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeUndefined();
  });

  it("handles empty cell text gracefully", () => {
    const graphicData = makeTableXml({
      gridCols: ["9144000"],
      rows: [
        {
          height: "370840",
          cells: [
            {
              "a:txBody": {
                "a:bodyPr": {},
                "a:p": { "a:endParaRPr": {} },
              },
              "a:tcPr": {},
            },
          ],
        },
      ],
    });
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[0].cells[0].text).toBe("");
  });

  it("parses table with single column (non-array from XML parser)", () => {
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {},
        "a:tblGrid": {
          "a:gridCol": { "@_w": "9144000" },
        },
        "a:tr": {
          "@_h": "370840",
          "a:tc": makeCell("Only cell"),
        },
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeDefined();
    expect(result!.columnWidths).toHaveLength(1);
    expect(result!.columnWidths[0]).toBeCloseTo(1.0, 5);
    expect(result!.rows[0].cells[0].text).toBe("Only cell");
  });
});
