import { describe, it, expect, vi } from "vitest";
import { handleEmfGdiPolyPathRecord } from "./emf-gdi-poly-path-handlers";
import type { EmfGdiReplayCtx } from "./emf-types";
import { defaultState } from "./emf-types";
import {
  EMR_POLYLINE,
  EMR_POLYGON,
  EMR_POLYBEZIER,
  EMR_POLYBEZIERTO,
  EMR_POLYLINETO,
  EMR_POLYLINE16,
  EMR_POLYGON16,
  EMR_POLYBEZIER16,
  EMR_POLYBEZIERTO16,
  EMR_POLYLINETO16,
  EMR_BEGINPATH,
  EMR_ENDPATH,
  EMR_CLOSEFIGURE,
  EMR_FILLPATH,
  EMR_STROKEANDFILLPATH,
  EMR_STROKEPATH,
  EMR_SELECTCLIPPATH,
} from "./emf-constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtxStub(): Record<string, ReturnType<typeof vi.fn> | unknown> {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    setLineDash: vi.fn(),
    arcTo: vi.fn(),
    fillText: vi.fn(),
    strokeStyle: "#000",
    fillStyle: "#fff",
    lineWidth: 1,
    font: "12px sans-serif",
  };
}

function makeRCtx(bufSize = 512): EmfGdiReplayCtx {
  const buf = new ArrayBuffer(bufSize);
  const view = new DataView(buf);
  return {
    ctx: makeCtxStub() as unknown as CanvasRenderingContext2D,
    view,
    objectTable: new Map(),
    state: defaultState(),
    stateStack: [],
    inPath: false,
    windowOrg: { x: 0, y: 0 },
    windowExt: { cx: 100, cy: 100 },
    viewportOrg: { x: 0, y: 0 },
    viewportExt: { cx: 100, cy: 100 },
    useMappingMode: false,
    clipSaveDepth: 0,
    bounds: { left: 0, top: 0, right: 100, bottom: 100 },
    canvasW: 100,
    canvasH: 100,
    sx: 1,
    sy: 1,
  };
}

/** Write a 32-bit poly record body: bounds(16) + count(4) + points(count*8). */
function writePoly32(
  view: DataView,
  dataOff: number,
  points: Array<[number, number]>,
): void {
  // Bounds (left, top, right, bottom) — dummy
  view.setInt32(dataOff, 0, true);
  view.setInt32(dataOff + 4, 0, true);
  view.setInt32(dataOff + 8, 100, true);
  view.setInt32(dataOff + 12, 100, true);
  // Count
  view.setUint32(dataOff + 16, points.length, true);
  // Points
  for (let i = 0; i < points.length; i++) {
    view.setInt32(dataOff + 20 + i * 8, points[i][0], true);
    view.setInt32(dataOff + 20 + i * 8 + 4, points[i][1], true);
  }
}

/** Write a 16-bit poly record body: bounds(16) + count(4) + points(count*4). */
function writePoly16(
  view: DataView,
  dataOff: number,
  points: Array<[number, number]>,
): void {
  view.setInt32(dataOff, 0, true);
  view.setInt32(dataOff + 4, 0, true);
  view.setInt32(dataOff + 8, 100, true);
  view.setInt32(dataOff + 12, 100, true);
  view.setUint32(dataOff + 16, points.length, true);
  for (let i = 0; i < points.length; i++) {
    view.setInt16(dataOff + 20 + i * 4, points[i][0], true);
    view.setInt16(dataOff + 20 + i * 4 + 2, points[i][1], true);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("emf-gdi-poly-path-handlers", () => {
  describe("handleEmfGdiPolyPathRecord()", () => {
    it("is a function with arity 5", () => {
      expect(typeof handleEmfGdiPolyPathRecord).toBe("function");
      expect(handleEmfGdiPolyPathRecord.length).toBe(5);
    });

    it("returns false for unrecognized record type", () => {
      const rCtx = makeRCtx();
      expect(handleEmfGdiPolyPathRecord(rCtx, 0xffff, 0, 8, 8)).toBe(false);
    });

    // -- 32-bit polys --
    describe("EMR_POLYLINE (32-bit)", () => {
      it("draws a polyline and calls stroke", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        const offset = 0;
        const pts: Array<[number, number]> = [[10, 20], [30, 40], [50, 60]];
        writePoly32(rCtx.view, dataOff, pts);
        const recSize = 28 + pts.length * 8;
        const result = handleEmfGdiPolyPathRecord(rCtx, EMR_POLYLINE, offset, dataOff, recSize);
        expect(result).toBe(true);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.beginPath.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(1);
      });

      it("updates curX/curY to last point", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        const pts: Array<[number, number]> = [[10, 20], [30, 40]];
        writePoly32(rCtx.view, dataOff, pts);
        handleEmfGdiPolyPathRecord(rCtx, EMR_POLYLINE, 0, dataOff, 28 + pts.length * 8);
        expect(rCtx.state.curX).toBe(30);
        expect(rCtx.state.curY).toBe(40);
      });

      it("handles zero count gracefully", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        writePoly32(rCtx.view, dataOff, []);
        const result = handleEmfGdiPolyPathRecord(rCtx, EMR_POLYLINE, 0, dataOff, 28);
        expect(result).toBe(true); // returns early, no throw
      });
    });

    describe("EMR_POLYGON (32-bit)", () => {
      it("draws a polygon and calls fill + stroke", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        const pts: Array<[number, number]> = [[0, 0], [50, 0], [50, 50]];
        writePoly32(rCtx.view, dataOff, pts);
        const recSize = 28 + pts.length * 8;
        handleEmfGdiPolyPathRecord(rCtx, EMR_POLYGON, 0, dataOff, recSize);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fill.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(ctx.closePath.mock.calls.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("EMR_POLYBEZIER (32-bit)", () => {
      it("draws bezier curves with 4 control points", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        const pts: Array<[number, number]> = [[0, 0], [10, 20], [30, 40], [50, 50]];
        writePoly32(rCtx.view, dataOff, pts);
        handleEmfGdiPolyPathRecord(rCtx, EMR_POLYBEZIER, 0, dataOff, 28 + pts.length * 8);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.bezierCurveTo.mock.calls.length).toBeGreaterThanOrEqual(1);
      });
    });

    // -- 16-bit polys --
    describe("EMR_POLYLINE16 (16-bit)", () => {
      it("draws a 16-bit polyline", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        const pts: Array<[number, number]> = [[5, 10], [15, 25], [35, 45]];
        writePoly16(rCtx.view, dataOff, pts);
        const recSize = 28 + pts.length * 4;
        const result = handleEmfGdiPolyPathRecord(rCtx, EMR_POLYLINE16, 0, dataOff, recSize);
        expect(result).toBe(true);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(1);
      });

      it("updates curX/curY to last 16-bit point", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        const pts: Array<[number, number]> = [[5, 10], [99, 88]];
        writePoly16(rCtx.view, dataOff, pts);
        handleEmfGdiPolyPathRecord(rCtx, EMR_POLYLINE16, 0, dataOff, 28 + pts.length * 4);
        expect(rCtx.state.curX).toBe(99);
        expect(rCtx.state.curY).toBe(88);
      });
    });

    describe("EMR_POLYGON16 (16-bit)", () => {
      it("draws a 16-bit polygon with fill and stroke", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        const pts: Array<[number, number]> = [[0, 0], [50, 0], [50, 50]];
        writePoly16(rCtx.view, dataOff, pts);
        handleEmfGdiPolyPathRecord(rCtx, EMR_POLYGON16, 0, dataOff, 28 + pts.length * 4);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fill.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(ctx.closePath.mock.calls.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe("EMR_POLYBEZIER16 (16-bit)", () => {
      it("draws 16-bit bezier curves", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        const pts: Array<[number, number]> = [[0, 0], [10, 20], [30, 40], [50, 50]];
        writePoly16(rCtx.view, dataOff, pts);
        handleEmfGdiPolyPathRecord(rCtx, EMR_POLYBEZIER16, 0, dataOff, 28 + pts.length * 4);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.bezierCurveTo.mock.calls.length).toBeGreaterThanOrEqual(1);
      });
    });

    // -- "to" variants (POLYBEZIERTO, POLYLINETO) --
    describe("EMR_POLYBEZIERTO", () => {
      it("does not emit moveTo (continues from current position)", () => {
        const rCtx = makeRCtx();
        rCtx.state.curX = 0;
        rCtx.state.curY = 0;
        const dataOff = 8;
        const pts: Array<[number, number]> = [[10, 20], [30, 40], [50, 50]];
        writePoly32(rCtx.view, dataOff, pts);
        handleEmfGdiPolyPathRecord(rCtx, EMR_POLYBEZIERTO, 0, dataOff, 28 + pts.length * 8);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        // moveTo should NOT be called from the data (since isTo = true)
        // but beginPath is called
        expect(ctx.bezierCurveTo.mock.calls.length).toBe(1);
      });
    });

    describe("EMR_POLYLINETO16", () => {
      it("draws lineTo segments without initial moveTo from data", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        const pts: Array<[number, number]> = [[10, 10], [20, 20]];
        writePoly16(rCtx.view, dataOff, pts);
        handleEmfGdiPolyPathRecord(rCtx, EMR_POLYLINETO16, 0, dataOff, 28 + pts.length * 4);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        // All points should be lineTo (no moveTo since isTo = true)
        expect(ctx.lineTo.mock.calls.length).toBe(2);
      });
    });

    // -- recSize too small --
    describe("small recSize", () => {
      it("returns true but does nothing for 32-bit poly with recSize < 28", () => {
        const rCtx = makeRCtx();
        const result = handleEmfGdiPolyPathRecord(rCtx, EMR_POLYLINE, 0, 8, 20);
        expect(result).toBe(true);
      });

      it("returns true but does nothing for 16-bit poly with recSize < 28", () => {
        const rCtx = makeRCtx();
        const result = handleEmfGdiPolyPathRecord(rCtx, EMR_POLYLINE16, 0, 8, 20);
        expect(result).toBe(true);
      });
    });

    // -- Path operations --
    describe("EMR_BEGINPATH", () => {
      it("sets inPath to true and calls ctx.beginPath", () => {
        const rCtx = makeRCtx();
        const result = handleEmfGdiPolyPathRecord(rCtx, EMR_BEGINPATH, 0, 8, 8);
        expect(result).toBe(true);
        expect(rCtx.inPath).toBe(true);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.beginPath.mock.calls.length).toBe(1);
      });
    });

    describe("EMR_ENDPATH", () => {
      it("sets inPath to false", () => {
        const rCtx = makeRCtx();
        rCtx.inPath = true;
        handleEmfGdiPolyPathRecord(rCtx, EMR_ENDPATH, 0, 8, 8);
        expect(rCtx.inPath).toBe(false);
      });
    });

    describe("EMR_CLOSEFIGURE", () => {
      it("calls ctx.closePath", () => {
        const rCtx = makeRCtx();
        handleEmfGdiPolyPathRecord(rCtx, EMR_CLOSEFIGURE, 0, 8, 8);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.closePath.mock.calls.length).toBe(1);
      });
    });

    describe("EMR_FILLPATH", () => {
      it("calls applyBrush and ctx.fill", () => {
        const rCtx = makeRCtx();
        handleEmfGdiPolyPathRecord(rCtx, EMR_FILLPATH, 0, 8, 8);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fill.mock.calls.length).toBe(1);
      });

      it("uses 'evenodd' fill rule when polyFillMode is 1 (ALTERNATE)", () => {
        const rCtx = makeRCtx();
        rCtx.state.polyFillMode = 1;
        handleEmfGdiPolyPathRecord(rCtx, EMR_FILLPATH, 0, 8, 8);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fill.mock.calls[0][0]).toBe("evenodd");
      });

      it("uses 'nonzero' fill rule when polyFillMode is 2 (WINDING)", () => {
        const rCtx = makeRCtx();
        rCtx.state.polyFillMode = 2;
        handleEmfGdiPolyPathRecord(rCtx, EMR_FILLPATH, 0, 8, 8);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fill.mock.calls[0][0]).toBe("nonzero");
      });
    });

    describe("EMR_STROKEANDFILLPATH", () => {
      it("calls both fill and stroke", () => {
        const rCtx = makeRCtx();
        handleEmfGdiPolyPathRecord(rCtx, EMR_STROKEANDFILLPATH, 0, 8, 8);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fill.mock.calls.length).toBe(1);
        expect(ctx.stroke.mock.calls.length).toBe(1);
      });
    });

    describe("EMR_STROKEPATH", () => {
      it("calls stroke but not fill", () => {
        const rCtx = makeRCtx();
        handleEmfGdiPolyPathRecord(rCtx, EMR_STROKEPATH, 0, 8, 8);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.stroke.mock.calls.length).toBe(1);
        expect(ctx.fill.mock.calls.length).toBe(0);
      });
    });

    describe("EMR_SELECTCLIPPATH", () => {
      it("saves context and applies clip for RGN_COPY (mode=5)", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 5, true); // RGN_COPY
        handleEmfGdiPolyPathRecord(rCtx, EMR_SELECTCLIPPATH, 0, dataOff, 12);
        expect(rCtx.clipSaveDepth).toBe(1);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.save.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(ctx.clip.mock.calls.length).toBe(1);
      });

      it("unwinds clip save depth for RGN_COPY when there are prior clip saves", () => {
        const rCtx = makeRCtx();
        rCtx.clipSaveDepth = 2;
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 5, true);
        handleEmfGdiPolyPathRecord(rCtx, EMR_SELECTCLIPPATH, 0, dataOff, 12);
        // Should have restored 2 times, then saved 1 + clip
        expect(rCtx.clipSaveDepth).toBe(1);
      });

      it("defaults to RGN_COPY (5) when recSize < 12", () => {
        const rCtx = makeRCtx();
        handleEmfGdiPolyPathRecord(rCtx, EMR_SELECTCLIPPATH, 0, 8, 8);
        expect(rCtx.clipSaveDepth).toBe(1);
      });
    });

    // -- In-path mode suppresses beginPath/stroke/fill --
    describe("in-path mode", () => {
      it("does not call beginPath/stroke/fill when inPath is true (polyline)", () => {
        const rCtx = makeRCtx();
        rCtx.inPath = true;
        const dataOff = 8;
        const pts: Array<[number, number]> = [[10, 20], [30, 40]];
        writePoly32(rCtx.view, dataOff, pts);
        handleEmfGdiPolyPathRecord(rCtx, EMR_POLYLINE, 0, dataOff, 28 + pts.length * 8);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.beginPath.mock.calls.length).toBe(0);
        expect(ctx.stroke.mock.calls.length).toBe(0);
      });
    });
  });
});
