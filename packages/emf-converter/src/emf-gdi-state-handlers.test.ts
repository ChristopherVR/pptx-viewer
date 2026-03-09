import { describe, it, expect, vi } from "vitest";
import { handleEmfGdiStateRecord } from "./emf-gdi-state-handlers";
import type { EmfGdiReplayCtx } from "./emf-types";
import { defaultState } from "./emf-types";
import {
  EMR_SAVEDC,
  EMR_RESTOREDC,
  EMR_SETTEXTCOLOR,
  EMR_SETBKCOLOR,
  EMR_SETBKMODE,
  EMR_SETPOLYFILLMODE,
  EMR_SETTEXTALIGN,
  EMR_SETROP2,
  EMR_SETSTRETCHBLTMODE,
  EMR_SETMITERLIMIT,
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
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    arc: vi.fn(),
    bezierCurveTo: vi.fn(),
    arcTo: vi.fn(),
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

describe("emf-gdi-state-handlers", () => {
  describe("handleEmfGdiStateRecord()", () => {
    it("is a function with arity 5", () => {
      expect(typeof handleEmfGdiStateRecord).toBe("function");
      expect(handleEmfGdiStateRecord.length).toBe(5);
    });

    it("returns false for an unrecognized record type", () => {
      const rCtx = makeRCtx();
      expect(handleEmfGdiStateRecord(rCtx, 0xffff, 0, 8, 8)).toBe(false);
    });

    // -- EMR_SAVEDC / EMR_RESTOREDC --
    describe("EMR_SAVEDC", () => {
      it("pushes state onto the stack and calls ctx.save()", () => {
        const rCtx = makeRCtx();
        rCtx.state.penColor = "#aabbcc";
        const result = handleEmfGdiStateRecord(rCtx, EMR_SAVEDC, 0, 8, 8);
        expect(result).toBe(true);
        expect(rCtx.stateStack.length).toBe(1);
        expect(rCtx.stateStack[0].penColor).toBe("#aabbcc");
        expect((rCtx.ctx as unknown as Record<string, unknown>).save).toHaveBeenCalled();
      });

      it("unwinds clip save depth before saving", () => {
        const rCtx = makeRCtx();
        rCtx.clipSaveDepth = 2;
        handleEmfGdiStateRecord(rCtx, EMR_SAVEDC, 0, 8, 8);
        expect(rCtx.clipSaveDepth).toBe(0);
        expect((rCtx.ctx as unknown as Record<string, { mock: { calls: unknown[] } }>).restore.mock.calls.length).toBe(2);
      });
    });

    describe("EMR_RESTOREDC", () => {
      it("restores a previously saved state with relative index -1", () => {
        const rCtx = makeRCtx();
        rCtx.state.penColor = "#111111";

        // Save state twice so restore -1 pops to the first save
        handleEmfGdiStateRecord(rCtx, EMR_SAVEDC, 0, 8, 8);
        rCtx.state.penColor = "#222222";
        handleEmfGdiStateRecord(rCtx, EMR_SAVEDC, 0, 8, 8);
        rCtx.state.penColor = "#333333";

        // Restore (relative -1): pops to stack index len-1 = 1
        const dataOff = 8;
        rCtx.view.setInt32(dataOff, -1, true);
        handleEmfGdiStateRecord(rCtx, EMR_RESTOREDC, 0, dataOff, 12);
        // Restores the state that was at position 0 in the stack
        expect(rCtx.state.penColor).toBe("#111111");
      });

      it("ignores record if recSize < 12", () => {
        const rCtx = makeRCtx();
        rCtx.state.penColor = "#aaa";
        handleEmfGdiStateRecord(rCtx, EMR_SAVEDC, 0, 8, 8);
        rCtx.state.penColor = "#bbb";
        handleEmfGdiStateRecord(rCtx, EMR_RESTOREDC, 0, 8, 8); // recSize=8 too small
        expect(rCtx.state.penColor).toBe("#bbb"); // unchanged
      });
    });

    // -- Drawing mode / color settings --
    describe("EMR_SETTEXTCOLOR", () => {
      it("sets the textColor from COLORREF bytes", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint8(dataOff, 0xff);
        rCtx.view.setUint8(dataOff + 1, 0x80);
        rCtx.view.setUint8(dataOff + 2, 0x00);
        const result = handleEmfGdiStateRecord(rCtx, EMR_SETTEXTCOLOR, 0, dataOff, 12);
        expect(result).toBe(true);
        expect(rCtx.state.textColor).toBe("#ff8000");
      });

      it("ignores if recSize < 12", () => {
        const rCtx = makeRCtx();
        handleEmfGdiStateRecord(rCtx, EMR_SETTEXTCOLOR, 0, 8, 8);
        expect(rCtx.state.textColor).toBe("#000000"); // default unchanged
      });
    });

    describe("EMR_SETBKCOLOR", () => {
      it("sets bkColor from COLORREF bytes", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint8(dataOff, 0x10);
        rCtx.view.setUint8(dataOff + 1, 0x20);
        rCtx.view.setUint8(dataOff + 2, 0x30);
        handleEmfGdiStateRecord(rCtx, EMR_SETBKCOLOR, 0, dataOff, 12);
        expect(rCtx.state.bkColor).toBe("#102030");
      });
    });

    describe("EMR_SETBKMODE", () => {
      it("sets bkMode from uint32", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 2, true); // OPAQUE
        handleEmfGdiStateRecord(rCtx, EMR_SETBKMODE, 0, dataOff, 12);
        expect(rCtx.state.bkMode).toBe(2);
      });

      it("ignores if recSize < 12", () => {
        const rCtx = makeRCtx();
        handleEmfGdiStateRecord(rCtx, EMR_SETBKMODE, 0, 8, 8);
        expect(rCtx.state.bkMode).toBe(1); // default TRANSPARENT
      });
    });

    describe("EMR_SETPOLYFILLMODE", () => {
      it("sets polyFillMode to WINDING (2)", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 2, true);
        handleEmfGdiStateRecord(rCtx, EMR_SETPOLYFILLMODE, 0, dataOff, 12);
        expect(rCtx.state.polyFillMode).toBe(2);
      });
    });

    describe("EMR_SETTEXTALIGN", () => {
      it("sets textAlign from uint32", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 6, true); // TA_CENTER | TA_TOP
        handleEmfGdiStateRecord(rCtx, EMR_SETTEXTALIGN, 0, dataOff, 12);
        expect(rCtx.state.textAlign).toBe(6);
      });

      it("ignores if recSize < 12", () => {
        const rCtx = makeRCtx();
        handleEmfGdiStateRecord(rCtx, EMR_SETTEXTALIGN, 0, 8, 8);
        expect(rCtx.state.textAlign).toBe(0); // default
      });
    });

    describe("EMR_SETROP2 / EMR_SETSTRETCHBLTMODE / EMR_SETMITERLIMIT", () => {
      it("returns true for EMR_SETROP2 (accepted, no visible state change)", () => {
        const rCtx = makeRCtx();
        expect(handleEmfGdiStateRecord(rCtx, EMR_SETROP2, 0, 8, 12)).toBe(true);
      });

      it("returns true for EMR_SETSTRETCHBLTMODE", () => {
        const rCtx = makeRCtx();
        expect(handleEmfGdiStateRecord(rCtx, EMR_SETSTRETCHBLTMODE, 0, 8, 12)).toBe(true);
      });

      it("returns true for EMR_SETMITERLIMIT", () => {
        const rCtx = makeRCtx();
        expect(handleEmfGdiStateRecord(rCtx, EMR_SETMITERLIMIT, 0, 8, 12)).toBe(true);
      });
    });

    // -- Delegates to transform / object handlers --
    describe("delegation", () => {
      it("delegates EMR_SETWINDOWEXTEX (9) to transform handler", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setInt32(dataOff, 2000, true);
        rCtx.view.setInt32(dataOff + 4, 1500, true);
        const result = handleEmfGdiStateRecord(rCtx, 9, 0, dataOff, 16);
        expect(result).toBe(true);
        expect(rCtx.windowExt.cx).toBe(2000);
        expect(rCtx.windowExt.cy).toBe(1500);
      });

      it("delegates EMR_CREATEPEN (38) to object handler", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 1, true);
        rCtx.view.setUint32(dataOff + 4, 0, true);
        rCtx.view.setInt32(dataOff + 8, 1, true);
        rCtx.view.setUint8(dataOff + 16, 0);
        rCtx.view.setUint8(dataOff + 17, 0);
        rCtx.view.setUint8(dataOff + 18, 0);
        const result = handleEmfGdiStateRecord(rCtx, 38, 0, dataOff, 28);
        expect(result).toBe(true);
        expect(rCtx.objectTable.has(1)).toBe(true);
      });
    });
  });
});
