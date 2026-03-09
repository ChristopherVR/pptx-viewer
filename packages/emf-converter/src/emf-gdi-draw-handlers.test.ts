import { describe, it, expect, vi } from "vitest";
import { handleEmfGdiDrawRecord } from "./emf-gdi-draw-handlers";
import type { EmfGdiReplayCtx } from "./emf-types";
import { defaultState } from "./emf-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtxStub(): Record<string, unknown> {
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
    fillText: vi.fn(),
    drawImage: vi.fn(),
    strokeStyle: "#000000",
    fillStyle: "#ffffff",
    lineWidth: 1,
    font: "12px sans-serif",
    textBaseline: "top",
    textAlign: "left",
  };
}

function makeRCtx(bufSize = 256): EmfGdiReplayCtx {
  const buf = new ArrayBuffer(bufSize);
  const view = new DataView(buf);
  const ctx = makeCtxStub();
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    view,
    objectTable: new Map(),
    state: defaultState(),
    stateStack: [],
    inPath: false,
    windowOrg: { x: 0, y: 0 },
    windowExt: { cx: 1000, cy: 1000 },
    viewportOrg: { x: 0, y: 0 },
    viewportExt: { cx: 1000, cy: 1000 },
    useMappingMode: false,
    clipSaveDepth: 0,
    bounds: { left: 0, top: 0, right: 1000, bottom: 1000 },
    canvasW: 500,
    canvasH: 500,
    sx: 0.5,
    sy: 0.5,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("emf-gdi-draw-handlers", () => {
  describe("handleEmfGdiDrawRecord()", () => {
    it("is a function with arity 5", () => {
      expect(typeof handleEmfGdiDrawRecord).toBe("function");
      expect(handleEmfGdiDrawRecord.length).toBe(5);
    });

    it("returns false for an unrecognized record type", () => {
      const rCtx = makeRCtx();
      const result = handleEmfGdiDrawRecord(rCtx, 0xffff, 0, 8, 8);
      expect(result).toBe(false);
    });

    it("returns true for EMR_RECTANGLE (43) with valid data", () => {
      const rCtx = makeRCtx();
      // EMR_RECTANGLE expects 4 int32s: left, top, right, bottom at dataOff
      const dataOff = 8;
      rCtx.view.setInt32(dataOff, 10, true); // left
      rCtx.view.setInt32(dataOff + 4, 20, true); // top
      rCtx.view.setInt32(dataOff + 8, 100, true); // right
      rCtx.view.setInt32(dataOff + 12, 200, true); // bottom
      const result = handleEmfGdiDrawRecord(rCtx, 43, 0, dataOff, 24);
      expect(result).toBe(true);
    });

    it("returns true for EMR_ELLIPSE (42) with valid data", () => {
      const rCtx = makeRCtx();
      const dataOff = 8;
      rCtx.view.setInt32(dataOff, 0, true);
      rCtx.view.setInt32(dataOff + 4, 0, true);
      rCtx.view.setInt32(dataOff + 8, 50, true);
      rCtx.view.setInt32(dataOff + 12, 50, true);
      const result = handleEmfGdiDrawRecord(rCtx, 42, 0, dataOff, 24);
      expect(result).toBe(true);
    });

    it("returns true for EMR_LINETO (54) with valid data", () => {
      const rCtx = makeRCtx();
      const dataOff = 8;
      rCtx.view.setInt32(dataOff, 100, true); // x
      rCtx.view.setInt32(dataOff + 4, 200, true); // y
      const result = handleEmfGdiDrawRecord(rCtx, 54, 0, dataOff, 16);
      expect(result).toBe(true);
    });

    it("returns true for EMR_MOVETOEX (27) with valid data", () => {
      const rCtx = makeRCtx();
      const dataOff = 8;
      rCtx.view.setInt32(dataOff, 50, true);
      rCtx.view.setInt32(dataOff + 4, 75, true);
      const result = handleEmfGdiDrawRecord(rCtx, 27, 0, dataOff, 16);
      expect(result).toBe(true);
    });

    it("delegates EMR_EXTTEXTOUTW (84) to text/bitmap handler", () => {
      const rCtx = makeRCtx(512);
      // EMR_EXTTEXTOUTW = 84, needs complex setup but handler returns true
      const result = handleEmfGdiDrawRecord(rCtx, 84, 0, 8, 8);
      expect(result).toBe(true);
    });

    it("delegates EMR_BITBLT (76) to text/bitmap handler", () => {
      const rCtx = makeRCtx(512);
      const result = handleEmfGdiDrawRecord(rCtx, 76, 0, 8, 8);
      expect(result).toBe(true);
    });

    it("delegates EMR_STRETCHDIBITS (81) to text/bitmap handler", () => {
      const rCtx = makeRCtx(512);
      const result = handleEmfGdiDrawRecord(rCtx, 81, 0, 8, 8);
      expect(result).toBe(true);
    });

    it("delegates EMR_INTERSECTCLIPRECT (30) to text/bitmap handler", () => {
      const rCtx = makeRCtx(512);
      const dataOff = 8;
      rCtx.view.setInt32(dataOff, 0, true);
      rCtx.view.setInt32(dataOff + 4, 0, true);
      rCtx.view.setInt32(dataOff + 8, 100, true);
      rCtx.view.setInt32(dataOff + 12, 100, true);
      const result = handleEmfGdiDrawRecord(rCtx, 30, 0, dataOff, 24);
      expect(result).toBe(true);
    });
  });
});
