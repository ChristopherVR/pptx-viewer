import { describe, it, expect, vi } from "vitest";
import {
  handlePolyPolygon32,
  handlePolyPolyline32,
  handlePolyPolygon16,
} from "./emf-gdi-polypolygon-helpers";
import type { EmfGdiReplayCtx, DrawState } from "./emf-types";
import { defaultState } from "./emf-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBuffer(
  size: number,
  writer: (view: DataView) => void,
): DataView {
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  writer(view);
  return view;
}

/** Create a mock canvas context that records path commands. */
function mockCtx() {
  const calls: Array<{ method: string; args: any[] }> = [];
  return {
    calls,
    beginPath: vi.fn(() => calls.push({ method: "beginPath", args: [] })),
    moveTo: vi.fn((x: number, y: number) =>
      calls.push({ method: "moveTo", args: [x, y] }),
    ),
    lineTo: vi.fn((x: number, y: number) =>
      calls.push({ method: "lineTo", args: [x, y] }),
    ),
    closePath: vi.fn(() => calls.push({ method: "closePath", args: [] })),
    fill: vi.fn((rule?: string) =>
      calls.push({ method: "fill", args: [rule] }),
    ),
    stroke: vi.fn(() => calls.push({ method: "stroke", args: [] })),
    // Stubs needed by applyPen / applyBrush
    setLineDash: vi.fn(),
    lineWidth: 1,
    strokeStyle: "",
    fillStyle: "",
    lineCap: "butt",
    lineJoin: "miter",
    globalAlpha: 1,
  };
}

/**
 * Build a minimal EmfGdiReplayCtx for polypolygon tests.
 * Uses identity mapping (sx=1, sy=1, bounds at origin, useMappingMode=false).
 */
function makeCtx(
  view: DataView,
  state?: Partial<DrawState>,
): { rCtx: EmfGdiReplayCtx; ctx: ReturnType<typeof mockCtx> } {
  const ctx = mockCtx();
  const ds = { ...defaultState(), ...state };
  const rCtx: EmfGdiReplayCtx = {
    ctx: ctx as any,
    view,
    objectTable: new Map(),
    state: ds,
    stateStack: [],
    inPath: false,
    windowOrg: { x: 0, y: 0 },
    windowExt: { cx: 1, cy: 1 },
    viewportOrg: { x: 0, y: 0 },
    viewportExt: { cx: 1, cy: 1 },
    useMappingMode: false,
    clipSaveDepth: 0,
    bounds: { left: 0, top: 0, right: 100, bottom: 100 },
    canvasW: 100,
    canvasH: 100,
    sx: 1,
    sy: 1,
  };
  return { rCtx, ctx };
}

/**
 * Build a buffer containing a PolyPolygon32 record with a single polygon.
 * Record layout (starting at dataOff):
 *   +0..+15  : ignored by handler (bounds rect)
 *   +16      : numPolys (uint32)
 *   +20      : totalPoints (uint32)
 *   +24      : counts array (numPolys * uint32)
 *   +24+N*4  : points array (totalPoints * 8 bytes: int32 x, int32 y)
 */
function buildPolyPolygon32(
  polygons: Array<Array<{ x: number; y: number }>>,
): { view: DataView; dataOff: number; recSize: number } {
  const numPolys = polygons.length;
  const totalPoints = polygons.reduce((s, p) => s + p.length, 0);
  const countsOff = 24;
  const ptOff = countsOff + numPolys * 4;
  const recSize = ptOff + totalPoints * 8;
  const view = buildBuffer(recSize, (v) => {
    v.setUint32(16, numPolys, true);
    v.setUint32(20, totalPoints, true);
    let pIdx = 0;
    for (let p = 0; p < numPolys; p++) {
      v.setUint32(countsOff + p * 4, polygons[p].length, true);
      for (const pt of polygons[p]) {
        v.setInt32(ptOff + pIdx * 8, pt.x, true);
        v.setInt32(ptOff + pIdx * 8 + 4, pt.y, true);
        pIdx++;
      }
    }
  });
  return { view, dataOff: 0, recSize };
}

/**
 * Build a PolyPolygon16 record (Int16 points instead of Int32).
 */
function buildPolyPolygon16(
  polygons: Array<Array<{ x: number; y: number }>>,
): { view: DataView; dataOff: number; recSize: number } {
  const numPolys = polygons.length;
  const totalPoints = polygons.reduce((s, p) => s + p.length, 0);
  const countsOff = 24;
  const ptOff = countsOff + numPolys * 4;
  const recSize = ptOff + totalPoints * 4; // 16-bit: 2 bytes x + 2 bytes y
  const view = buildBuffer(recSize, (v) => {
    v.setUint32(16, numPolys, true);
    v.setUint32(20, totalPoints, true);
    let pIdx = 0;
    for (let p = 0; p < numPolys; p++) {
      v.setUint32(countsOff + p * 4, polygons[p].length, true);
      for (const pt of polygons[p]) {
        v.setInt16(ptOff + pIdx * 4, pt.x, true);
        v.setInt16(ptOff + pIdx * 4 + 2, pt.y, true);
        pIdx++;
      }
    }
  });
  return { view, dataOff: 0, recSize };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("emf-gdi-polypolygon-helpers", () => {
  // -----------------------------------------------------------------------
  // handlePolyPolygon32
  // -----------------------------------------------------------------------
  describe("handlePolyPolygon32()", () => {
    it("draws a single triangle", () => {
      const triangle = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 25, y: 50 },
      ];
      const { view, dataOff, recSize } = buildPolyPolygon32([triangle]);
      const { rCtx, ctx } = makeCtx(view);

      handlePolyPolygon32(rCtx, 0, dataOff, recSize);

      expect(ctx.beginPath).toHaveBeenCalledTimes(1);
      expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
      expect(ctx.lineTo).toHaveBeenCalledTimes(2);
      expect(ctx.closePath).toHaveBeenCalledTimes(1);
      expect(ctx.stroke).toHaveBeenCalledTimes(1);
    });

    it("draws two separate polygons", () => {
      const poly1 = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ];
      const poly2 = [
        { x: 20, y: 20 },
        { x: 30, y: 20 },
        { x: 30, y: 30 },
        { x: 20, y: 30 },
      ];
      const { view, dataOff, recSize } = buildPolyPolygon32([poly1, poly2]);
      const { rCtx, ctx } = makeCtx(view);

      handlePolyPolygon32(rCtx, 0, dataOff, recSize);

      // Two polygons = two moveTo calls and two closePath calls
      expect(ctx.moveTo).toHaveBeenCalledTimes(2);
      expect(ctx.closePath).toHaveBeenCalledTimes(2);
    });

    it("bails out when numPolys is 0", () => {
      const view = buildBuffer(32, (v) => {
        v.setUint32(16, 0, true); // numPolys = 0
        v.setUint32(20, 0, true); // totalPoints = 0
      });
      const { rCtx, ctx } = makeCtx(view);

      handlePolyPolygon32(rCtx, 0, 0, 32);

      expect(ctx.beginPath).not.toHaveBeenCalled();
    });

    it("bails out when numPolys is absurdly large (>= 10000)", () => {
      const view = buildBuffer(32, (v) => {
        v.setUint32(16, 10000, true);
        v.setUint32(20, 100000, true);
      });
      const { rCtx, ctx } = makeCtx(view);

      handlePolyPolygon32(rCtx, 0, 0, 32);

      expect(ctx.beginPath).not.toHaveBeenCalled();
    });

    it("uses evenodd fill rule when polyFillMode is 1 (ALTERNATE)", () => {
      const triangle = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 25, y: 50 },
      ];
      const { view, dataOff, recSize } = buildPolyPolygon32([triangle]);
      const { rCtx, ctx } = makeCtx(view, { polyFillMode: 1 });

      handlePolyPolygon32(rCtx, 0, dataOff, recSize);

      expect(ctx.fill).toHaveBeenCalledWith("evenodd");
    });

    it("uses nonzero fill rule when polyFillMode is 2 (WINDING)", () => {
      const triangle = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 25, y: 50 },
      ];
      const { view, dataOff, recSize } = buildPolyPolygon32([triangle]);
      const { rCtx, ctx } = makeCtx(view, { polyFillMode: 2 });

      handlePolyPolygon32(rCtx, 0, dataOff, recSize);

      expect(ctx.fill).toHaveBeenCalledWith("nonzero");
    });
  });

  // -----------------------------------------------------------------------
  // handlePolyPolyline32
  // -----------------------------------------------------------------------
  describe("handlePolyPolyline32()", () => {
    it("draws a polyline (no closePath, no fill)", () => {
      const line = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ];
      const { view, dataOff, recSize } = buildPolyPolygon32([line]);
      const { rCtx, ctx } = makeCtx(view);

      handlePolyPolyline32(rCtx, 0, dataOff, recSize);

      expect(ctx.beginPath).toHaveBeenCalledTimes(1);
      expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
      expect(ctx.lineTo).toHaveBeenCalledTimes(2);
      // Polyline does NOT call closePath or fill
      expect(ctx.closePath).not.toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // handlePolyPolygon16
  // -----------------------------------------------------------------------
  describe("handlePolyPolygon16()", () => {
    it("draws a single triangle with 16-bit coordinates", () => {
      const triangle = [
        { x: 10, y: 20 },
        { x: 60, y: 20 },
        { x: 35, y: 70 },
      ];
      const { view, dataOff, recSize } = buildPolyPolygon16([triangle]);
      const { rCtx, ctx } = makeCtx(view);

      handlePolyPolygon16(rCtx, 0, dataOff, recSize);

      expect(ctx.beginPath).toHaveBeenCalledTimes(1);
      expect(ctx.moveTo).toHaveBeenCalledWith(10, 20);
      expect(ctx.lineTo).toHaveBeenCalledTimes(2);
      expect(ctx.closePath).toHaveBeenCalledTimes(1);
    });

    it("bails out when point data extends beyond record size", () => {
      // Create a record that claims to have points but has a tiny recSize
      const view = buildBuffer(32, (v) => {
        v.setUint32(16, 1, true); // numPolys
        v.setUint32(20, 100, true); // totalPoints (too many for buffer)
        v.setUint32(24, 100, true); // count for poly 0
      });
      const { rCtx, ctx } = makeCtx(view);

      handlePolyPolygon16(rCtx, 0, 0, 32);

      // Should bail out because ptOff + totalPoints * 4 > offset + recSize
      expect(ctx.beginPath).not.toHaveBeenCalled();
    });
  });
});
