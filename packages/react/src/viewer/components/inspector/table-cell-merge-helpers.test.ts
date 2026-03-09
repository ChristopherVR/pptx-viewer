import { describe, it, expect } from "vitest";
import {
  computeMergeCellRight,
  computeMergeCellDown,
  computeSplitCell,
} from "./table-cell-merge-helpers";
import type { PptxTableData } from "pptx-viewer-core";

function makeTable(
  rows: number,
  cols: number,
  overrides?: Record<string, Partial<{ gridSpan: number; rowSpan: number; hMerge: boolean; vMerge: boolean; text: string }>>,
): PptxTableData {
  return {
    rows: Array.from({ length: rows }, (_, ri) => ({
      cells: Array.from({ length: cols }, (_, ci) => {
        const key = `${ri},${ci}`;
        return { text: `${ri}-${ci}`, ...(overrides?.[key] || {}) };
      }),
    })),
    columnWidths: Array.from({ length: cols }, () => 100),
  } as unknown as PptxTableData;
}

describe("computeMergeCellRight", () => {
  it("merges two adjacent cells horizontally", () => {
    const table = makeTable(2, 3);
    const result = computeMergeCellRight(table, 0, 0);
    expect(result).not.toBeNull();
    expect(result![0].cells[0].gridSpan).toBe(2);
    expect(result![0].cells[1].hMerge).toBe(true);
    expect(result![0].cells[1].text).toBe("");
  });

  it("returns null for out-of-bounds row", () => {
    const table = makeTable(2, 3);
    expect(computeMergeCellRight(table, 5, 0)).toBeNull();
  });

  it("returns null when next cell is beyond table width", () => {
    const table = makeTable(2, 3);
    expect(computeMergeCellRight(table, 0, 2)).toBeNull();
  });

  it("returns null when next cell is already horizontally merged", () => {
    const table = makeTable(2, 3, {
      "0,1": { hMerge: true },
    });
    expect(computeMergeCellRight(table, 0, 0)).toBeNull();
  });

  it("does not affect other rows", () => {
    const table = makeTable(3, 3);
    const result = computeMergeCellRight(table, 1, 0);
    expect(result).not.toBeNull();
    // Row 0 should be unchanged
    expect(result![0].cells[0].gridSpan).toBeUndefined();
    // Row 2 should be unchanged
    expect(result![2].cells[0].gridSpan).toBeUndefined();
  });

  it("extends an already merged cell", () => {
    const table = makeTable(1, 4, {
      "0,0": { gridSpan: 2 },
      "0,1": { hMerge: true, text: "" },
    });
    // Merging cell 0 (span 2) with cell 2
    const result = computeMergeCellRight(table, 0, 0);
    expect(result).not.toBeNull();
    expect(result![0].cells[0].gridSpan).toBe(3);
    expect(result![0].cells[2].hMerge).toBe(true);
  });
});

describe("computeMergeCellDown", () => {
  it("merges two vertically adjacent cells", () => {
    const table = makeTable(3, 2);
    const result = computeMergeCellDown(table, 0, 0);
    expect(result).not.toBeNull();
    expect(result![0].cells[0].rowSpan).toBe(2);
    expect(result![1].cells[0].vMerge).toBe(true);
    expect(result![1].cells[0].text).toBe("");
  });

  it("returns null for out-of-bounds row", () => {
    const table = makeTable(2, 2);
    expect(computeMergeCellDown(table, 5, 0)).toBeNull();
  });

  it("returns null when there is no row below", () => {
    const table = makeTable(2, 2);
    expect(computeMergeCellDown(table, 1, 0)).toBeNull();
  });

  it("returns null when target cell is already vertically merged", () => {
    const table = makeTable(3, 2, {
      "1,0": { vMerge: true },
    });
    expect(computeMergeCellDown(table, 0, 0)).toBeNull();
  });

  it("does not affect other columns", () => {
    const table = makeTable(3, 3);
    const result = computeMergeCellDown(table, 0, 1);
    expect(result).not.toBeNull();
    expect(result![0].cells[0].rowSpan).toBeUndefined();
    expect(result![0].cells[2].rowSpan).toBeUndefined();
  });

  it("extends an already merged cell downward", () => {
    const table = makeTable(4, 2, {
      "0,0": { rowSpan: 2 },
      "1,0": { vMerge: true, text: "" },
    });
    const result = computeMergeCellDown(table, 0, 0);
    expect(result).not.toBeNull();
    expect(result![0].cells[0].rowSpan).toBe(3);
    expect(result![2].cells[0].vMerge).toBe(true);
  });
});

describe("computeSplitCell", () => {
  it("returns null for a cell with no spans", () => {
    const table = makeTable(2, 2);
    expect(computeSplitCell(table, 0, 0)).toBeNull();
  });

  it("splits a horizontally merged cell", () => {
    const table = makeTable(1, 3, {
      "0,0": { gridSpan: 2 },
      "0,1": { hMerge: true, text: "" },
    });
    const result = computeSplitCell(table, 0, 0);
    expect(result).not.toBeNull();
    expect(result![0].cells[0].gridSpan).toBeUndefined();
    expect(result![0].cells[1].hMerge).toBeUndefined();
  });

  it("splits a vertically merged cell", () => {
    const table = makeTable(3, 2, {
      "0,0": { rowSpan: 2 },
      "1,0": { vMerge: true, text: "" },
    });
    const result = computeSplitCell(table, 0, 0);
    expect(result).not.toBeNull();
    expect(result![0].cells[0].rowSpan).toBeUndefined();
    expect(result![1].cells[0].vMerge).toBeUndefined();
  });

  it("returns null for out-of-bounds row", () => {
    const table = makeTable(2, 2);
    expect(computeSplitCell(table, 5, 0)).toBeNull();
  });

  it("returns null for out-of-bounds column", () => {
    const table = makeTable(2, 2);
    expect(computeSplitCell(table, 0, 5)).toBeNull();
  });

  it("preserves other cells unchanged", () => {
    const table = makeTable(2, 3, {
      "0,0": { gridSpan: 2 },
      "0,1": { hMerge: true, text: "" },
    });
    const result = computeSplitCell(table, 0, 0);
    expect(result).not.toBeNull();
    // Cell at (0,2) should be unchanged
    expect(result![0].cells[2].text).toBe("0-2");
    // Row 1 should be unchanged
    expect(result![1].cells[0].text).toBe("1-0");
  });
});
