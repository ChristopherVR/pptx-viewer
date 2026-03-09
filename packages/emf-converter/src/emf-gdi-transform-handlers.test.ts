import { describe, it, expect, vi } from "vitest";
import { handleEmfTransformRecord } from "./emf-gdi-transform-handlers";
import type { EmfGdiReplayCtx } from "./emf-types";
import { defaultState } from "./emf-types";
import {
  EMR_SETWINDOWEXTEX,
  EMR_SETWINDOWORGEX,
  EMR_SETVIEWPORTEXTEX,
  EMR_SETVIEWPORTORGEX,
  EMR_SETMAPMODE,
  EMR_SCALEVIEWPORTEXTEX,
  EMR_SCALEWINDOWEXTEX,
  EMR_SETWORLDTRANSFORM,
  EMR_MODIFYWORLDTRANSFORM,
} from "./emf-constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtxStub(): Record<string, unknown> {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    clip: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: "#000",
    fillStyle: "#fff",
    lineWidth: 1,
  };
}

function makeRCtx(bufSize = 256): EmfGdiReplayCtx {
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

describe("emf-gdi-transform-handlers", () => {
  describe("handleEmfTransformRecord()", () => {
    it("is a function with arity 4", () => {
      expect(typeof handleEmfTransformRecord).toBe("function");
      expect(handleEmfTransformRecord.length).toBe(4);
    });

    it("returns false for unrecognized record type", () => {
      const rCtx = makeRCtx();
      expect(handleEmfTransformRecord(rCtx, 0xffff, 8, 16)).toBe(false);
    });

    // -- EMR_SETWINDOWEXTEX --
    describe("EMR_SETWINDOWEXTEX", () => {
      it("sets windowExt and activates mapping mode", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setInt32(d, 2000, true);
        rCtx.view.setInt32(d + 4, 1500, true);
        const result = handleEmfTransformRecord(rCtx, EMR_SETWINDOWEXTEX, d, 16);
        expect(result).toBe(true);
        expect(rCtx.windowExt.cx).toBe(2000);
        expect(rCtx.windowExt.cy).toBe(1500);
        expect(rCtx.useMappingMode).toBe(true);
      });

      it("ignores if recSize < 16", () => {
        const rCtx = makeRCtx();
        handleEmfTransformRecord(rCtx, EMR_SETWINDOWEXTEX, 8, 12);
        expect(rCtx.windowExt.cx).toBe(1000); // unchanged
      });
    });

    // -- EMR_SETWINDOWORGEX --
    describe("EMR_SETWINDOWORGEX", () => {
      it("sets windowOrg", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setInt32(d, 100, true);
        rCtx.view.setInt32(d + 4, 200, true);
        handleEmfTransformRecord(rCtx, EMR_SETWINDOWORGEX, d, 16);
        expect(rCtx.windowOrg.x).toBe(100);
        expect(rCtx.windowOrg.y).toBe(200);
      });
    });

    // -- EMR_SETVIEWPORTEXTEX --
    describe("EMR_SETVIEWPORTEXTEX", () => {
      it("sets viewportExt", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setInt32(d, 800, true);
        rCtx.view.setInt32(d + 4, 600, true);
        handleEmfTransformRecord(rCtx, EMR_SETVIEWPORTEXTEX, d, 16);
        expect(rCtx.viewportExt.cx).toBe(800);
        expect(rCtx.viewportExt.cy).toBe(600);
      });
    });

    // -- EMR_SETVIEWPORTORGEX --
    describe("EMR_SETVIEWPORTORGEX", () => {
      it("sets viewportOrg", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setInt32(d, 50, true);
        rCtx.view.setInt32(d + 4, 75, true);
        handleEmfTransformRecord(rCtx, EMR_SETVIEWPORTORGEX, d, 16);
        expect(rCtx.viewportOrg.x).toBe(50);
        expect(rCtx.viewportOrg.y).toBe(75);
      });
    });

    // -- EMR_SETMAPMODE --
    describe("EMR_SETMAPMODE", () => {
      it("returns true for map mode record", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setUint32(d, 8, true); // MM_ISOTROPIC
        expect(handleEmfTransformRecord(rCtx, EMR_SETMAPMODE, d, 12)).toBe(true);
      });

      it("ignores if recSize < 12", () => {
        const rCtx = makeRCtx();
        expect(handleEmfTransformRecord(rCtx, EMR_SETMAPMODE, 8, 8)).toBe(true);
      });
    });

    // -- EMR_SCALEVIEWPORTEXTEX --
    describe("EMR_SCALEVIEWPORTEXTEX", () => {
      it("scales viewport extent by rational factors", () => {
        const rCtx = makeRCtx();
        rCtx.viewportExt.cx = 100;
        rCtx.viewportExt.cy = 200;
        const d = 8;
        rCtx.view.setInt32(d, 3, true); // xNum
        rCtx.view.setInt32(d + 4, 1, true); // xDenom
        rCtx.view.setInt32(d + 8, 2, true); // yNum
        rCtx.view.setInt32(d + 12, 1, true); // yDenom
        handleEmfTransformRecord(rCtx, EMR_SCALEVIEWPORTEXTEX, d, 24);
        expect(rCtx.viewportExt.cx).toBe(300);
        expect(rCtx.viewportExt.cy).toBe(400);
      });

      it("does not divide by zero (denom=0)", () => {
        const rCtx = makeRCtx();
        rCtx.viewportExt.cx = 100;
        rCtx.viewportExt.cy = 200;
        const d = 8;
        rCtx.view.setInt32(d, 3, true);
        rCtx.view.setInt32(d + 4, 0, true); // xDenom = 0
        rCtx.view.setInt32(d + 8, 2, true);
        rCtx.view.setInt32(d + 12, 0, true); // yDenom = 0
        handleEmfTransformRecord(rCtx, EMR_SCALEVIEWPORTEXTEX, d, 24);
        expect(rCtx.viewportExt.cx).toBe(100); // unchanged
        expect(rCtx.viewportExt.cy).toBe(200); // unchanged
      });

      it("ignores if recSize < 24", () => {
        const rCtx = makeRCtx();
        rCtx.viewportExt.cx = 100;
        handleEmfTransformRecord(rCtx, EMR_SCALEVIEWPORTEXTEX, 8, 16);
        expect(rCtx.viewportExt.cx).toBe(100);
      });
    });

    // -- EMR_SCALEWINDOWEXTEX --
    describe("EMR_SCALEWINDOWEXTEX", () => {
      it("scales window extent by rational factors", () => {
        const rCtx = makeRCtx();
        rCtx.windowExt.cx = 500;
        rCtx.windowExt.cy = 400;
        const d = 8;
        rCtx.view.setInt32(d, 1, true);
        rCtx.view.setInt32(d + 4, 2, true); // halve cx
        rCtx.view.setInt32(d + 8, 3, true);
        rCtx.view.setInt32(d + 12, 4, true); // 3/4 of cy
        handleEmfTransformRecord(rCtx, EMR_SCALEWINDOWEXTEX, d, 24);
        expect(rCtx.windowExt.cx).toBe(250);
        expect(rCtx.windowExt.cy).toBe(300);
      });
    });

    // -- EMR_SETWORLDTRANSFORM --
    describe("EMR_SETWORLDTRANSFORM", () => {
      it("sets the world transform matrix from 6 float32 values", () => {
        const rCtx = makeRCtx();
        const d = 8;
        const vals = [2.0, 0.0, 0.0, 3.0, 10.0, 20.0];
        for (let i = 0; i < 6; i++) {
          rCtx.view.setFloat32(d + i * 4, vals[i], true);
        }
        handleEmfTransformRecord(rCtx, EMR_SETWORLDTRANSFORM, d, 32);
        expect(rCtx.state.worldTransform[0]).toBeCloseTo(2.0);
        expect(rCtx.state.worldTransform[3]).toBeCloseTo(3.0);
        expect(rCtx.state.worldTransform[4]).toBeCloseTo(10.0);
        expect(rCtx.state.worldTransform[5]).toBeCloseTo(20.0);
      });

      it("ignores if recSize < 32", () => {
        const rCtx = makeRCtx();
        handleEmfTransformRecord(rCtx, EMR_SETWORLDTRANSFORM, 8, 24);
        expect(rCtx.state.worldTransform).toEqual([1, 0, 0, 1, 0, 0]); // identity
      });
    });

    // -- EMR_MODIFYWORLDTRANSFORM --
    describe("EMR_MODIFYWORLDTRANSFORM", () => {
      it("resets to identity when mode = 1 (MWT_IDENTITY)", () => {
        const rCtx = makeRCtx();
        rCtx.state.worldTransform = [2, 0, 0, 2, 100, 100];
        const d = 8;
        // 24 bytes of transform data (ignored for mode 1)
        rCtx.view.setUint32(d + 24, 1, true); // mode = MWT_IDENTITY
        handleEmfTransformRecord(rCtx, EMR_MODIFYWORLDTRANSFORM, d, 36);
        expect(rCtx.state.worldTransform).toEqual([1, 0, 0, 1, 0, 0]);
      });

      it("left-multiplies when mode = 2 (MWT_LEFTMULTIPLY)", () => {
        const rCtx = makeRCtx();
        rCtx.state.worldTransform = [1, 0, 0, 1, 0, 0]; // identity
        const d = 8;
        // xf = [2, 0, 0, 3, 5, 10]
        rCtx.view.setFloat32(d, 2, true);
        rCtx.view.setFloat32(d + 4, 0, true);
        rCtx.view.setFloat32(d + 8, 0, true);
        rCtx.view.setFloat32(d + 12, 3, true);
        rCtx.view.setFloat32(d + 16, 5, true);
        rCtx.view.setFloat32(d + 20, 10, true);
        rCtx.view.setUint32(d + 24, 2, true); // mode = 2
        handleEmfTransformRecord(rCtx, EMR_MODIFYWORLDTRANSFORM, d, 36);
        // For identity * xf = xf
        expect(rCtx.state.worldTransform[0]).toBeCloseTo(2);
        expect(rCtx.state.worldTransform[3]).toBeCloseTo(3);
        expect(rCtx.state.worldTransform[4]).toBeCloseTo(5);
        expect(rCtx.state.worldTransform[5]).toBeCloseTo(10);
      });

      it("right-multiplies when mode = 3 (MWT_RIGHTMULTIPLY)", () => {
        const rCtx = makeRCtx();
        rCtx.state.worldTransform = [1, 0, 0, 1, 10, 20]; // translate only
        const d = 8;
        // xf = [2, 0, 0, 2, 0, 0] (scale by 2)
        rCtx.view.setFloat32(d, 2, true);
        rCtx.view.setFloat32(d + 4, 0, true);
        rCtx.view.setFloat32(d + 8, 0, true);
        rCtx.view.setFloat32(d + 12, 2, true);
        rCtx.view.setFloat32(d + 16, 0, true);
        rCtx.view.setFloat32(d + 20, 0, true);
        rCtx.view.setUint32(d + 24, 3, true); // mode = 3
        handleEmfTransformRecord(rCtx, EMR_MODIFYWORLDTRANSFORM, d, 36);
        // Right-multiply: result = current * xf
        // [1,0,0,1,10,20] * [2,0,0,2,0,0]
        // a = 1*2 + 0*0 = 2, b = 1*0 + 0*2 = 0
        // c = 0*2 + 1*0 = 0, d = 0*0 + 1*2 = 2
        // e = 10*2 + 20*0 + 0 = 20, f = 10*0 + 20*2 + 0 = 40
        expect(rCtx.state.worldTransform[0]).toBeCloseTo(2);
        expect(rCtx.state.worldTransform[3]).toBeCloseTo(2);
        expect(rCtx.state.worldTransform[4]).toBeCloseTo(20);
        expect(rCtx.state.worldTransform[5]).toBeCloseTo(40);
      });

      it("ignores if recSize < 36", () => {
        const rCtx = makeRCtx();
        rCtx.state.worldTransform = [2, 0, 0, 2, 0, 0];
        handleEmfTransformRecord(rCtx, EMR_MODIFYWORLDTRANSFORM, 8, 28);
        expect(rCtx.state.worldTransform).toEqual([2, 0, 0, 2, 0, 0]); // unchanged
      });

      it("does nothing for mode values other than 1, 2, 3", () => {
        const rCtx = makeRCtx();
        rCtx.state.worldTransform = [2, 0, 0, 2, 5, 5];
        const d = 8;
        rCtx.view.setUint32(d + 24, 99, true); // unknown mode
        handleEmfTransformRecord(rCtx, EMR_MODIFYWORLDTRANSFORM, d, 36);
        expect(rCtx.state.worldTransform).toEqual([2, 0, 0, 2, 5, 5]); // unchanged
      });
    });
  });
});
