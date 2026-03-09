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

// ---------------------------------------------------------------------------
// Table structure parsing
// ---------------------------------------------------------------------------

describe("PptxTableDataParser — table structure", () => {
  it("parses grid column widths as proportions of total width", () => {
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {},
        "a:tblGrid": {
          "a:gridCol": [
            { "@_w": "3048000" },
            { "@_w": "3048000" },
            { "@_w": "3048000" },
          ],
        },
        "a:tr": [],
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeDefined();
    expect(result!.columnWidths).toHaveLength(3);
    // Each column is 3048000 out of 9144000 total = 1/3
    expect(result!.columnWidths[0]).toBeCloseTo(1 / 3, 5);
    expect(result!.columnWidths[1]).toBeCloseTo(1 / 3, 5);
    expect(result!.columnWidths[2]).toBeCloseTo(1 / 3, 5);
  });

  it("parses unequal column widths correctly", () => {
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {},
        "a:tblGrid": {
          "a:gridCol": [
            { "@_w": "1828800" }, // 2 inches
            { "@_w": "5486400" }, // 6 inches
          ],
        },
        "a:tr": [],
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeDefined();
    // 1828800 / (1828800 + 5486400) = 0.25
    expect(result!.columnWidths[0]).toBeCloseTo(0.25, 5);
    // 5486400 / 7315200 = 0.75
    expect(result!.columnWidths[1]).toBeCloseTo(0.75, 5);
  });

  it("parses row height from EMU to px", () => {
    // Row height 370840 EMU
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {},
        "a:tblGrid": {
          "a:gridCol": { "@_w": "9144000" },
        },
        "a:tr": {
          "@_h": "370840",
          "a:tc": {
            "a:txBody": {
              "a:bodyPr": {},
              "a:p": { "a:r": { "a:t": "Row 1" } },
            },
            "a:tcPr": {},
          },
        },
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeDefined();
    expect(result!.rows).toHaveLength(1);
    // 370840 / 9525 ≈ 38.93 → Math.round = 39
    expect(result!.rows[0].height).toBe(Math.round(370840 / EMU_PER_PX));
  });

  it("extracts cell text from a:txBody > a:p > a:r > a:t", () => {
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {},
        "a:tblGrid": {
          "a:gridCol": { "@_w": "3048000" },
        },
        "a:tr": {
          "@_h": "370840",
          "a:tc": {
            "a:txBody": {
              "a:bodyPr": {},
              "a:lstStyle": {},
              "a:p": {
                "a:r": { "a:t": "Cell 1" },
              },
            },
            "a:tcPr": {},
          },
        },
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeDefined();
    expect(result!.rows[0].cells[0].text).toBe("Cell 1");
  });

  it("concatenates multiple runs into cell text", () => {
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {},
        "a:tblGrid": { "a:gridCol": { "@_w": "9144000" } },
        "a:tr": {
          "@_h": "370840",
          "a:tc": {
            "a:txBody": {
              "a:bodyPr": {},
              "a:p": {
                "a:r": [
                  { "a:rPr": {}, "a:t": "Hello " },
                  { "a:rPr": {}, "a:t": "World" },
                ],
              },
            },
            "a:tcPr": {},
          },
        },
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[0].cells[0].text).toBe("Hello World");
  });

  it("joins multiple paragraphs with newline", () => {
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {},
        "a:tblGrid": { "a:gridCol": { "@_w": "9144000" } },
        "a:tr": {
          "@_h": "370840",
          "a:tc": {
            "a:txBody": {
              "a:bodyPr": {},
              "a:p": [
                { "a:r": { "a:t": "Line 1" } },
                { "a:r": { "a:t": "Line 2" } },
              ],
            },
            "a:tcPr": {},
          },
        },
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.rows[0].cells[0].text).toBe("Line 1\nLine 2");
  });

  it("parses gridSpan for horizontal merge", () => {
    // Per ECMA-376 §21.1.3.16: gridSpan specifies the number of columns
    // that a merged cell spans. hMerge="1" marks continuation cells.
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {},
        "a:tblGrid": {
          "a:gridCol": [
            { "@_w": "3048000" },
            { "@_w": "3048000" },
            { "@_w": "3048000" },
          ],
        },
        "a:tr": {
          "@_h": "370840",
          "a:tc": [
            {
              "@_gridSpan": "2",
              "a:txBody": {
                "a:bodyPr": {},
                "a:p": { "a:r": { "a:t": "Merged Cell" } },
              },
              "a:tcPr": {},
            },
            {
              "@_hMerge": "1",
              "a:txBody": {
                "a:bodyPr": {},
                "a:p": { "a:r": { "a:t": "" } },
              },
              "a:tcPr": {},
            },
            {
              "a:txBody": {
                "a:bodyPr": {},
                "a:p": { "a:r": { "a:t": "Single" } },
              },
              "a:tcPr": {},
            },
          ],
        },
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeDefined();
    const cells = result!.rows[0].cells;
    expect(cells).toHaveLength(3);
    expect(cells[0].gridSpan).toBe(2);
    expect(cells[0].text).toBe("Merged Cell");
    expect(cells[1].hMerge).toBe(true);
    expect(cells[2].text).toBe("Single");
    expect(cells[2].gridSpan).toBeUndefined();
  });

  it("parses rowSpan and vMerge for vertical merge", () => {
    // Per ECMA-376 §21.1.3.16: rowSpan specifies the number of rows a
    // merged cell spans. vMerge="1" marks continuation cells.
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {},
        "a:tblGrid": { "a:gridCol": { "@_w": "9144000" } },
        "a:tr": [
          {
            "@_h": "370840",
            "a:tc": {
              "@_rowSpan": "3",
              "a:txBody": {
                "a:bodyPr": {},
                "a:p": { "a:r": { "a:t": "Spanning" } },
              },
              "a:tcPr": {},
            },
          },
          {
            "@_h": "370840",
            "a:tc": {
              "@_vMerge": "1",
              "a:txBody": {
                "a:bodyPr": {},
                "a:p": { "a:r": { "a:t": "" } },
              },
              "a:tcPr": {},
            },
          },
          {
            "@_h": "370840",
            "a:tc": {
              "@_vMerge": "1",
              "a:txBody": {
                "a:bodyPr": {},
                "a:p": { "a:r": { "a:t": "" } },
              },
              "a:tcPr": {},
            },
          },
        ],
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeDefined();
    expect(result!.rows).toHaveLength(3);
    expect(result!.rows[0].cells[0].rowSpan).toBe(3);
    expect(result!.rows[0].cells[0].vMerge).toBe(false);
    expect(result!.rows[1].cells[0].vMerge).toBe(true);
    expect(result!.rows[2].cells[0].vMerge).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Table property flags (banding, first/last row/col, style ID)
// ---------------------------------------------------------------------------

describe("PptxTableDataParser — table properties & style", () => {
  it("parses banding and header flags from a:tblPr attributes", () => {
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {
          "@_firstRow": "1",
          "@_bandRow": "1",
          "@_lastRow": "0",
          "@_firstCol": "0",
          "@_lastCol": "0",
          "@_bandCol": "0",
        },
        "a:tblGrid": { "a:gridCol": { "@_w": "9144000" } },
        "a:tr": {
          "@_h": "370840",
          "a:tc": {
            "a:txBody": {
              "a:bodyPr": {},
              "a:p": { "a:r": { "a:t": "Data" } },
            },
            "a:tcPr": {},
          },
        },
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeDefined();
    expect(result!.firstRowHeader).toBe(true);
    expect(result!.bandedRows).toBe(true);
    expect(result!.lastRow).toBe(false);
    expect(result!.firstCol).toBe(false);
    expect(result!.lastCol).toBe(false);
    expect(result!.bandedColumns).toBe(false);
  });

  it("parses table style ID from a:tblStyle/@val", () => {
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {
          "@_firstRow": "1",
          "@_bandRow": "1",
          "a:tblStyle": {
            "@_val": "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}",
          },
        },
        "a:tblGrid": { "a:gridCol": { "@_w": "9144000" } },
        "a:tr": {
          "@_h": "370840",
          "a:tc": {
            "a:txBody": {
              "a:bodyPr": {},
              "a:p": { "a:r": { "a:t": "Styled" } },
            },
            "a:tcPr": {},
          },
        },
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.tableStyleId).toBe(
      "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}",
    );
  });

  it("parses table style ID from a:tblPr/@tblStyle fallback", () => {
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {
          "@_tblStyle": "{D7AC3CCA-C797-4891-BE02-D94E43425B78}",
        },
        "a:tblGrid": { "a:gridCol": { "@_w": "9144000" } },
        "a:tr": {
          "@_h": "370840",
          "a:tc": {
            "a:txBody": {
              "a:bodyPr": {},
              "a:p": { "a:r": { "a:t": "" } },
            },
            "a:tcPr": {},
          },
        },
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result!.tableStyleId).toBe(
      "{D7AC3CCA-C797-4891-BE02-D94E43425B78}",
    );
  });

  it("returns undefined when no a:tbl node exists", () => {
    const graphicData: XmlObject = {
      "a:chart": { "@_r:id": "rId1" },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeUndefined();
  });

  it("handles single column as non-array from XML parser", () => {
    // fast-xml-parser returns a single child as object, not array
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {},
        "a:tblGrid": {
          "a:gridCol": { "@_w": "9144000" },
        },
        "a:tr": {
          "@_h": "370840",
          "a:tc": {
            "a:txBody": {
              "a:bodyPr": {},
              "a:p": { "a:r": { "a:t": "Only cell" } },
            },
            "a:tcPr": {},
          },
        },
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeDefined();
    expect(result!.columnWidths).toHaveLength(1);
    expect(result!.columnWidths[0]).toBeCloseTo(1.0, 5);
    expect(result!.rows).toHaveLength(1);
    expect(result!.rows[0].cells).toHaveLength(1);
    expect(result!.rows[0].cells[0].text).toBe("Only cell");
  });

  it("parses a full spec-accurate table with multiple rows and cells", () => {
    // Complete table per ECMA-376 §21.1.3.13 with tblPr, tblGrid, rows, cells
    const graphicData: XmlObject = {
      "a:tbl": {
        "a:tblPr": {
          "@_firstRow": "1",
          "@_bandRow": "1",
          "@_lastRow": "0",
          "@_firstCol": "0",
          "@_lastCol": "0",
          "@_bandCol": "0",
          "a:tblStyle": {
            "@_val": "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}",
          },
        },
        "a:tblGrid": {
          "a:gridCol": [
            { "@_w": "3048000" },
            { "@_w": "3048000" },
            { "@_w": "3048000" },
          ],
        },
        "a:tr": [
          {
            "@_h": "370840",
            "a:tc": [
              {
                "a:txBody": {
                  "a:bodyPr": {},
                  "a:lstStyle": {},
                  "a:p": { "a:r": { "a:t": "Header A" } },
                },
                "a:tcPr": {},
              },
              {
                "a:txBody": {
                  "a:bodyPr": {},
                  "a:lstStyle": {},
                  "a:p": { "a:r": { "a:t": "Header B" } },
                },
                "a:tcPr": {},
              },
              {
                "a:txBody": {
                  "a:bodyPr": {},
                  "a:lstStyle": {},
                  "a:p": { "a:r": { "a:t": "Header C" } },
                },
                "a:tcPr": {},
              },
            ],
          },
          {
            "@_h": "370840",
            "a:tc": [
              {
                "a:txBody": {
                  "a:bodyPr": {},
                  "a:p": { "a:r": { "a:t": "A1" } },
                },
                "a:tcPr": {},
              },
              {
                "a:txBody": {
                  "a:bodyPr": {},
                  "a:p": { "a:r": { "a:t": "B1" } },
                },
                "a:tcPr": {},
              },
              {
                "a:txBody": {
                  "a:bodyPr": {},
                  "a:p": { "a:r": { "a:t": "C1" } },
                },
                "a:tcPr": {},
              },
            ],
          },
        ],
      },
    };
    const parser = new PptxTableDataParser(makeContext());
    const result = parser.parseTableData(graphicData);

    expect(result).toBeDefined();
    expect(result!.rows).toHaveLength(2);
    expect(result!.rows[0].cells).toHaveLength(3);
    expect(result!.rows[0].cells[0].text).toBe("Header A");
    expect(result!.rows[0].cells[1].text).toBe("Header B");
    expect(result!.rows[0].cells[2].text).toBe("Header C");
    expect(result!.rows[1].cells[0].text).toBe("A1");
    expect(result!.rows[1].cells[1].text).toBe("B1");
    expect(result!.rows[1].cells[2].text).toBe("C1");
    expect(result!.firstRowHeader).toBe(true);
    expect(result!.bandedRows).toBe(true);
    expect(result!.tableStyleId).toBe(
      "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}",
    );
  });
});
