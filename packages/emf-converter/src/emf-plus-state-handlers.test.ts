import { describe, it, expect, vi } from "vitest";
import {
  handleEmfPlusStateRecord,
  multiplyMatrix,
  resolveBrushColor,
  getPageUnitMultiplier,
  applyPlusWorldTransform,
} from "./emf-plus-state-handlers";
import type { EmfPlusReplayCtx, TransformMatrix } from "./emf-types";
import {
  EMFPLUS_SETWORLDTRANSFORM,
  EMFPLUS_RESETWORLDTRANSFORM,
  EMFPLUS_MULTIPLYWORLDTRANSFORM,
  EMFPLUS_TRANSLATEWORLDTRANSFORM,
  EMFPLUS_SCALEWORLDTRANSFORM,
  EMFPLUS_ROTATEWORLDTRANSFORM,
  EMFPLUS_SAVE,
  EMFPLUS_RESTORE,
  EMFPLUS_SETCLIPRECT,
  EMFPLUS_RESETCLIP,
  EMFPLUS_BEGINCONTAINERNOPARAMS,
  EMFPLUS_ENDCONTAINER,
  EMFPLUS_SETPAGETRANSFORM,
  EMFPLUS_SETANTIALIASMODE,
  EMFPLUS_SETTEXTRENDERINGHINT,
  EMFPLUS_SETINTERPOLATIONMODE,
  EMFPLUS_SETPIXELOFFSETMODE,
  EMFPLUS_SETCOMPOSITINGQUALITY,
  EMFPLUS_OFFSETCLIP,
} from "./emf-constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtxStub(): Record<string, unknown> {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    strokeStyle: "#000",
    fillStyle: "#fff",
    lineWidth: 1,
    font: "12px sans-serif",
    textBaseline: "top",
    textAlign: "left",
  };
}

function makeRCtx(bufSize = 256): EmfPlusReplayCtx {
  const buf = new ArrayBuffer(bufSize);
  const view = new DataView(buf);
  return {
    ctx: makeCtxStub() as unknown as CanvasRenderingContext2D,
    view,
    objectTable: new Map(),
    worldTransform: [1, 0, 0, 1, 0, 0] as TransformMatrix,
    deferredImages: [],
    saveStack: [],
    saveIdMap: new Map(),
    totalImageObjects: 0,
    totalDrawImageCalls: 0,
    clipSaveDepth: 0,
    pageUnit: 2,
    pageScale: 1,
    continuationBuffer: null,
    continuationObjectId: 0,
    continuationObjectType: 0,
    continuationTotalSize: 0,
    continuationOffset: 0,
  };
}

// ---------------------------------------------------------------------------
// Tests: Pure utility functions
// ---------------------------------------------------------------------------

describe("emf-plus-state-handlers", () => {
  describe("multiplyMatrix()", () => {
    it("identity * identity = identity", () => {
      const id: TransformMatrix = [1, 0, 0, 1, 0, 0];
      expect(multiplyMatrix(id, id)).toEqual([1, 0, 0, 1, 0, 0]);
    });

    it("identity * M = M", () => {
      const id: TransformMatrix = [1, 0, 0, 1, 0, 0];
      const m: TransformMatrix = [2, 3, 4, 5, 6, 7];
      expect(multiplyMatrix(id, m)).toEqual(m);
    });

    it("M * identity = M", () => {
      const id: TransformMatrix = [1, 0, 0, 1, 0, 0];
      const m: TransformMatrix = [2, 3, 4, 5, 6, 7];
      expect(multiplyMatrix(m, id)).toEqual(m);
    });

    it("correctly multiplies two scale matrices", () => {
      const s1: TransformMatrix = [2, 0, 0, 3, 0, 0];
      const s2: TransformMatrix = [4, 0, 0, 5, 0, 0];
      expect(multiplyMatrix(s1, s2)).toEqual([8, 0, 0, 15, 0, 0]);
    });

    it("correctly multiplies translate then scale", () => {
      // translate(10, 20) * scale(2, 2)
      const t: TransformMatrix = [1, 0, 0, 1, 10, 20];
      const s: TransformMatrix = [2, 0, 0, 2, 0, 0];
      const result = multiplyMatrix(t, s);
      // e = 10*2 + 20*0 + 0 = 20
      // f = 10*0 + 20*2 + 0 = 40
      expect(result).toEqual([2, 0, 0, 2, 20, 40]);
    });

    it("correctly multiplies scale then translate", () => {
      const s: TransformMatrix = [2, 0, 0, 2, 0, 0];
      const t: TransformMatrix = [1, 0, 0, 1, 10, 20];
      const result = multiplyMatrix(s, t);
      // e = 0*1 + 0*0 + 10 = 10
      // f = 0*0 + 0*1 + 20 = 20
      expect(result).toEqual([2, 0, 0, 2, 10, 20]);
    });
  });

  describe("resolveBrushColor()", () => {
    it("returns inline ARGB color when flag 0x8000 is set", () => {
      const rCtx = makeRCtx();
      const color = resolveBrushColor(rCtx, 0x8000, 0xffff0000); // opaque red
      expect(color).toBe("rgba(255,0,0,1.000)");
    });

    it("returns brush color from object table when flag 0x8000 is not set", () => {
      const rCtx = makeRCtx();
      rCtx.objectTable.set(3, { kind: "plus-brush", color: "rgba(0,128,0,1.000)" });
      const color = resolveBrushColor(rCtx, 0, 3);
      expect(color).toBe("rgba(0,128,0,1.000)");
    });

    it("returns default black when object not found and flag not set", () => {
      const rCtx = makeRCtx();
      const color = resolveBrushColor(rCtx, 0, 99);
      expect(color).toBe("rgba(0,0,0,1)");
    });

    it("returns default black when object is not a brush", () => {
      const rCtx = makeRCtx();
      rCtx.objectTable.set(1, { kind: "plus-pen", color: "#ff0000", width: 2, dashStyle: 0 });
      const color = resolveBrushColor(rCtx, 0, 1);
      expect(color).toBe("rgba(0,0,0,1)");
    });

    it("masks brushId to low byte (0xff)", () => {
      const rCtx = makeRCtx();
      rCtx.objectTable.set(5, { kind: "plus-brush", color: "rgba(1,2,3,1.000)" });
      const color = resolveBrushColor(rCtx, 0, 0x0100_0005);
      expect(color).toBe("rgba(1,2,3,1.000)");
    });
  });

  describe("getPageUnitMultiplier()", () => {
    it("returns 1 for World/Pixel units (0 or 2) with scale=1", () => {
      expect(getPageUnitMultiplier(0, 1)).toBe(1);
      expect(getPageUnitMultiplier(2, 1)).toBe(1);
    });

    it("returns DPI/72 for Point unit (3)", () => {
      expect(getPageUnitMultiplier(3, 1)).toBeCloseTo(96 / 72);
    });

    it("returns DPI for Inch unit (4)", () => {
      expect(getPageUnitMultiplier(4, 1)).toBe(96);
    });

    it("returns DPI/300 for Document unit (5)", () => {
      expect(getPageUnitMultiplier(5, 1)).toBeCloseTo(96 / 300);
    });

    it("returns DPI/25.4 for Millimeter unit (6)", () => {
      expect(getPageUnitMultiplier(6, 1)).toBeCloseTo(96 / 25.4);
    });

    it("multiplies by pageScale", () => {
      expect(getPageUnitMultiplier(2, 2)).toBe(2);
      expect(getPageUnitMultiplier(4, 0.5)).toBe(48);
    });
  });

  describe("applyPlusWorldTransform()", () => {
    it("calls setTransform with the world transform scaled by page unit multiplier", () => {
      const rCtx = makeRCtx();
      rCtx.worldTransform = [2, 0, 0, 3, 10, 20];
      rCtx.pageUnit = 2; // Pixel
      rCtx.pageScale = 1;
      applyPlusWorldTransform(rCtx);
      const setTransform = (rCtx.ctx as unknown as Record<string, ReturnType<typeof vi.fn>>).setTransform;
      expect(setTransform).toHaveBeenCalledWith(2, 0, 0, 3, 10, 20);
    });

    it("scales by page unit when unit is Point (3)", () => {
      const rCtx = makeRCtx();
      rCtx.worldTransform = [1, 0, 0, 1, 0, 0];
      rCtx.pageUnit = 3; // Point
      rCtx.pageScale = 1;
      applyPlusWorldTransform(rCtx);
      const setTransform = (rCtx.ctx as unknown as Record<string, ReturnType<typeof vi.fn>>).setTransform;
      const m = 96 / 72;
      expect(setTransform).toHaveBeenCalledWith(
        expect.closeTo(m, 5), 0, 0, expect.closeTo(m, 5), 0, 0,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Tests: handleEmfPlusStateRecord
  // ---------------------------------------------------------------------------

  describe("handleEmfPlusStateRecord()", () => {
    it("is a function with arity 5", () => {
      expect(typeof handleEmfPlusStateRecord).toBe("function");
      expect(handleEmfPlusStateRecord.length).toBe(5);
    });

    it("returns false for unrecognized record type", () => {
      const rCtx = makeRCtx();
      expect(handleEmfPlusStateRecord(rCtx, 0xffff, 0, 8, 8)).toBe(false);
    });

    // -- SETWORLDTRANSFORM --
    describe("EMFPLUS_SETWORLDTRANSFORM", () => {
      it("sets worldTransform from 6 float32 values", () => {
        const rCtx = makeRCtx();
        const d = 8;
        const vals = [2, 0, 0, 3, 10, 20];
        for (let i = 0; i < 6; i++) {
          rCtx.view.setFloat32(d + i * 4, vals[i], true);
        }
        const result = handleEmfPlusStateRecord(rCtx, EMFPLUS_SETWORLDTRANSFORM, 0, d, 24);
        expect(result).toBe(true);
        expect(rCtx.worldTransform[0]).toBeCloseTo(2);
        expect(rCtx.worldTransform[3]).toBeCloseTo(3);
        expect(rCtx.worldTransform[4]).toBeCloseTo(10);
        expect(rCtx.worldTransform[5]).toBeCloseTo(20);
      });

      it("ignores if recDataSize < 24", () => {
        const rCtx = makeRCtx();
        handleEmfPlusStateRecord(rCtx, EMFPLUS_SETWORLDTRANSFORM, 0, 8, 16);
        expect(rCtx.worldTransform).toEqual([1, 0, 0, 1, 0, 0]);
      });
    });

    // -- RESETWORLDTRANSFORM --
    describe("EMFPLUS_RESETWORLDTRANSFORM", () => {
      it("resets to identity", () => {
        const rCtx = makeRCtx();
        rCtx.worldTransform = [2, 0, 0, 2, 50, 50];
        handleEmfPlusStateRecord(rCtx, EMFPLUS_RESETWORLDTRANSFORM, 0, 8, 0);
        expect(rCtx.worldTransform).toEqual([1, 0, 0, 1, 0, 0]);
      });
    });

    // -- MULTIPLYWORLDTRANSFORM --
    describe("EMFPLUS_MULTIPLYWORLDTRANSFORM", () => {
      it("pre-multiplies by default (flag 0x2000 not set)", () => {
        const rCtx = makeRCtx();
        rCtx.worldTransform = [1, 0, 0, 1, 10, 20];
        const d = 8;
        // xf = scale(2,2)
        rCtx.view.setFloat32(d, 2, true);
        rCtx.view.setFloat32(d + 4, 0, true);
        rCtx.view.setFloat32(d + 8, 0, true);
        rCtx.view.setFloat32(d + 12, 2, true);
        rCtx.view.setFloat32(d + 16, 0, true);
        rCtx.view.setFloat32(d + 20, 0, true);
        handleEmfPlusStateRecord(rCtx, EMFPLUS_MULTIPLYWORLDTRANSFORM, 0, d, 24);
        // pre-multiply: xf * wt
        expect(rCtx.worldTransform[0]).toBeCloseTo(2);
        expect(rCtx.worldTransform[4]).toBeCloseTo(10);
      });

      it("post-multiplies when flag 0x2000 is set", () => {
        const rCtx = makeRCtx();
        rCtx.worldTransform = [1, 0, 0, 1, 10, 20];
        const d = 8;
        rCtx.view.setFloat32(d, 2, true);
        rCtx.view.setFloat32(d + 4, 0, true);
        rCtx.view.setFloat32(d + 8, 0, true);
        rCtx.view.setFloat32(d + 12, 2, true);
        rCtx.view.setFloat32(d + 16, 0, true);
        rCtx.view.setFloat32(d + 20, 0, true);
        handleEmfPlusStateRecord(rCtx, EMFPLUS_MULTIPLYWORLDTRANSFORM, 0x2000, d, 24);
        // post-multiply: wt * xf
        expect(rCtx.worldTransform[0]).toBeCloseTo(2);
        expect(rCtx.worldTransform[4]).toBeCloseTo(20); // 10*2
      });
    });

    // -- TRANSLATEWORLDTRANSFORM --
    describe("EMFPLUS_TRANSLATEWORLDTRANSFORM", () => {
      it("applies translation pre-multiply", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setFloat32(d, 5, true); // dx
        rCtx.view.setFloat32(d + 4, 10, true); // dy
        handleEmfPlusStateRecord(rCtx, EMFPLUS_TRANSLATEWORLDTRANSFORM, 0, d, 8);
        expect(rCtx.worldTransform[4]).toBeCloseTo(5);
        expect(rCtx.worldTransform[5]).toBeCloseTo(10);
      });
    });

    // -- SCALEWORLDTRANSFORM --
    describe("EMFPLUS_SCALEWORLDTRANSFORM", () => {
      it("applies scaling", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setFloat32(d, 3, true); // sx
        rCtx.view.setFloat32(d + 4, 4, true); // sy
        handleEmfPlusStateRecord(rCtx, EMFPLUS_SCALEWORLDTRANSFORM, 0, d, 8);
        expect(rCtx.worldTransform[0]).toBeCloseTo(3);
        expect(rCtx.worldTransform[3]).toBeCloseTo(4);
      });
    });

    // -- ROTATEWORLDTRANSFORM --
    describe("EMFPLUS_ROTATEWORLDTRANSFORM", () => {
      it("applies a 90-degree rotation", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setFloat32(d, 90, true); // degrees
        handleEmfPlusStateRecord(rCtx, EMFPLUS_ROTATEWORLDTRANSFORM, 0, d, 4);
        expect(rCtx.worldTransform[0]).toBeCloseTo(Math.cos(Math.PI / 2));
        expect(rCtx.worldTransform[1]).toBeCloseTo(Math.sin(Math.PI / 2));
      });
    });

    // -- SAVE / RESTORE --
    describe("EMFPLUS_SAVE / EMFPLUS_RESTORE", () => {
      it("saves and restores world transform", () => {
        const rCtx = makeRCtx();
        rCtx.worldTransform = [2, 0, 0, 2, 10, 10];
        const d = 8;
        rCtx.view.setUint32(d, 42, true); // stackId
        handleEmfPlusStateRecord(rCtx, EMFPLUS_SAVE, 0, d, 4);
        expect(rCtx.saveStack.length).toBe(1);

        // Change transform
        rCtx.worldTransform = [5, 0, 0, 5, 50, 50];

        // Restore
        handleEmfPlusStateRecord(rCtx, EMFPLUS_RESTORE, 0, d, 4);
        expect(rCtx.worldTransform[0]).toBeCloseTo(2);
        expect(rCtx.worldTransform[4]).toBeCloseTo(10);
      });
    });

    // -- SETCLIPRECT --
    describe("EMFPLUS_SETCLIPRECT", () => {
      it("clips a rectangle on the canvas", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setFloat32(d, 10, true); // x
        rCtx.view.setFloat32(d + 4, 20, true); // y
        rCtx.view.setFloat32(d + 8, 100, true); // w
        rCtx.view.setFloat32(d + 12, 200, true); // h
        const flags = (1 << 8); // combineMode = 1 (Intersect)
        handleEmfPlusStateRecord(rCtx, EMFPLUS_SETCLIPRECT, flags, d, 16);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.clip.mock.calls.length).toBeGreaterThanOrEqual(1);
      });
    });

    // -- RESETCLIP --
    describe("EMFPLUS_RESETCLIP", () => {
      it("resets clip depth", () => {
        const rCtx = makeRCtx();
        rCtx.clipSaveDepth = 1;
        handleEmfPlusStateRecord(rCtx, EMFPLUS_RESETCLIP, 0, 8, 0);
        // After reset, it re-saves for future clips
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.restore.mock.calls.length).toBeGreaterThanOrEqual(1);
      });
    });

    // -- BEGINCONTAINERNOPARAMS / ENDCONTAINER --
    describe("EMFPLUS_BEGINCONTAINERNOPARAMS / ENDCONTAINER", () => {
      it("works like save/restore", () => {
        const rCtx = makeRCtx();
        rCtx.worldTransform = [3, 0, 0, 3, 0, 0];
        const d = 8;
        rCtx.view.setUint32(d, 100, true);
        handleEmfPlusStateRecord(rCtx, EMFPLUS_BEGINCONTAINERNOPARAMS, 0, d, 4);
        rCtx.worldTransform = [1, 0, 0, 1, 0, 0];
        handleEmfPlusStateRecord(rCtx, EMFPLUS_ENDCONTAINER, 0, d, 4);
        expect(rCtx.worldTransform[0]).toBeCloseTo(3);
      });
    });

    // -- SETPAGETRANSFORM --
    describe("EMFPLUS_SETPAGETRANSFORM", () => {
      it("sets pageUnit and pageScale", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setFloat32(d, 2.5, true); // scale
        const flags = 3; // Point unit
        handleEmfPlusStateRecord(rCtx, EMFPLUS_SETPAGETRANSFORM, flags, d, 4);
        expect(rCtx.pageUnit).toBe(3);
        expect(rCtx.pageScale).toBeCloseTo(2.5);
      });

      it("defaults to scale=1 when recDataSize < 4", () => {
        const rCtx = makeRCtx();
        const flags = 6; // Millimeter
        handleEmfPlusStateRecord(rCtx, EMFPLUS_SETPAGETRANSFORM, flags, 8, 0);
        expect(rCtx.pageUnit).toBe(6);
        expect(rCtx.pageScale).toBe(1);
      });
    });

    // -- OFFSETCLIP --
    describe("EMFPLUS_OFFSETCLIP", () => {
      it("returns true (accepted, logged)", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setFloat32(d, 5, true);
        rCtx.view.setFloat32(d + 4, 10, true);
        expect(handleEmfPlusStateRecord(rCtx, EMFPLUS_OFFSETCLIP, 0, d, 8)).toBe(true);
      });
    });

    // -- Rendering hints --
    describe("rendering hint records", () => {
      it.each([
        ["SETANTIALIASMODE", EMFPLUS_SETANTIALIASMODE],
        ["SETTEXTRENDERINGHINT", EMFPLUS_SETTEXTRENDERINGHINT],
        ["SETINTERPOLATIONMODE", EMFPLUS_SETINTERPOLATIONMODE],
        ["SETPIXELOFFSETMODE", EMFPLUS_SETPIXELOFFSETMODE],
        ["SETCOMPOSITINGQUALITY", EMFPLUS_SETCOMPOSITINGQUALITY],
      ])("%s returns true", (_name, recType) => {
        const rCtx = makeRCtx();
        expect(handleEmfPlusStateRecord(rCtx, recType, 0, 8, 0)).toBe(true);
      });
    });
  });
});
