import { describe, it, expect, vi } from "vitest";
import { handleEmfPlusDrawRecord } from "./emf-plus-draw-handlers";
import type { EmfPlusReplayCtx, TransformMatrix } from "./emf-types";
import {
  EMFPLUS_FILLRECTS,
  EMFPLUS_DRAWRECTS,
  EMFPLUS_FILLELLIPSE,
  EMFPLUS_DRAWELLIPSE,
  EMFPLUS_FILLPIE,
  EMFPLUS_DRAWPIE,
  EMFPLUS_DRAWARC,
  EMFPLUS_DRAWLINES,
  EMFPLUS_FILLPOLYGON,
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

function makeRCtx(bufSize = 512): EmfPlusReplayCtx {
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
// Tests
// ---------------------------------------------------------------------------

describe("emf-plus-draw-handlers", () => {
  describe("handleEmfPlusDrawRecord()", () => {
    it("is a function with arity 5", () => {
      expect(typeof handleEmfPlusDrawRecord).toBe("function");
      expect(handleEmfPlusDrawRecord.length).toBe(5);
    });

    it("returns false for unrecognized record type", () => {
      const rCtx = makeRCtx();
      expect(handleEmfPlusDrawRecord(rCtx, 0xffff, 0, 8, 8)).toBe(false);
    });

    // -- FILLRECTS --
    describe("EMFPLUS_FILLRECTS", () => {
      it("fills compressed rects (16-bit)", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setUint32(d, 0xffff0000, true); // brushVal (inline ARGB red)
        rCtx.view.setUint32(d + 4, 1, true); // count
        // compressed rect: x, y, w, h as int16
        rCtx.view.setInt16(d + 8, 10, true);
        rCtx.view.setInt16(d + 10, 20, true);
        rCtx.view.setInt16(d + 12, 50, true);
        rCtx.view.setInt16(d + 14, 60, true);
        const flags = 0x8000 | 0x4000; // inline brush + compressed
        const result = handleEmfPlusDrawRecord(rCtx, EMFPLUS_FILLRECTS, flags, d, 16);
        expect(result).toBe(true);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fillRect.mock.calls.length).toBe(1);
        expect(ctx.fillRect.mock.calls[0]).toEqual([10, 20, 50, 60]);
      });

      it("fills uncompressed rects (float32)", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setUint32(d, 0xff00ff00, true); // green
        rCtx.view.setUint32(d + 4, 1, true);
        rCtx.view.setFloat32(d + 8, 1.5, true);
        rCtx.view.setFloat32(d + 12, 2.5, true);
        rCtx.view.setFloat32(d + 16, 3.5, true);
        rCtx.view.setFloat32(d + 20, 4.5, true);
        const flags = 0x8000; // inline brush, not compressed
        handleEmfPlusDrawRecord(rCtx, EMFPLUS_FILLRECTS, flags, d, 24);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fillRect.mock.calls.length).toBe(1);
      });

      it("handles multiple rects", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setUint32(d, 0xff000000, true);
        rCtx.view.setUint32(d + 4, 3, true); // count = 3
        for (let i = 0; i < 3; i++) {
          const off = d + 8 + i * 8;
          rCtx.view.setInt16(off, i * 10, true);
          rCtx.view.setInt16(off + 2, i * 10, true);
          rCtx.view.setInt16(off + 4, 20, true);
          rCtx.view.setInt16(off + 6, 20, true);
        }
        handleEmfPlusDrawRecord(rCtx, EMFPLUS_FILLRECTS, 0x8000 | 0x4000, d, 8 + 3 * 8);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fillRect.mock.calls.length).toBe(3);
      });

      it("ignores if recDataSize < 8", () => {
        const rCtx = makeRCtx();
        const result = handleEmfPlusDrawRecord(rCtx, EMFPLUS_FILLRECTS, 0, 8, 4);
        expect(result).toBe(true);
      });
    });

    // -- DRAWRECTS --
    describe("EMFPLUS_DRAWRECTS", () => {
      it("strokes compressed rects using pen from object table", () => {
        const rCtx = makeRCtx();
        rCtx.objectTable.set(1, { kind: "plus-pen", color: "#ff0000", width: 2, dashStyle: 0 });
        const d = 8;
        rCtx.view.setUint32(d, 1, true); // count
        rCtx.view.setInt16(d + 4, 5, true);
        rCtx.view.setInt16(d + 6, 5, true);
        rCtx.view.setInt16(d + 8, 40, true);
        rCtx.view.setInt16(d + 10, 40, true);
        const flags = 1 | 0x4000; // penId=1, compressed
        handleEmfPlusDrawRecord(rCtx, EMFPLUS_DRAWRECTS, flags, d, 12);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.strokeRect.mock.calls.length).toBe(1);
      });
    });

    // -- FILLELLIPSE --
    describe("EMFPLUS_FILLELLIPSE", () => {
      it("fills a compressed ellipse", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setUint32(d, 0xff0000ff, true); // blue
        rCtx.view.setInt16(d + 4, 10, true);
        rCtx.view.setInt16(d + 6, 20, true);
        rCtx.view.setInt16(d + 8, 60, true);
        rCtx.view.setInt16(d + 10, 40, true);
        handleEmfPlusDrawRecord(rCtx, EMFPLUS_FILLELLIPSE, 0x8000 | 0x4000, d, 12);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.ellipse.mock.calls.length).toBe(1);
        expect(ctx.fill.mock.calls.length).toBe(1);
      });

      it("handles uncompressed ellipse (float32)", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setUint32(d, 0xff000000, true);
        rCtx.view.setFloat32(d + 4, 1.0, true);
        rCtx.view.setFloat32(d + 8, 2.0, true);
        rCtx.view.setFloat32(d + 12, 3.0, true);
        rCtx.view.setFloat32(d + 16, 4.0, true);
        handleEmfPlusDrawRecord(rCtx, EMFPLUS_FILLELLIPSE, 0x8000, d, 20);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.ellipse.mock.calls.length).toBe(1);
      });
    });

    // -- DRAWELLIPSE --
    describe("EMFPLUS_DRAWELLIPSE", () => {
      it("strokes a compressed ellipse", () => {
        const rCtx = makeRCtx();
        rCtx.objectTable.set(0, { kind: "plus-pen", color: "#000", width: 1, dashStyle: 0 });
        const d = 8;
        rCtx.view.setInt16(d, 0, true);
        rCtx.view.setInt16(d + 2, 0, true);
        rCtx.view.setInt16(d + 4, 80, true);
        rCtx.view.setInt16(d + 6, 60, true);
        handleEmfPlusDrawRecord(rCtx, EMFPLUS_DRAWELLIPSE, 0x4000, d, 8);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.stroke.mock.calls.length).toBe(1);
      });

      it("returns early if data too small for uncompressed", () => {
        const rCtx = makeRCtx();
        const result = handleEmfPlusDrawRecord(rCtx, EMFPLUS_DRAWELLIPSE, 0, 8, 8);
        expect(result).toBe(true); // returns early but true
      });
    });

    // -- FILLPIE / DRAWPIE / DRAWARC --
    describe("EMFPLUS_FILLPIE", () => {
      it("fills a pie slice", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setUint32(d, 0xffff0000, true); // brush
        rCtx.view.setFloat32(d + 4, 0, true); // startAngle
        rCtx.view.setFloat32(d + 8, 90, true); // sweepAngle
        rCtx.view.setInt16(d + 12, 0, true); // x
        rCtx.view.setInt16(d + 14, 0, true); // y
        rCtx.view.setInt16(d + 16, 100, true); // w
        rCtx.view.setInt16(d + 18, 100, true); // h
        handleEmfPlusDrawRecord(rCtx, EMFPLUS_FILLPIE, 0x8000 | 0x4000, d, 20);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fill.mock.calls.length).toBe(1);
        expect(ctx.moveTo.mock.calls.length).toBe(1);
      });

      it("returns early if data too small", () => {
        const rCtx = makeRCtx();
        expect(handleEmfPlusDrawRecord(rCtx, EMFPLUS_FILLPIE, 0, 8, 4)).toBe(true);
      });
    });

    describe("EMFPLUS_DRAWPIE", () => {
      it("strokes a pie outline", () => {
        const rCtx = makeRCtx();
        rCtx.objectTable.set(0, { kind: "plus-pen", color: "#000", width: 1, dashStyle: 0 });
        const d = 8;
        rCtx.view.setFloat32(d, 0, true);
        rCtx.view.setFloat32(d + 4, 180, true);
        rCtx.view.setInt16(d + 8, 0, true);
        rCtx.view.setInt16(d + 10, 0, true);
        rCtx.view.setInt16(d + 12, 50, true);
        rCtx.view.setInt16(d + 14, 50, true);
        handleEmfPlusDrawRecord(rCtx, EMFPLUS_DRAWPIE, 0x4000, d, 16);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.stroke.mock.calls.length).toBe(1);
      });
    });

    describe("EMFPLUS_DRAWARC", () => {
      it("strokes an arc", () => {
        const rCtx = makeRCtx();
        rCtx.objectTable.set(2, { kind: "plus-pen", color: "#f00", width: 2, dashStyle: 1 });
        const d = 8;
        rCtx.view.setFloat32(d, 45, true);
        rCtx.view.setFloat32(d + 4, 270, true);
        rCtx.view.setFloat32(d + 8, 10, true);
        rCtx.view.setFloat32(d + 12, 10, true);
        rCtx.view.setFloat32(d + 16, 80, true);
        rCtx.view.setFloat32(d + 20, 60, true);
        handleEmfPlusDrawRecord(rCtx, EMFPLUS_DRAWARC, 2, d, 24);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.stroke.mock.calls.length).toBe(1);
      });
    });

    // -- DRAWLINES --
    describe("EMFPLUS_DRAWLINES", () => {
      it("draws compressed line segments", () => {
        const rCtx = makeRCtx();
        rCtx.objectTable.set(0, { kind: "plus-pen", color: "#000", width: 1, dashStyle: 0 });
        const d = 8;
        rCtx.view.setUint32(d, 3, true); // count
        rCtx.view.setInt16(d + 4, 0, true); rCtx.view.setInt16(d + 6, 0, true);
        rCtx.view.setInt16(d + 8, 50, true); rCtx.view.setInt16(d + 10, 50, true);
        rCtx.view.setInt16(d + 12, 100, true); rCtx.view.setInt16(d + 14, 0, true);
        handleEmfPlusDrawRecord(rCtx, EMFPLUS_DRAWLINES, 0x4000, d, 16);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.moveTo.mock.calls.length).toBe(1);
        expect(ctx.lineTo.mock.calls.length).toBe(2);
        expect(ctx.stroke.mock.calls.length).toBe(1);
      });

      it("closes path when flag 0x2000 is set", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setUint32(d, 2, true);
        rCtx.view.setInt16(d + 4, 0, true); rCtx.view.setInt16(d + 6, 0, true);
        rCtx.view.setInt16(d + 8, 10, true); rCtx.view.setInt16(d + 10, 10, true);
        handleEmfPlusDrawRecord(rCtx, EMFPLUS_DRAWLINES, 0x4000 | 0x2000, d, 12);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.closePath.mock.calls.length).toBe(1);
      });
    });

    // -- FILLPOLYGON --
    describe("EMFPLUS_FILLPOLYGON", () => {
      it("fills a compressed polygon", () => {
        const rCtx = makeRCtx();
        const d = 8;
        rCtx.view.setUint32(d, 0xff00ff00, true); // green
        rCtx.view.setUint32(d + 4, 3, true); // 3 points
        rCtx.view.setInt16(d + 8, 0, true); rCtx.view.setInt16(d + 10, 0, true);
        rCtx.view.setInt16(d + 12, 50, true); rCtx.view.setInt16(d + 14, 0, true);
        rCtx.view.setInt16(d + 16, 25, true); rCtx.view.setInt16(d + 18, 50, true);
        handleEmfPlusDrawRecord(rCtx, EMFPLUS_FILLPOLYGON, 0x8000 | 0x4000, d, 20);
        const ctx = rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.closePath.mock.calls.length).toBe(1);
        expect(ctx.fill.mock.calls.length).toBe(1);
      });
    });
  });
});
