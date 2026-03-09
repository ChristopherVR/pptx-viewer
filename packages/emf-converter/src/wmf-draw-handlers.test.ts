import { describe, it, expect, vi } from "vitest";
import { handleWmfDrawRecord } from "./wmf-draw-handlers";
import type { WmfReplayCtx } from "./emf-types";
import { defaultState } from "./emf-types";
import {
  META_MOVETO,
  META_LINETO,
  META_RECTANGLE,
  META_ROUNDRECT,
  META_ELLIPSE,
  META_ARC,
  META_PIE,
  META_CHORD,
  META_POLYGON,
  META_POLYLINE,
  META_POLYPOLYGON,
  META_TEXTOUT,
  META_EXTTEXTOUT,
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
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
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
    strokeStyle: "#000",
    fillStyle: "#fff",
    lineWidth: 1,
    font: "12px sans-serif",
    textBaseline: "top",
    textAlign: "left",
  };
}

function makeWCtx(bufSize = 512): WmfReplayCtx {
  const buf = new ArrayBuffer(bufSize);
  const view = new DataView(buf);
  return {
    view,
    ctx: makeCtxStub() as unknown as CanvasRenderingContext2D,
    state: defaultState(),
    coord: {
      mx: (x: number) => x,
      my: (y: number) => y,
      mw: (w: number) => w,
      mh: (h: number) => h,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("wmf-draw-handlers", () => {
  describe("handleWmfDrawRecord()", () => {
    it("is a function with arity 5", () => {
      expect(typeof handleWmfDrawRecord).toBe("function");
      expect(handleWmfDrawRecord.length).toBe(5);
    });

    it("returns false for unrecognized record type", () => {
      const wCtx = makeWCtx();
      expect(handleWmfDrawRecord(wCtx, 0xffff, 0, 8, 8)).toBe(false);
    });

    // -- META_MOVETO --
    describe("META_MOVETO", () => {
      it("updates curX and curY", () => {
        const wCtx = makeWCtx();
        const d = 8;
        wCtx.view.setInt16(d, 200, true); // y
        wCtx.view.setInt16(d + 2, 100, true); // x
        const result = handleWmfDrawRecord(wCtx, META_MOVETO, 0, d, 10);
        expect(result).toBe(true);
        expect(wCtx.state.curX).toBe(100);
        expect(wCtx.state.curY).toBe(200);
      });

      it("ignores if recSize < 10", () => {
        const wCtx = makeWCtx();
        handleWmfDrawRecord(wCtx, META_MOVETO, 0, 8, 6);
        expect(wCtx.state.curX).toBe(0);
        expect(wCtx.state.curY).toBe(0);
      });
    });

    // -- META_LINETO --
    describe("META_LINETO", () => {
      it("draws a line from current position and updates curX/curY", () => {
        const wCtx = makeWCtx();
        wCtx.state.curX = 10;
        wCtx.state.curY = 20;
        const d = 8;
        wCtx.view.setInt16(d, 50, true); // y
        wCtx.view.setInt16(d + 2, 40, true); // x
        handleWmfDrawRecord(wCtx, META_LINETO, 0, d, 10);
        expect(wCtx.state.curX).toBe(40);
        expect(wCtx.state.curY).toBe(50);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.stroke.mock.calls.length).toBe(1);
      });
    });

    // -- META_RECTANGLE --
    describe("META_RECTANGLE", () => {
      it("draws a filled and stroked rectangle", () => {
        const wCtx = makeWCtx();
        const d = 8;
        wCtx.view.setInt16(d, 100, true); // bottom
        wCtx.view.setInt16(d + 2, 80, true); // right
        wCtx.view.setInt16(d + 4, 10, true); // top
        wCtx.view.setInt16(d + 6, 5, true); // left
        handleWmfDrawRecord(wCtx, META_RECTANGLE, 0, d, 14);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fillRect.mock.calls.length).toBe(1);
        expect(ctx.strokeRect.mock.calls.length).toBe(1);
        // fillRect(mx(left), my(top), mw(right-left), mh(bottom-top))
        expect(ctx.fillRect.mock.calls[0]).toEqual([5, 10, 75, 90]);
      });

      it("ignores if recSize < 14", () => {
        const wCtx = makeWCtx();
        handleWmfDrawRecord(wCtx, META_RECTANGLE, 0, 8, 10);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fillRect.mock.calls.length).toBe(0);
      });
    });

    // -- META_ROUNDRECT --
    describe("META_ROUNDRECT", () => {
      it("draws a rounded rectangle", () => {
        const wCtx = makeWCtx();
        const d = 8;
        wCtx.view.setInt16(d, 10, true); // ellipse height
        wCtx.view.setInt16(d + 2, 10, true); // ellipse width
        wCtx.view.setInt16(d + 4, 100, true); // bottom
        wCtx.view.setInt16(d + 6, 80, true); // right
        wCtx.view.setInt16(d + 8, 0, true); // top
        wCtx.view.setInt16(d + 10, 0, true); // left
        handleWmfDrawRecord(wCtx, META_ROUNDRECT, 0, d, 18);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fill.mock.calls.length).toBe(1);
        expect(ctx.stroke.mock.calls.length).toBe(1);
      });
    });

    // -- META_ELLIPSE --
    describe("META_ELLIPSE", () => {
      it("draws an ellipse", () => {
        const wCtx = makeWCtx();
        const d = 8;
        wCtx.view.setInt16(d, 100, true); // bottom
        wCtx.view.setInt16(d + 2, 80, true); // right
        wCtx.view.setInt16(d + 4, 0, true); // top
        wCtx.view.setInt16(d + 6, 0, true); // left
        handleWmfDrawRecord(wCtx, META_ELLIPSE, 0, d, 14);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.ellipse.mock.calls.length).toBe(1);
        expect(ctx.fill.mock.calls.length).toBe(1);
        expect(ctx.stroke.mock.calls.length).toBe(1);
      });
    });

    // -- META_ARC / META_PIE / META_CHORD --
    describe("META_ARC", () => {
      it("draws an arc and strokes it", () => {
        const wCtx = makeWCtx();
        const d = 8;
        wCtx.view.setInt16(d, 50, true); // endY
        wCtx.view.setInt16(d + 2, 100, true); // endX
        wCtx.view.setInt16(d + 4, 0, true); // startY
        wCtx.view.setInt16(d + 6, 100, true); // startX
        wCtx.view.setInt16(d + 8, 100, true); // bottom
        wCtx.view.setInt16(d + 10, 100, true); // right
        wCtx.view.setInt16(d + 12, 0, true); // top
        wCtx.view.setInt16(d + 14, 0, true); // left
        handleWmfDrawRecord(wCtx, META_ARC, 0, d, 22);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.ellipse.mock.calls.length).toBe(1);
        expect(ctx.stroke.mock.calls.length).toBe(1);
        // ARC should NOT fill
        expect(ctx.fill.mock.calls.length).toBe(0);
      });
    });

    describe("META_PIE", () => {
      it("draws a pie (filled) with moveTo to center", () => {
        const wCtx = makeWCtx();
        const d = 8;
        wCtx.view.setInt16(d, 50, true);
        wCtx.view.setInt16(d + 2, 100, true);
        wCtx.view.setInt16(d + 4, 0, true);
        wCtx.view.setInt16(d + 6, 100, true);
        wCtx.view.setInt16(d + 8, 100, true);
        wCtx.view.setInt16(d + 10, 100, true);
        wCtx.view.setInt16(d + 12, 0, true);
        wCtx.view.setInt16(d + 14, 0, true);
        handleWmfDrawRecord(wCtx, META_PIE, 0, d, 22);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.moveTo.mock.calls.length).toBe(1);
        expect(ctx.closePath.mock.calls.length).toBe(1);
        expect(ctx.fill.mock.calls.length).toBe(1);
      });
    });

    describe("META_CHORD", () => {
      it("draws a chord (filled) without moveTo to center", () => {
        const wCtx = makeWCtx();
        const d = 8;
        wCtx.view.setInt16(d, 50, true);
        wCtx.view.setInt16(d + 2, 100, true);
        wCtx.view.setInt16(d + 4, 0, true);
        wCtx.view.setInt16(d + 6, 100, true);
        wCtx.view.setInt16(d + 8, 100, true);
        wCtx.view.setInt16(d + 10, 100, true);
        wCtx.view.setInt16(d + 12, 0, true);
        wCtx.view.setInt16(d + 14, 0, true);
        handleWmfDrawRecord(wCtx, META_CHORD, 0, d, 22);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.moveTo.mock.calls.length).toBe(0);
        expect(ctx.closePath.mock.calls.length).toBe(1);
        expect(ctx.fill.mock.calls.length).toBe(1);
      });
    });

    // -- META_POLYGON --
    describe("META_POLYGON", () => {
      it("draws a filled polygon", () => {
        const wCtx = makeWCtx();
        const d = 8;
        const offset = 0;
        wCtx.view.setInt16(d, 3, true); // count
        wCtx.view.setInt16(d + 2, 0, true); // p1.x
        wCtx.view.setInt16(d + 4, 0, true); // p1.y
        wCtx.view.setInt16(d + 6, 50, true); // p2.x
        wCtx.view.setInt16(d + 8, 0, true); // p2.y
        wCtx.view.setInt16(d + 10, 25, true); // p3.x
        wCtx.view.setInt16(d + 12, 50, true); // p3.y
        handleWmfDrawRecord(wCtx, META_POLYGON, offset, d, 14 + 3 * 4);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.closePath.mock.calls.length).toBe(1);
        expect(ctx.fill.mock.calls.length).toBe(1);
        expect(ctx.stroke.mock.calls.length).toBe(1);
      });

      it("uses WINDING fill rule when polyFillMode=2", () => {
        const wCtx = makeWCtx();
        wCtx.state.polyFillMode = 2;
        const d = 8;
        wCtx.view.setInt16(d, 3, true);
        wCtx.view.setInt16(d + 2, 0, true);
        wCtx.view.setInt16(d + 4, 0, true);
        wCtx.view.setInt16(d + 6, 10, true);
        wCtx.view.setInt16(d + 8, 0, true);
        wCtx.view.setInt16(d + 10, 5, true);
        wCtx.view.setInt16(d + 12, 10, true);
        handleWmfDrawRecord(wCtx, META_POLYGON, 0, d, 14 + 3 * 4);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fill.mock.calls[0][0]).toBe("nonzero");
      });
    });

    // -- META_POLYLINE --
    describe("META_POLYLINE", () => {
      it("draws a polyline (no fill)", () => {
        const wCtx = makeWCtx();
        const d = 8;
        wCtx.view.setInt16(d, 2, true);
        wCtx.view.setInt16(d + 2, 0, true);
        wCtx.view.setInt16(d + 4, 0, true);
        wCtx.view.setInt16(d + 6, 100, true);
        wCtx.view.setInt16(d + 8, 100, true);
        handleWmfDrawRecord(wCtx, META_POLYLINE, 0, d, 10 + 2 * 4);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.stroke.mock.calls.length).toBe(1);
        expect(ctx.fill.mock.calls.length).toBe(0);
      });
    });

    // -- META_POLYPOLYGON --
    describe("META_POLYPOLYGON", () => {
      it("draws multiple polygons", () => {
        const wCtx = makeWCtx();
        const d = 8;
        const offset = 0;
        wCtx.view.setUint16(d, 2, true); // numPolys
        wCtx.view.setInt16(d + 2, 3, true); // count[0]
        wCtx.view.setInt16(d + 4, 2, true); // count[1]
        // poly1: 3 points
        let off = d + 6;
        wCtx.view.setInt16(off, 0, true); wCtx.view.setInt16(off + 2, 0, true); off += 4;
        wCtx.view.setInt16(off, 10, true); wCtx.view.setInt16(off + 2, 0, true); off += 4;
        wCtx.view.setInt16(off, 5, true); wCtx.view.setInt16(off + 2, 10, true); off += 4;
        // poly2: 2 points
        wCtx.view.setInt16(off, 20, true); wCtx.view.setInt16(off + 2, 20, true); off += 4;
        wCtx.view.setInt16(off, 30, true); wCtx.view.setInt16(off + 2, 30, true); off += 4;
        handleWmfDrawRecord(wCtx, META_POLYPOLYGON, offset, d, off - offset);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fill.mock.calls.length).toBe(1);
        expect(ctx.stroke.mock.calls.length).toBe(1);
      });
    });

    // -- META_TEXTOUT --
    describe("META_TEXTOUT", () => {
      it("draws text at specified position", () => {
        const wCtx = makeWCtx();
        const d = 8;
        const offset = 0;
        const text = "ABC";
        wCtx.view.setInt16(d, text.length, true); // nChars
        for (let i = 0; i < text.length; i++) {
          wCtx.view.setUint8(d + 2 + i, text.charCodeAt(i));
        }
        // padding to even (3 chars -> +1 = 4)
        const strBytes = text.length + (text.length % 2);
        const txOff = d + 2 + strBytes;
        wCtx.view.setInt16(txOff, 50, true); // y
        wCtx.view.setInt16(txOff + 2, 30, true); // x
        handleWmfDrawRecord(wCtx, META_TEXTOUT, offset, d, txOff + 4);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fillText.mock.calls.length).toBe(1);
        expect(ctx.fillText.mock.calls[0][0]).toBe("ABC");
        expect(ctx.fillText.mock.calls[0][1]).toBe(30); // x
        expect(ctx.fillText.mock.calls[0][2]).toBe(50); // y
      });
    });

    // -- META_EXTTEXTOUT --
    describe("META_EXTTEXTOUT", () => {
      it("draws extended text without clip rect", () => {
        const wCtx = makeWCtx();
        const d = 8;
        const offset = 0;
        wCtx.view.setInt16(d, 10, true); // y
        wCtx.view.setInt16(d + 2, 20, true); // x
        wCtx.view.setInt16(d + 4, 2, true); // nChars
        wCtx.view.setUint16(d + 6, 0, true); // options (no clip rect)
        // string at d + 8
        wCtx.view.setUint8(d + 8, 72); // 'H'
        wCtx.view.setUint8(d + 9, 105); // 'i'
        // recSize must cover: dataOff(8) + header(8) + string(2) = 18
        handleWmfDrawRecord(wCtx, META_EXTTEXTOUT, offset, d, 18);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fillText.mock.calls.length).toBe(1);
        expect(ctx.fillText.mock.calls[0][0]).toBe("Hi");
      });

      it("draws extended text with clip rect (offset string by 8 bytes)", () => {
        const wCtx = makeWCtx();
        const d = 8;
        const offset = 0;
        wCtx.view.setInt16(d, 10, true);
        wCtx.view.setInt16(d + 2, 20, true);
        wCtx.view.setInt16(d + 4, 1, true); // nChars
        wCtx.view.setUint16(d + 6, 0x04, true); // ETO_CLIPPED
        // clip rect: 8 bytes
        wCtx.view.setInt16(d + 8, 0, true);
        wCtx.view.setInt16(d + 10, 0, true);
        wCtx.view.setInt16(d + 12, 100, true);
        wCtx.view.setInt16(d + 14, 100, true);
        // string at d + 16
        wCtx.view.setUint8(d + 16, 65); // 'A'
        // recSize must cover: dataOff(8) + header(8) + clipRect(8) + string(1) = 25
        handleWmfDrawRecord(wCtx, META_EXTTEXTOUT, offset, d, 25);
        const ctx = wCtx.ctx as unknown as Record<string, { mock: { calls: unknown[][] } }>;
        expect(ctx.fillText.mock.calls.length).toBe(1);
        expect(ctx.fillText.mock.calls[0][0]).toBe("A");
      });
    });
  });
});
