/**
 * Parse embedded Excel (`.xlsx`) workbooks from PPTX chart data.
 *
 * Xlsx files are themselves ZIP archives containing XML parts. This parser
 * uses JSZip (already a project dependency) to unzip the workbook, then
 * reads `xl/sharedStrings.xml` for the string table and
 * `xl/worksheets/sheet1.xml` for cell values. The result is structured
 * chart-compatible data with categories and series.
 *
 * @module chart-xlsx-parser
 */

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

import type { PptxEmbeddedWorkbookData } from "../types";

/** Represents a single parsed cell from the worksheet. */
interface ParsedCell {
  /** Column index (0-based). */
  col: number;
  /** Row index (0-based). */
  row: number;
  /** Cell type: "s" = shared string index, "n" = number, "str" = inline string, "b" = boolean. */
  type: string;
  /** Raw cell value string. */
  value: string;
}

/**
 * Convert an Excel-style column reference (e.g. "A", "B", "AA") to a
 * 0-based column index.
 */
function columnLetterToIndex(letters: string): number {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Parse a cell reference like "A1", "B2", "AA10" into column and row indices.
 */
function parseCellReference(ref: string): { col: number; row: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return { col: 0, row: 0 };
  return {
    col: columnLetterToIndex(match[1]),
    row: Number.parseInt(match[2], 10) - 1,
  };
}

/**
 * Build the shared string table from `xl/sharedStrings.xml`.
 *
 * Each `<si>` element can contain either a direct `<t>` text node or
 * multiple `<r>` (rich text run) elements each with their own `<t>`.
 */
function parseSharedStrings(
  xml: Record<string, unknown> | undefined,
): string[] {
  if (!xml) return [];

  // Find the sst root (may be namespaced)
  const sst = findByLocalName(xml, "sst") as Record<string, unknown> | undefined;
  if (!sst) return [];

  const items = getChildArray(sst, "si");
  const strings: string[] = [];

  for (const si of items) {
    // Simple string: <si><t>text</t></si>
    const directText = getTextValue(si, "t");
    if (directText !== undefined) {
      strings.push(String(directText));
      continue;
    }

    // Rich text: <si><r><t>part1</t></r><r><t>part2</t></r></si>
    const runs = getChildArray(si, "r");
    if (runs.length > 0) {
      const parts: string[] = [];
      for (const run of runs) {
        const runText = getTextValue(run, "t");
        if (runText !== undefined) {
          parts.push(String(runText));
        }
      }
      strings.push(parts.join(""));
      continue;
    }

    // Empty string entry
    strings.push("");
  }

  return strings;
}

/**
 * Parse cells from `xl/worksheets/sheet1.xml`.
 */
function parseWorksheetCells(
  xml: Record<string, unknown> | undefined,
): ParsedCell[] {
  if (!xml) return [];

  const worksheet = findByLocalName(xml, "worksheet") as
    | Record<string, unknown>
    | undefined;
  if (!worksheet) return [];

  const sheetData = findByLocalName(worksheet, "sheetData") as
    | Record<string, unknown>
    | undefined;
  if (!sheetData) return [];

  const rows = getChildArray(sheetData, "row");
  const cells: ParsedCell[] = [];

  for (const row of rows) {
    const cellNodes = getChildArray(row, "c");
    for (const cell of cellNodes) {
      const ref = String(
        cell["@_r"] || "",
      ).trim();
      if (ref.length === 0) continue;

      const { col, row: rowIdx } = parseCellReference(ref);
      const cellType = String(cell["@_t"] || "n").trim();

      // The value is in <v> child
      const rawValue = getTextValue(cell, "v");
      if (rawValue === undefined) continue;

      cells.push({
        col,
        row: rowIdx,
        type: cellType,
        value: String(rawValue),
      });
    }
  }

  return cells;
}

/**
 * Find a child element by local name (ignoring namespace prefix).
 */
function findByLocalName(
  obj: Record<string, unknown>,
  localName: string,
): unknown | undefined {
  for (const key of Object.keys(obj)) {
    const parts = key.split(":");
    const local = parts[parts.length - 1];
    if (local === localName) {
      return obj[key];
    }
  }
  return undefined;
}

/**
 * Get an array of child elements by local name.
 */
function getChildArray(
  parent: Record<string, unknown>,
  localName: string,
): Record<string, unknown>[] {
  const child = findByLocalName(parent, localName);
  if (!child) return [];
  if (Array.isArray(child)) return child as Record<string, unknown>[];
  if (typeof child === "object" && child !== null) {
    return [child as Record<string, unknown>];
  }
  return [];
}

/**
 * Get a scalar text value from a child element by local name.
 */
function getTextValue(
  parent: Record<string, unknown>,
  localName: string,
): string | number | undefined {
  const child = findByLocalName(parent, localName);
  if (child === undefined || child === null) return undefined;
  if (typeof child === "string" || typeof child === "number") return child;
  if (typeof child === "object" && child !== null) {
    // fast-xml-parser may wrap text in an object with #text key
    const textObj = child as Record<string, unknown>;
    if ("#text" in textObj) {
      const text = textObj["#text"];
      if (typeof text === "string" || typeof text === "number") return text;
    }
  }
  return undefined;
}

/**
 * Resolve cell values using the shared string table.
 */
function resolveCellValue(
  cell: ParsedCell,
  sharedStrings: string[],
): string | number {
  switch (cell.type) {
    case "s": {
      // Shared string index
      const idx = Number.parseInt(cell.value, 10);
      return Number.isFinite(idx) && idx >= 0 && idx < sharedStrings.length
        ? sharedStrings[idx]
        : cell.value;
    }
    case "b":
      // Boolean
      return cell.value === "1" ? "TRUE" : "FALSE";
    case "str":
    case "inlineStr":
      // Inline string
      return cell.value;
    default: {
      // Numeric
      const num = Number.parseFloat(cell.value);
      return Number.isFinite(num) ? num : cell.value;
    }
  }
}

/**
 * Parse an embedded xlsx workbook binary into structured chart data.
 *
 * The xlsx is itself a ZIP containing XML files. This function:
 * 1. Unzips the xlsx using JSZip
 * 2. Parses `xl/sharedStrings.xml` for the string table
 * 3. Parses `xl/worksheets/sheet1.xml` for cell values
 * 4. Interprets the data as: first row = headers, first column = categories,
 *    remaining cells = numeric series values
 *
 * @param xlsxData - The raw binary content of the embedded xlsx file
 * @returns Structured workbook data with categories and series, or undefined on failure
 *
 * @example
 * ```ts
 * const result = await parseEmbeddedXlsx(xlsxBytes);
 * // result = {
 * //   categories: ["Q1", "Q2", "Q3"],
 * //   series: [
 * //     { name: "Revenue", values: [100, 120, 140] },
 * //     { name: "Costs", values: [80, 90, 95] },
 * //   ],
 * // }
 * ```
 */
export async function parseEmbeddedXlsx(
  xlsxData: Uint8Array,
): Promise<PptxEmbeddedWorkbookData | undefined> {
  try {
    const xlsxZip = await JSZip.loadAsync(xlsxData);

    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: false,
      trimValues: true,
    });

    // Parse shared strings table
    let sharedStrings: string[] = [];
    const sharedStringsFile = xlsxZip.file("xl/sharedStrings.xml");
    if (sharedStringsFile) {
      const sharedStringsXml = await sharedStringsFile.async("string");
      const parsedSharedStrings = xmlParser.parse(sharedStringsXml) as Record<
        string,
        unknown
      >;
      sharedStrings = parseSharedStrings(parsedSharedStrings);
    }

    // Parse the first worksheet
    const sheet1File = xlsxZip.file("xl/worksheets/sheet1.xml");
    if (!sheet1File) return undefined;

    const sheet1Xml = await sheet1File.async("string");
    const parsedSheet = xmlParser.parse(sheet1Xml) as Record<string, unknown>;
    const cells = parseWorksheetCells(parsedSheet);

    if (cells.length === 0) return undefined;

    // Determine grid bounds
    let maxRow = 0;
    let maxCol = 0;
    for (const cell of cells) {
      if (cell.row > maxRow) maxRow = cell.row;
      if (cell.col > maxCol) maxCol = cell.col;
    }

    // Build a 2D grid for easy access
    const grid: (string | number | undefined)[][] = [];
    for (let r = 0; r <= maxRow; r++) {
      grid[r] = new Array(maxCol + 1).fill(undefined);
    }
    for (const cell of cells) {
      grid[cell.row][cell.col] = resolveCellValue(cell, sharedStrings);
    }

    // Interpret the grid:
    // Row 0 = header row (series names in columns 1..maxCol)
    // Column 0 = category labels (rows 1..maxRow)
    // Cells [r][c] where r >= 1 and c >= 1 = data values

    // If there's only one row or one column, handle degenerate cases
    if (maxRow === 0 && maxCol === 0) {
      // Single cell — not useful as chart data
      return undefined;
    }

    // Extract categories from first column (starting from row 1)
    const categories: string[] = [];
    for (let r = 1; r <= maxRow; r++) {
      const val = grid[r]?.[0];
      categories.push(val !== undefined ? String(val) : "");
    }

    // Extract series from columns 1..maxCol
    const series: { name: string; values: number[] }[] = [];
    for (let c = 1; c <= maxCol; c++) {
      const headerVal = grid[0]?.[c];
      const name =
        headerVal !== undefined ? String(headerVal) : `Series ${c}`;

      const values: number[] = [];
      for (let r = 1; r <= maxRow; r++) {
        const cellVal = grid[r]?.[c];
        if (cellVal === undefined) {
          values.push(0);
        } else if (typeof cellVal === "number") {
          values.push(cellVal);
        } else {
          const num = Number.parseFloat(String(cellVal));
          values.push(Number.isFinite(num) ? num : 0);
        }
      }

      series.push({ name, values });
    }

    // If no series were found (single column), try treating rows as data
    if (series.length === 0 && categories.length > 0) {
      return undefined;
    }

    return { categories, series };
  } catch {
    // Failed to parse xlsx — return undefined so chart falls back to cached data
    return undefined;
  }
}
