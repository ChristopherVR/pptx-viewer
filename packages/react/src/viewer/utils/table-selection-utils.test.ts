import { describe, it, expect } from "vitest";
import { rectToCells, isCellInRect } from "./table-selection-utils";

describe("rectToCells", () => {
  it("returns all cells in a single-cell rect", () => {
    const cells = rectToCells({
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 0,
    });
    expect(cells).toEqual([{ row: 0, col: 0 }]);
  });

  it("returns all cells in a 2x2 rect", () => {
    const cells = rectToCells({
      startRow: 1,
      startCol: 1,
      endRow: 2,
      endCol: 2,
    });
    expect(cells).toEqual([
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ]);
  });

  it("returns cells in row-major order", () => {
    const cells = rectToCells({
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 1,
    });
    expect(cells[0]).toEqual({ row: 0, col: 0 });
    expect(cells[1]).toEqual({ row: 0, col: 1 });
    expect(cells[2]).toEqual({ row: 1, col: 0 });
    expect(cells[3]).toEqual({ row: 1, col: 1 });
  });

  it("returns a full row", () => {
    const cells = rectToCells({
      startRow: 2,
      startCol: 0,
      endRow: 2,
      endCol: 4,
    });
    expect(cells).toHaveLength(5);
    expect(cells.every((c) => c.row === 2)).toBe(true);
  });

  it("returns a full column", () => {
    const cells = rectToCells({
      startRow: 0,
      startCol: 3,
      endRow: 3,
      endCol: 3,
    });
    expect(cells).toHaveLength(4);
    expect(cells.every((c) => c.col === 3)).toBe(true);
  });

  it("handles 3x3 rect", () => {
    const cells = rectToCells({
      startRow: 0,
      startCol: 0,
      endRow: 2,
      endCol: 2,
    });
    expect(cells).toHaveLength(9);
  });
});

describe("isCellInRect", () => {
  const rect = { startRow: 1, startCol: 1, endRow: 3, endCol: 3 };

  it("returns true for cell inside the rect", () => {
    expect(isCellInRect(2, 2, rect)).toBe(true);
  });

  it("returns true for cell at top-left corner", () => {
    expect(isCellInRect(1, 1, rect)).toBe(true);
  });

  it("returns true for cell at bottom-right corner", () => {
    expect(isCellInRect(3, 3, rect)).toBe(true);
  });

  it("returns false for cell above the rect", () => {
    expect(isCellInRect(0, 2, rect)).toBe(false);
  });

  it("returns false for cell below the rect", () => {
    expect(isCellInRect(4, 2, rect)).toBe(false);
  });

  it("returns false for cell to the left", () => {
    expect(isCellInRect(2, 0, rect)).toBe(false);
  });

  it("returns false for cell to the right", () => {
    expect(isCellInRect(2, 4, rect)).toBe(false);
  });

  it("returns false for undefined rect", () => {
    expect(isCellInRect(0, 0, undefined)).toBe(false);
  });
});
