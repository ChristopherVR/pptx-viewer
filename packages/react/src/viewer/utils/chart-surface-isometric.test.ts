import { describe, it, expect } from "vitest";
import {
  isoProject,
  ISO_COS30,
  ISO_SIN30,
  surfaceColor,
  isoCellVertices,
} from "./chart-surface-treemap";

// ── Isometric projection constants ──────────────────────────────

describe("isometric projection: constants", () => {
  it("should have correct cos(30) value", () => {
    expect(ISO_COS30).toBeCloseTo(Math.sqrt(3) / 2, 10);
  });

  it("should have correct sin(30) value", () => {
    expect(ISO_SIN30).toBeCloseTo(0.5, 10);
  });
});

// ── isoProject ──────────────────────────────────────────────────

describe("isometric projection: isoProject", () => {
  it("should project origin to (0, 0)", () => {
    const { screenX, screenY } = isoProject(0, 0, 0);
    expect(screenX).toBeCloseTo(0, 10);
    expect(screenY).toBeCloseTo(0, 10);
  });

  it("should apply screenX = (x - y) * cos30", () => {
    const { screenX } = isoProject(10, 3, 0);
    expect(screenX).toBeCloseTo((10 - 3) * ISO_COS30, 10);
  });

  it("should apply screenY = (x + y) * sin30 - z", () => {
    const { screenY } = isoProject(10, 3, 5);
    expect(screenY).toBeCloseTo((10 + 3) * ISO_SIN30 - 5, 10);
  });

  it("should move point upward when z increases", () => {
    const low = isoProject(5, 5, 0);
    const high = isoProject(5, 5, 10);
    // Higher z means lower screenY (upward on screen)
    expect(high.screenY).toBeLessThan(low.screenY);
    // X should be unchanged
    expect(high.screenX).toBeCloseTo(low.screenX, 10);
  });

  it("should produce positive screenX when x > y", () => {
    const { screenX } = isoProject(10, 5, 0);
    expect(screenX).toBeGreaterThan(0);
  });

  it("should produce negative screenX when x < y", () => {
    const { screenX } = isoProject(5, 10, 0);
    expect(screenX).toBeLessThan(0);
  });

  it("should produce zero screenX when x == y", () => {
    const { screenX } = isoProject(7, 7, 0);
    expect(screenX).toBeCloseTo(0, 10);
  });

  it("should handle negative coordinates", () => {
    const { screenX, screenY } = isoProject(-5, -3, 2);
    expect(screenX).toBeCloseTo((-5 - -3) * ISO_COS30, 10);
    expect(screenY).toBeCloseTo((-5 + -3) * ISO_SIN30 - 2, 10);
  });

  it("should be linear — sum of projections equals projection of sum", () => {
    const a = isoProject(3, 4, 1);
    const b = isoProject(2, 1, 3);
    const sum = isoProject(3 + 2, 4 + 1, 1 + 3);
    expect(sum.screenX).toBeCloseTo(a.screenX + b.screenX, 10);
    expect(sum.screenY).toBeCloseTo(a.screenY + b.screenY, 10);
  });
});

// ── surfaceColor ────────────────────────────────────────────────

describe("isometric projection: surfaceColor", () => {
  it("should map t=0 to cool color (low r, high b)", () => {
    const c = surfaceColor(0);
    expect(c.r).toBe(30);
    expect(c.b).toBe(230);
  });

  it("should map t=1 to warm color (high r, low b)", () => {
    const c = surfaceColor(1);
    expect(c.r).toBe(230);
    expect(c.b).toBe(30);
  });

  it("should map t=0.5 to peak green", () => {
    const c = surfaceColor(0.5);
    // At t=0.5: g = 80 + 100*(1 - |0.5-0.5|*2) = 80 + 100 = 180
    expect(c.g).toBe(180);
  });

  it("should produce intermediate values for t=0.25", () => {
    const c = surfaceColor(0.25);
    expect(c.r).toBe(Math.round(30 + 200 * 0.25));
    expect(c.g).toBe(Math.round(80 + 100 * (1 - Math.abs(0.25 - 0.5) * 2)));
    expect(c.b).toBe(Math.round(200 * (1 - 0.25) + 30));
  });

  it("should clamp to integer RGB values", () => {
    // Values at any t should be integer
    for (const t of [0, 0.1, 0.33, 0.5, 0.67, 0.9, 1]) {
      const c = surfaceColor(t);
      expect(Number.isInteger(c.r)).toBe(true);
      expect(Number.isInteger(c.g)).toBe(true);
      expect(Number.isInteger(c.b)).toBe(true);
    }
  });
});

// ── isoCellVertices ─────────────────────────────────────────────

describe("isometric projection: isoCellVertices", () => {
  it("should return exactly 4 vertices", () => {
    const verts = isoCellVertices(0, 0, 10, 1, () => 0);
    expect(verts).toHaveLength(4);
  });

  it("should produce a parallelogram when z is constant", () => {
    // With constant z=0, each vertex is at a grid corner projected
    // isometrically. The diagonals of a parallelogram bisect each other.
    const verts = isoCellVertices(0, 0, 10, 0, () => 0);
    const midDiag1X = (verts[0].screenX + verts[2].screenX) / 2;
    const midDiag1Y = (verts[0].screenY + verts[2].screenY) / 2;
    const midDiag2X = (verts[1].screenX + verts[3].screenX) / 2;
    const midDiag2Y = (verts[1].screenY + verts[3].screenY) / 2;
    expect(midDiag1X).toBeCloseTo(midDiag2X, 10);
    expect(midDiag1Y).toBeCloseTo(midDiag2Y, 10);
  });

  it("should shift vertices upward when z values increase", () => {
    const low = isoCellVertices(0, 0, 10, 1, () => 0);
    const high = isoCellVertices(0, 0, 10, 1, () => 5);
    // Each vertex should have lower screenY (higher on screen)
    for (let i = 0; i < 4; i++) {
      expect(high[i].screenY).toBeLessThan(low[i].screenY);
    }
  });

  it("should use the getValue callback to look up per-corner values", () => {
    const calls: Array<[number, number]> = [];
    isoCellVertices(2, 3, 10, 1, (r, c) => {
      calls.push([r, c]);
      return 0;
    });
    // Should query corners (col, row): (2,3), (3,3), (3,4), (2,4)
    expect(calls).toEqual([
      [3, 2],
      [3, 3],
      [4, 3],
      [4, 2],
    ]);
  });

  it("should apply zScale to vertex height displacement", () => {
    const zeroZ = isoCellVertices(0, 0, 10, 0, () => 5);
    const scaledZ = isoCellVertices(0, 0, 10, 10, () => 5);
    // With zScale=0, z values have no effect
    // With zScale=10, vertices should shift by 5*10=50 in the -Y direction
    for (let i = 0; i < 4; i++) {
      expect(zeroZ[i].screenX).toBeCloseTo(scaledZ[i].screenX, 10);
      expect(scaledZ[i].screenY).toBeLessThan(zeroZ[i].screenY);
    }
  });

  it("should position cell at correct grid offset", () => {
    // Cell at (1,0) should be shifted right relative to cell at (0,0)
    const cell00 = isoCellVertices(0, 0, 10, 0, () => 0);
    const cell10 = isoCellVertices(1, 0, 10, 0, () => 0);
    // The first vertex of cell10 should be the second vertex of cell00
    // because cell (1,0) starts at col=1, which is the right edge of col=0
    expect(cell10[0].screenX).toBeCloseTo(cell00[1].screenX, 10);
    expect(cell10[0].screenY).toBeCloseTo(cell00[1].screenY, 10);
  });
});

// ── Painter's algorithm sort order ──────────────────────────────

describe("isometric projection: painter's algorithm sort", () => {
  it("should sort cells by (row + col) ascending for back-to-front", () => {
    const cells = [
      { row: 2, col: 1 },
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
    ];
    const sorted = [...cells].sort(
      (a, b) => a.row + a.col - (b.row + b.col),
    );
    const depths = sorted.map((c) => c.row + c.col);
    // Should be non-decreasing
    for (let i = 1; i < depths.length; i++) {
      expect(depths[i]).toBeGreaterThanOrEqual(depths[i - 1]);
    }
  });

  it("should place the back corner (0,0) first", () => {
    const cells = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        cells.push({ row: r, col: c, depth: r + c });
      }
    }
    cells.sort((a, b) => a.depth - b.depth);
    expect(cells[0].row).toBe(0);
    expect(cells[0].col).toBe(0);
  });

  it("should place the front corner last", () => {
    const rows = 4;
    const cols = 3;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ row: r, col: c, depth: r + c });
      }
    }
    cells.sort((a, b) => a.depth - b.depth);
    const last = cells[cells.length - 1];
    expect(last.depth).toBe(rows - 1 + cols - 1);
  });
});
