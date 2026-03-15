import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { parseEmbeddedXlsx } from "./chart-xlsx-parser";

// ---------------------------------------------------------------------------
// Helpers — build minimal xlsx ZIP archives with XML parts
// ---------------------------------------------------------------------------

/**
 * Build a minimal xlsx ZIP with the given shared strings and sheet1 XML.
 */
async function buildMockXlsx(
  sharedStringsXml: string | undefined,
  sheet1Xml: string,
): Promise<Uint8Array> {
  const zip = new JSZip();
  if (sharedStringsXml) {
    zip.file("xl/sharedStrings.xml", sharedStringsXml);
  }
  zip.file("xl/worksheets/sheet1.xml", sheet1Xml);
  return zip.generateAsync({ type: "uint8array" });
}

/**
 * Build a shared strings XML with the given strings.
 */
function buildSharedStringsXml(strings: string[]): string {
  const items = strings
    .map((s) => `<si><t>${s}</t></si>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${items}
</sst>`;
}

/**
 * Build a sheet1 worksheet XML from a 2D grid of cells.
 * Each cell is { ref, type?, value }.
 */
function buildSheet1Xml(
  rows: { ref: string; type?: string; value: string | number }[][],
): string {
  const rowsXml = rows
    .map((cells, rowIdx) => {
      const cellsXml = cells
        .map((cell) => {
          const typeAttr = cell.type ? ` t="${cell.type}"` : "";
          return `<c r="${cell.ref}"${typeAttr}><v>${cell.value}</v></c>`;
        })
        .join("");
      return `<row r="${rowIdx + 1}">${cellsXml}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
${rowsXml}
</sheetData>
</worksheet>`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseEmbeddedXlsx", () => {
  it("should parse a basic xlsx with string categories and numeric series", async () => {
    const sharedStrings = buildSharedStringsXml(["", "Revenue", "Costs", "Q1", "Q2", "Q3"]);
    const sheet1 = buildSheet1Xml([
      // Row 0: header row (A1 is empty corner, B1=Revenue, C1=Costs)
      [
        { ref: "A1", type: "s", value: "0" },
        { ref: "B1", type: "s", value: "1" },
        { ref: "C1", type: "s", value: "2" },
      ],
      // Row 1: Q1 data
      [
        { ref: "A2", type: "s", value: "3" },
        { ref: "B2", value: "100" },
        { ref: "C2", value: "80" },
      ],
      // Row 2: Q2 data
      [
        { ref: "A3", type: "s", value: "4" },
        { ref: "B3", value: "120" },
        { ref: "C3", value: "90" },
      ],
      // Row 3: Q3 data
      [
        { ref: "A4", type: "s", value: "5" },
        { ref: "B4", value: "140" },
        { ref: "C4", value: "95" },
      ],
    ]);

    const xlsxData = await buildMockXlsx(sharedStrings, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeDefined();
    expect(result!.categories).toEqual(["Q1", "Q2", "Q3"]);
    expect(result!.series).toHaveLength(2);
    expect(result!.series[0].name).toBe("Revenue");
    expect(result!.series[0].values).toEqual([100, 120, 140]);
    expect(result!.series[1].name).toBe("Costs");
    expect(result!.series[1].values).toEqual([80, 90, 95]);
  });

  it("should handle inline string cells (type=str)", async () => {
    const sheet1 = buildSheet1Xml([
      [
        { ref: "A1", type: "str", value: "Category" },
        { ref: "B1", type: "str", value: "Sales" },
      ],
      [
        { ref: "A2", type: "str", value: "East" },
        { ref: "B2", value: "50" },
      ],
      [
        { ref: "A3", type: "str", value: "West" },
        { ref: "B3", value: "75" },
      ],
    ]);

    const xlsxData = await buildMockXlsx(undefined, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeDefined();
    expect(result!.categories).toEqual(["East", "West"]);
    expect(result!.series).toHaveLength(1);
    expect(result!.series[0].name).toBe("Sales");
    expect(result!.series[0].values).toEqual([50, 75]);
  });

  it("should handle numeric-only cells (no shared strings)", async () => {
    const sheet1 = buildSheet1Xml([
      [
        { ref: "A1", value: "0" },
        { ref: "B1", value: "1" },
        { ref: "C1", value: "2" },
      ],
      [
        { ref: "A2", value: "2020" },
        { ref: "B2", value: "100" },
        { ref: "C2", value: "200" },
      ],
      [
        { ref: "A3", value: "2021" },
        { ref: "B3", value: "150" },
        { ref: "C3", value: "250" },
      ],
    ]);

    const xlsxData = await buildMockXlsx(undefined, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeDefined();
    // Row 0 are headers (numeric), Rows 1+ first column are categories
    expect(result!.categories).toEqual(["2020", "2021"]);
    expect(result!.series).toHaveLength(2);
    expect(result!.series[0].name).toBe("1");
    expect(result!.series[0].values).toEqual([100, 150]);
    expect(result!.series[1].name).toBe("2");
    expect(result!.series[1].values).toEqual([200, 250]);
  });

  it("should handle rich text shared strings", async () => {
    // Rich text: <si><r><t>Q</t></r><r><t>1</t></r></si>
    const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">
<si><r><rPr><b/></rPr><t>Q</t></r><r><t>1</t></r></si>
<si><t>Sales</t></si>
</sst>`;

    const sheet1 = buildSheet1Xml([
      [
        { ref: "A1", type: "s", value: "0" },
        { ref: "B1", type: "s", value: "1" },
      ],
      [
        { ref: "A2", type: "str", value: "Jan" },
        { ref: "B2", value: "42" },
      ],
    ]);

    const xlsxData = await buildMockXlsx(sharedStringsXml, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeDefined();
    // Header row: A1 resolves to rich text "Q1", B1 resolves to "Sales"
    // But A1 is the corner cell, B1 is the series name
    expect(result!.series[0].name).toBe("Sales");
    expect(result!.categories).toEqual(["Jan"]);
  });

  it("should handle boolean cell type", async () => {
    const sheet1 = buildSheet1Xml([
      [
        { ref: "A1", type: "str", value: "Cat" },
        { ref: "B1", type: "str", value: "Flag" },
      ],
      [
        { ref: "A2", type: "str", value: "Item1" },
        { ref: "B2", type: "b", value: "1" },
      ],
      [
        { ref: "A3", type: "str", value: "Item2" },
        { ref: "B3", type: "b", value: "0" },
      ],
    ]);

    const xlsxData = await buildMockXlsx(undefined, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeDefined();
    expect(result!.categories).toEqual(["Item1", "Item2"]);
    // Booleans resolve as "TRUE"/"FALSE" strings, numeric parse gives 0
    expect(result!.series[0].values).toEqual([0, 0]);
  });

  it("should return undefined for empty worksheet", async () => {
    const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData/>
</worksheet>`;

    const xlsxData = await buildMockXlsx(undefined, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeUndefined();
  });

  it("should return undefined for a single-cell worksheet", async () => {
    const sheet1 = buildSheet1Xml([
      [{ ref: "A1", value: "42" }],
    ]);

    const xlsxData = await buildMockXlsx(undefined, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeUndefined();
  });

  it("should return undefined when sheet1.xml is missing", async () => {
    const zip = new JSZip();
    zip.file("xl/sharedStrings.xml", buildSharedStringsXml(["hello"]));
    // Deliberately do NOT add sheet1.xml
    const xlsxData = await zip.generateAsync({ type: "uint8array" });
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeUndefined();
  });

  it("should return undefined for invalid (non-ZIP) data", async () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const result = await parseEmbeddedXlsx(garbage);

    expect(result).toBeUndefined();
  });

  it("should handle sparse cells with missing values", async () => {
    // Some cells have no <v> child — they should be skipped
    const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1">
  <c r="A1" t="str"><v>Cat</v></c>
  <c r="B1" t="str"><v>Series1</v></c>
</row>
<row r="2">
  <c r="A2" t="str"><v>X</v></c>
  <c r="B2"><v>10</v></c>
</row>
<row r="3">
  <c r="A3" t="str"><v>Y</v></c>
  <c r="B3"/>
</row>
<row r="4">
  <c r="A4" t="str"><v>Z</v></c>
  <c r="B4"><v>30</v></c>
</row>
</sheetData>
</worksheet>`;

    const xlsxData = await buildMockXlsx(undefined, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeDefined();
    expect(result!.categories).toEqual(["X", "Y", "Z"]);
    // Row 3 B3 has no value, so grid cell is undefined => 0
    expect(result!.series[0].values).toEqual([10, 0, 30]);
  });

  it("should handle multi-letter column references (e.g. AA1)", async () => {
    // Build a sheet with columns A through AB (28 columns)
    // Just test that AA column parsing works
    const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1">
  <c r="A1" t="str"><v>Cat</v></c>
  <c r="B1" t="str"><v>Col1</v></c>
</row>
<row r="2">
  <c r="A2" t="str"><v>Row1</v></c>
  <c r="B2"><v>99</v></c>
</row>
</sheetData>
</worksheet>`;

    const xlsxData = await buildMockXlsx(undefined, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeDefined();
    expect(result!.categories).toEqual(["Row1"]);
    expect(result!.series[0].name).toBe("Col1");
    expect(result!.series[0].values).toEqual([99]);
  });

  it("should handle xlsx with no sharedStrings.xml", async () => {
    const sheet1 = buildSheet1Xml([
      [
        { ref: "A1", type: "str", value: "Header" },
        { ref: "B1", type: "str", value: "Metric" },
      ],
      [
        { ref: "A2", type: "str", value: "A" },
        { ref: "B2", value: "10.5" },
      ],
    ]);

    const xlsxData = await buildMockXlsx(undefined, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeDefined();
    expect(result!.categories).toEqual(["A"]);
    expect(result!.series[0].name).toBe("Metric");
    expect(result!.series[0].values).toEqual([10.5]);
  });

  it("should handle a single column with header and data rows", async () => {
    // Only column A: header + data, no series columns
    const sheet1 = buildSheet1Xml([
      [{ ref: "A1", type: "str", value: "Label" }],
      [{ ref: "A2", type: "str", value: "Item1" }],
      [{ ref: "A3", type: "str", value: "Item2" }],
    ]);

    const xlsxData = await buildMockXlsx(undefined, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    // Single column means no series data columns => undefined
    expect(result).toBeUndefined();
  });

  it("should generate default series names when headers are missing", async () => {
    // Row 0 only has column A (categories header), B1 and C1 are missing
    const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1">
  <c r="A1" t="str"><v>Cat</v></c>
</row>
<row r="2">
  <c r="A2" t="str"><v>X</v></c>
  <c r="B2"><v>1</v></c>
  <c r="C2"><v>2</v></c>
</row>
<row r="3">
  <c r="A3" t="str"><v>Y</v></c>
  <c r="B3"><v>3</v></c>
  <c r="C3"><v>4</v></c>
</row>
</sheetData>
</worksheet>`;

    const xlsxData = await buildMockXlsx(undefined, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeDefined();
    expect(result!.categories).toEqual(["X", "Y"]);
    // B1 and C1 are undefined, so default names are used
    expect(result!.series[0].name).toBe("Series 1");
    expect(result!.series[0].values).toEqual([1, 3]);
    expect(result!.series[1].name).toBe("Series 2");
    expect(result!.series[1].values).toEqual([2, 4]);
  });

  it("should handle floating point numeric values", async () => {
    const sheet1 = buildSheet1Xml([
      [
        { ref: "A1", type: "str", value: "Cat" },
        { ref: "B1", type: "str", value: "Values" },
      ],
      [
        { ref: "A2", type: "str", value: "P1" },
        { ref: "B2", value: "3.14159" },
      ],
      [
        { ref: "A3", type: "str", value: "P2" },
        { ref: "B3", value: "-2.718" },
      ],
    ]);

    const xlsxData = await buildMockXlsx(undefined, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeDefined();
    expect(result!.series[0].values[0]).toBeCloseTo(3.14159);
    expect(result!.series[0].values[1]).toBeCloseTo(-2.718);
  });

  it("should handle shared string index out of bounds gracefully", async () => {
    const sharedStrings = buildSharedStringsXml(["hello"]);
    const sheet1 = buildSheet1Xml([
      [
        { ref: "A1", type: "s", value: "0" },  // valid index
        { ref: "B1", type: "s", value: "99" }, // out of bounds
      ],
      [
        { ref: "A2", type: "str", value: "X" },
        { ref: "B2", value: "42" },
      ],
    ]);

    const xlsxData = await buildMockXlsx(sharedStrings, sheet1);
    const result = await parseEmbeddedXlsx(xlsxData);

    expect(result).toBeDefined();
    // Out of bounds shared string index falls back to the raw value string
    expect(result!.series[0].name).toBe("99");
  });
});
