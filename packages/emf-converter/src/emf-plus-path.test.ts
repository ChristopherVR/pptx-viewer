import { describe, it, expect } from "vitest";
import { parseEmfPlusPath, replayEmfPlusPath } from "./emf-plus-path";
import type { EmfPlusPath } from "./emf-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a binary buffer for an EMF+ path with compressed (Int16) points.
 */
function buildCompressedPathBuffer(
  points: Array<{ x: number; y: number }>,
  types: number[],
): DataView {
  const pointCount = points.length;
  const pathFlags = 0x4000; // compressed flag
  const pointsBytes = pointCount * 4; // 2 Int16 per point
  const typesOffset = 12 + pointsBytes;
  const alignedTypesOffset = (typesOffset + 3) & ~3;
  const totalSize = alignedTypesOffset + pointCount;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);

  // Header
  view.setUint32(0, 0xDBC01002, true); // version
  view.setUint32(4, pointCount, true);
  view.setUint32(8, pathFlags, true);

  // Points (Int16 compressed)
  let off = 12;
  for (const p of points) {
    view.setInt16(off, p.x, true);
    view.setInt16(off + 2, p.y, true);
    off += 4;
  }

  // Types (after 4-byte alignment)
  const typesArr = new Uint8Array(buf, alignedTypesOffset, pointCount);
  for (let i = 0; i < types.length; i++) {
    typesArr[i] = types[i];
  }

  return view;
}

/**
 * Build a binary buffer for an EMF+ path with uncompressed (Float32) points.
 */
function buildUncompressedPathBuffer(
  points: Array<{ x: number; y: number }>,
  types: number[],
): DataView {
  const pointCount = points.length;
  const pathFlags = 0; // no compression
  const pointsBytes = pointCount * 8; // 2 Float32 per point
  const typesOffset = 12 + pointsBytes;
  const alignedTypesOffset = (typesOffset + 3) & ~3;
  const totalSize = alignedTypesOffset + pointCount;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);

  view.setUint32(0, 0xDBC01002, true);
  view.setUint32(4, pointCount, true);
  view.setUint32(8, pathFlags, true);

  let off = 12;
  for (const p of points) {
    view.setFloat32(off, p.x, true);
    view.setFloat32(off + 4, p.y, true);
    off += 8;
  }

  const typesArr = new Uint8Array(buf, alignedTypesOffset, pointCount);
  for (let i = 0; i < types.length; i++) {
    typesArr[i] = types[i];
  }

  return view;
}

// ---------------------------------------------------------------------------
// parseEmfPlusPath
// ---------------------------------------------------------------------------

describe("parseEmfPlusPath", () => {
  it("returns null for too-short buffer", () => {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    expect(parseEmfPlusPath(view, 0, 8)).toBeNull();
  });

  it("returns null for zero pointCount", () => {
    const buf = new ArrayBuffer(16);
    const view = new DataView(buf);
    view.setUint32(0, 0, true); // version
    view.setUint32(4, 0, true); // pointCount = 0
    view.setUint32(8, 0, true); // flags
    expect(parseEmfPlusPath(view, 0, 16)).toBeNull();
  });

  it("returns null for excessive pointCount", () => {
    const buf = new ArrayBuffer(16);
    const view = new DataView(buf);
    view.setUint32(4, 200000, true); // too many points
    expect(parseEmfPlusPath(view, 0, 16)).toBeNull();
  });

  it("parses compressed path with Int16 points", () => {
    const points = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ];
    const types = [0, 1, 1]; // start, line, line
    const view = buildCompressedPathBuffer(points, types);

    const result = parseEmfPlusPath(view, 0, view.byteLength);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe("plus-path");
    expect(result!.points).toHaveLength(3);
    expect(result!.points[0]).toEqual({ x: 10, y: 20 });
    expect(result!.points[1]).toEqual({ x: 30, y: 40 });
    expect(result!.points[2]).toEqual({ x: 50, y: 60 });
  });

  it("parses uncompressed path with Float32 points", () => {
    const points = [
      { x: 1.5, y: 2.5 },
      { x: 3.5, y: 4.5 },
    ];
    const types = [0, 1]; // start, line
    const view = buildUncompressedPathBuffer(points, types);

    const result = parseEmfPlusPath(view, 0, view.byteLength);
    expect(result).not.toBeNull();
    expect(result!.points).toHaveLength(2);
    expect(result!.points[0].x).toBeCloseTo(1.5);
    expect(result!.points[0].y).toBeCloseTo(2.5);
  });

  it("preserves type bytes for each point", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    const types = [0, 1, 0x81]; // start, line, line+close
    const view = buildCompressedPathBuffer(points, types);

    const result = parseEmfPlusPath(view, 0, view.byteLength);
    expect(result).not.toBeNull();
    expect(result!.types[0]).toBe(0);
    expect(result!.types[1]).toBe(1);
    expect(result!.types[2]).toBe(0x81);
  });

  it("returns null when maxLen is too small for points + types", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    const types = [0, 1];
    const view = buildCompressedPathBuffer(points, types);
    // Pass a maxLen that's too small
    expect(parseEmfPlusPath(view, 0, 14)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// replayEmfPlusPath
// ---------------------------------------------------------------------------

describe("replayEmfPlusPath", () => {
  function createMockCtx() {
    const calls: Array<{ method: string; args: number[] }> = [];
    return {
      calls,
      beginPath() { calls.push({ method: "beginPath", args: [] }); },
      moveTo(x: number, y: number) { calls.push({ method: "moveTo", args: [x, y] }); },
      lineTo(x: number, y: number) { calls.push({ method: "lineTo", args: [x, y] }); },
      bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
        calls.push({ method: "bezierCurveTo", args: [x1, y1, x2, y2, x, y] });
      },
      closePath() { calls.push({ method: "closePath", args: [] }); },
    };
  }

  it("calls beginPath at the start", () => {
    const ctx = createMockCtx();
    const path: EmfPlusPath = {
      kind: "plus-path",
      points: [{ x: 0, y: 0 }],
      types: new Uint8Array([0]),
    };
    replayEmfPlusPath(ctx as any, path);
    expect(ctx.calls[0].method).toBe("beginPath");
  });

  it("calls moveTo for type 0 (Start)", () => {
    const ctx = createMockCtx();
    const path: EmfPlusPath = {
      kind: "plus-path",
      points: [{ x: 5, y: 10 }],
      types: new Uint8Array([0]),
    };
    replayEmfPlusPath(ctx as any, path);
    expect(ctx.calls[1]).toEqual({ method: "moveTo", args: [5, 10] });
  });

  it("calls lineTo for type 1 (Line)", () => {
    const ctx = createMockCtx();
    const path: EmfPlusPath = {
      kind: "plus-path",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
      ],
      types: new Uint8Array([0, 1]),
    };
    replayEmfPlusPath(ctx as any, path);
    expect(ctx.calls[2]).toEqual({ method: "lineTo", args: [100, 50] });
  });

  it("calls bezierCurveTo for type 3 (Bezier)", () => {
    const ctx = createMockCtx();
    const path: EmfPlusPath = {
      kind: "plus-path",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ],
      types: new Uint8Array([0, 3, 3, 3]),
    };
    replayEmfPlusPath(ctx as any, path);
    const bezierCall = ctx.calls.find((c) => c.method === "bezierCurveTo");
    expect(bezierCall).toBeDefined();
    expect(bezierCall!.args).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("calls closePath when close flag (0x80) is set", () => {
    const ctx = createMockCtx();
    const path: EmfPlusPath = {
      kind: "plus-path",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      types: new Uint8Array([0, 1, 0x81]), // last line has close flag
    };
    replayEmfPlusPath(ctx as any, path);
    const closeCall = ctx.calls.find((c) => c.method === "closePath");
    expect(closeCall).toBeDefined();
  });

  it("handles empty path without errors", () => {
    const ctx = createMockCtx();
    const path: EmfPlusPath = {
      kind: "plus-path",
      points: [],
      types: new Uint8Array([]),
    };
    replayEmfPlusPath(ctx as any, path);
    expect(ctx.calls).toHaveLength(1); // only beginPath
  });

  it("falls back to lineTo for unknown type values", () => {
    const ctx = createMockCtx();
    const path: EmfPlusPath = {
      kind: "plus-path",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      types: new Uint8Array([0, 7]), // 7 is unknown
    };
    replayEmfPlusPath(ctx as any, path);
    expect(ctx.calls[2]).toEqual({ method: "lineTo", args: [10, 10] });
  });
});
