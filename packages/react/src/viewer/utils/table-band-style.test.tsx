import { describe, it, expect } from "vitest";
import { getTableCellBandStyle } from "./table-band-style";
import type { PptxElement, ParsedTableStyleMap } from "pptx-viewer-core";

/**
 * Helper to create a minimal table element with the given tableData overrides.
 */
function makeTableElement(
  tableDataOverrides: Record<string, unknown> = {},
): PptxElement {
  return {
    id: "tbl-1",
    type: "table",
    x: 0,
    y: 0,
    width: 500,
    height: 300,
    tableData: {
      rows: [],
      columnWidths: [0.5, 0.5],
      ...tableDataOverrides,
    },
  } as unknown as PptxElement;
}

describe("getTableCellBandStyle", () => {
  it("returns undefined for non-table elements", () => {
    const el = { id: "t1", type: "text", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    expect(getTableCellBandStyle(el, 0, 0, 3, 3)).toBeUndefined();
  });

  it("returns undefined when tableData is missing", () => {
    const el = { id: "t1", type: "table", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    expect(getTableCellBandStyle(el, 0, 0, 3, 3)).toBeUndefined();
  });

  it("returns undefined when no styling flags are set", () => {
    const el = makeTableElement({});
    expect(getTableCellBandStyle(el, 1, 1, 3, 3)).toBeUndefined();
  });

  // ── Header row ──────────────────────────────────────────────
  it("applies header row style to the first row", () => {
    const el = makeTableElement({ firstRowHeader: true });
    const style = getTableCellBandStyle(el, 0, 0, 3, 3);
    expect(style).toBeDefined();
    expect(style!.fontWeight).toBe(700);
    expect(style!.backgroundColor).toBeDefined();
    expect(style!.color).toBe("#ffffff");
  });

  it("does not apply header row style to non-first rows", () => {
    const el = makeTableElement({ firstRowHeader: true });
    const style = getTableCellBandStyle(el, 1, 0, 3, 3);
    // Row 1 is not the header, should be undefined (no other flags)
    expect(style).toBeUndefined();
  });

  // ── Last / total row ────────────────────────────────────────
  it("applies last row (total) emphasis", () => {
    const el = makeTableElement({ lastRow: true });
    const style = getTableCellBandStyle(el, 2, 0, 3, 3);
    expect(style).toBeDefined();
    expect(style!.fontWeight).toBe(700);
    expect(style!.borderTopWidth).toBe(2);
    expect(style!.borderTopStyle).toBe("solid");
  });

  it("does not apply last row emphasis to non-last rows", () => {
    const el = makeTableElement({ lastRow: true });
    const style = getTableCellBandStyle(el, 0, 0, 3, 3);
    expect(style).toBeUndefined();
  });

  // ── First column emphasis ───────────────────────────────────
  it("applies first column emphasis at cellIndex 0", () => {
    const el = makeTableElement({ firstCol: true });
    const style = getTableCellBandStyle(el, 1, 0, 3, 3);
    expect(style).toBeDefined();
    expect(style!.fontWeight).toBe(700);
  });

  it("does not apply first column emphasis to non-first columns", () => {
    const el = makeTableElement({ firstCol: true });
    const style = getTableCellBandStyle(el, 1, 1, 3, 3);
    expect(style).toBeUndefined();
  });

  // ── Last column emphasis ────────────────────────────────────
  it("applies last column emphasis at the last column", () => {
    const el = makeTableElement({ lastCol: true });
    const style = getTableCellBandStyle(el, 1, 2, 3, 3);
    expect(style).toBeDefined();
    expect(style!.fontWeight).toBe(700);
  });

  it("does not apply last column emphasis to non-last columns", () => {
    const el = makeTableElement({ lastCol: true });
    const style = getTableCellBandStyle(el, 1, 0, 3, 3);
    expect(style).toBeUndefined();
  });

  // ── Banded rows ─────────────────────────────────────────────
  it("applies banded row styling with alternating bands", () => {
    const el = makeTableElement({ bandedRows: true });
    // Row 0 → band group 0 (even) → should apply
    const style0 = getTableCellBandStyle(el, 0, 0, 4, 3);
    expect(style0).toBeDefined();
    expect(style0!.backgroundColor).toBeDefined();

    // Row 1 → band group 1 (odd) → no band2HFill in default, so no bg
    const style1 = getTableCellBandStyle(el, 1, 0, 4, 3);
    // Without a style entry for band2HFill, only band group 0 applies
    expect(style1).toBeUndefined();
  });

  it("skips header row in banded row calculations", () => {
    const el = makeTableElement({ bandedRows: true, firstRowHeader: true });
    // Row 0 = header, row 1 = first banded row (bandIndex 0 → group 0)
    const headerStyle = getTableCellBandStyle(el, 0, 0, 4, 3);
    expect(headerStyle).toBeDefined();
    expect(headerStyle!.color).toBe("#ffffff"); // header styling, not band

    const bandStyle = getTableCellBandStyle(el, 1, 0, 4, 3);
    expect(bandStyle).toBeDefined();
    expect(bandStyle!.backgroundColor).toBeDefined();
  });

  it("respects bandRowCycle for banded rows", () => {
    const el = makeTableElement({ bandedRows: true, bandRowCycle: 2 });
    // Cycle=2: rows 0,1 → group 0; rows 2,3 → group 1; etc.
    const style0 = getTableCellBandStyle(el, 0, 0, 6, 3);
    const style1 = getTableCellBandStyle(el, 1, 0, 6, 3);
    const style2 = getTableCellBandStyle(el, 2, 0, 6, 3);

    expect(style0).toBeDefined();
    expect(style1).toBeDefined();
    // Row 2 is band group 1 and without band2HFill, should not apply band bg
    expect(style2).toBeUndefined();
  });

  // ── Banded columns ─────────────────────────────────────────
  it("applies banded column styling", () => {
    const el = makeTableElement({ bandedColumns: true });
    // Cell 0 → band group 0 → should get background
    const style0 = getTableCellBandStyle(el, 0, 0, 3, 4);
    expect(style0).toBeDefined();
    expect(style0!.backgroundColor).toBeDefined();

    // Cell 1 → band group 1 → no band2VFill in default
    const style1 = getTableCellBandStyle(el, 0, 1, 3, 4);
    expect(style1).toBeUndefined();
  });

  it("skips first/last column positions in banded column calc", () => {
    const el = makeTableElement({
      bandedColumns: true,
      firstCol: true,
      lastCol: true,
    });
    // Cell 0 = first col emphasis (not banded), cell 3 = last col emphasis
    const styleFirst = getTableCellBandStyle(el, 0, 0, 3, 4);
    expect(styleFirst).toBeDefined();
    expect(styleFirst!.fontWeight).toBe(700); // first col emphasis

    const styleLast = getTableCellBandStyle(el, 0, 3, 3, 4);
    expect(styleLast).toBeDefined();
    expect(styleLast!.fontWeight).toBe(700); // last col emphasis
  });

  // ── Combined flags ──────────────────────────────────────────
  it("combines header row and first column styling", () => {
    const el = makeTableElement({ firstRowHeader: true, firstCol: true });
    const style = getTableCellBandStyle(el, 0, 0, 3, 3);
    expect(style).toBeDefined();
    expect(style!.fontWeight).toBe(700);
  });

  // ── With style context ──────────────────────────────────────
  it("resolves colours from theme colour scheme when styleCtx is provided", () => {
    const tableStyleMap: ParsedTableStyleMap = {
      "{TEST-STYLE}": {
        firstRowFill: { schemeColor: "accent1" },
        wholeTblFill: { schemeColor: "bg1" },
      },
    };
    const theme = {
      colorScheme: {
        accent1: "#4472C4",
        bg1: "#FFFFFF",
      },
    };
    const el = makeTableElement({
      firstRowHeader: true,
      tableStyleId: "{TEST-STYLE}",
    });
    const style = getTableCellBandStyle(el, 0, 0, 3, 3, {
      tableStyleMap: tableStyleMap as unknown as ParsedTableStyleMap,
      theme: theme as any,
    });
    expect(style).toBeDefined();
    expect(style!.backgroundColor).toBe("#4472C4");
  });

  it("normalises table style ID to upper-case with braces", () => {
    const tableStyleMap: ParsedTableStyleMap = {
      "{ABCD-1234}": {
        wholeTblFill: { schemeColor: "accent1" },
      },
    };
    const theme = { colorScheme: { accent1: "#FF0000" } };
    const el = makeTableElement({
      bandedRows: true,
      tableStyleId: "abcd-1234",
    });
    const style = getTableCellBandStyle(el, 0, 0, 3, 3, {
      tableStyleMap: tableStyleMap as unknown as ParsedTableStyleMap,
      theme: theme as any,
    });
    expect(style).toBeDefined();
    expect(style!.backgroundColor).toBeDefined();
  });
});
