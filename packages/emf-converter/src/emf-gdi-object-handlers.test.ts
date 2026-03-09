import { describe, it, expect, vi } from "vitest";
import { handleEmfObjectRecord } from "./emf-gdi-object-handlers";
import type { EmfGdiReplayCtx, GdiObject } from "./emf-types";
import { defaultState } from "./emf-types";
import {
  EMR_CREATEPEN,
  EMR_EXTCREATEPEN,
  EMR_CREATEBRUSHINDIRECT,
  EMR_EXTCREATEFONTINDIRECTW,
  EMR_SELECTOBJECT,
  EMR_DELETEOBJECT,
  STOCK_OBJECT_BASE,
} from "./emf-constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtxStub(): Record<string, unknown> {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    strokeStyle: "#000000",
    fillStyle: "#ffffff",
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

describe("emf-gdi-object-handlers", () => {
  describe("handleEmfObjectRecord()", () => {
    it("is a function with arity 4", () => {
      expect(typeof handleEmfObjectRecord).toBe("function");
      expect(handleEmfObjectRecord.length).toBe(4);
    });

    it("returns false for an unrecognized record type", () => {
      const rCtx = makeRCtx();
      expect(handleEmfObjectRecord(rCtx, 0xffff, 8, 8)).toBe(false);
    });

    // -- EMR_CREATEPEN --
    describe("EMR_CREATEPEN", () => {
      it("creates a pen object in the object table", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        // ihPen
        rCtx.view.setUint32(dataOff, 1, true);
        // penStyle
        rCtx.view.setUint32(dataOff + 4, 0, true); // PS_SOLID
        // widthX
        rCtx.view.setInt32(dataOff + 8, 2, true);
        // 4 bytes padding (widthY is ignored, typically)
        // color at dataOff + 16
        rCtx.view.setUint8(dataOff + 16, 0xff); // R
        rCtx.view.setUint8(dataOff + 17, 0x00); // G
        rCtx.view.setUint8(dataOff + 18, 0x00); // B

        const result = handleEmfObjectRecord(rCtx, EMR_CREATEPEN, dataOff, 28);
        expect(result).toBe(true);
        const pen = rCtx.objectTable.get(1);
        expect(pen).toBeDefined();
        expect(pen!.kind).toBe("pen");
        if (pen!.kind === "pen") {
          expect(pen!.style).toBe(0);
          expect(pen!.widthX).toBe(2);
          expect(pen!.color).toBe("#ff0000");
        }
      });

      it("ignores record if recSize < 28", () => {
        const rCtx = makeRCtx();
        const result = handleEmfObjectRecord(rCtx, EMR_CREATEPEN, 8, 20);
        expect(result).toBe(true);
        expect(rCtx.objectTable.size).toBe(0);
      });
    });

    // -- EMR_EXTCREATEPEN --
    describe("EMR_EXTCREATEPEN", () => {
      it("creates a pen from extended pen record", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 2, true); // ihPen
        // penStyle at dataOff + 12
        rCtx.view.setUint32(dataOff + 12, 2, true); // PS_DOT
        // widthX at dataOff + 16
        rCtx.view.setInt32(dataOff + 16, 3, true);
        // color at dataOff + 24
        rCtx.view.setUint8(dataOff + 24, 0x00);
        rCtx.view.setUint8(dataOff + 25, 0xff);
        rCtx.view.setUint8(dataOff + 26, 0x00);

        const result = handleEmfObjectRecord(rCtx, EMR_EXTCREATEPEN, dataOff, 52);
        expect(result).toBe(true);
        const pen = rCtx.objectTable.get(2);
        expect(pen).toBeDefined();
        expect(pen!.kind).toBe("pen");
        if (pen!.kind === "pen") {
          expect(pen!.style).toBe(2);
          expect(pen!.widthX).toBe(3);
          expect(pen!.color).toBe("#00ff00");
        }
      });

      it("ignores record if recSize < 52", () => {
        const rCtx = makeRCtx();
        const result = handleEmfObjectRecord(rCtx, EMR_EXTCREATEPEN, 8, 40);
        expect(result).toBe(true);
        expect(rCtx.objectTable.size).toBe(0);
      });

      it("masks pen style to low byte", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 5, true); // ihPen
        rCtx.view.setUint32(dataOff + 12, 0x0100_0003, true); // high bits + PS_DASHDOT
        rCtx.view.setInt32(dataOff + 16, 1, true);
        rCtx.view.setUint8(dataOff + 24, 0);
        rCtx.view.setUint8(dataOff + 25, 0);
        rCtx.view.setUint8(dataOff + 26, 0);

        handleEmfObjectRecord(rCtx, EMR_EXTCREATEPEN, dataOff, 52);
        const pen = rCtx.objectTable.get(5) as GdiObject;
        expect(pen.kind).toBe("pen");
        if (pen.kind === "pen") {
          expect(pen.style).toBe(3);
        }
      });
    });

    // -- EMR_CREATEBRUSHINDIRECT --
    describe("EMR_CREATEBRUSHINDIRECT", () => {
      it("creates a brush object", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 3, true); // ihBrush
        rCtx.view.setUint32(dataOff + 4, 0, true); // BS_SOLID
        rCtx.view.setUint8(dataOff + 8, 0x00);
        rCtx.view.setUint8(dataOff + 9, 0x00);
        rCtx.view.setUint8(dataOff + 10, 0xff);

        const result = handleEmfObjectRecord(rCtx, EMR_CREATEBRUSHINDIRECT, dataOff, 24);
        expect(result).toBe(true);
        const brush = rCtx.objectTable.get(3);
        expect(brush).toBeDefined();
        expect(brush!.kind).toBe("brush");
        if (brush!.kind === "brush") {
          expect(brush!.style).toBe(0);
          expect(brush!.color).toBe("#0000ff");
        }
      });

      it("ignores record if recSize < 24", () => {
        const rCtx = makeRCtx();
        const result = handleEmfObjectRecord(rCtx, EMR_CREATEBRUSHINDIRECT, 8, 16);
        expect(result).toBe(true);
        expect(rCtx.objectTable.size).toBe(0);
      });
    });

    // -- EMR_EXTCREATEFONTINDIRECTW --
    describe("EMR_EXTCREATEFONTINDIRECTW", () => {
      it("creates a font object with correct properties", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 4, true); // ihFont
        rCtx.view.setInt32(dataOff + 4, -24, true); // height (negative = cell height)
        rCtx.view.setInt32(dataOff + 20, 700, true); // weight (bold)
        rCtx.view.setUint8(dataOff + 24, 1); // italic

        // Write "Arial" in UTF-16LE at dataOff + 28
        const name = "Arial";
        for (let i = 0; i < name.length; i++) {
          rCtx.view.setUint16(dataOff + 28 + i * 2, name.charCodeAt(i), true);
        }

        const result = handleEmfObjectRecord(rCtx, EMR_EXTCREATEFONTINDIRECTW, dataOff, 332);
        expect(result).toBe(true);
        const font = rCtx.objectTable.get(4);
        expect(font).toBeDefined();
        expect(font!.kind).toBe("font");
        if (font!.kind === "font") {
          expect(font!.height).toBe(24); // abs(-24)
          expect(font!.weight).toBe(700);
          expect(font!.italic).toBe(true);
          expect(font!.family).toBe("Arial");
        }
      });

      it("uses sans-serif as fallback when name is empty", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 5, true);
        rCtx.view.setInt32(dataOff + 4, 16, true);
        rCtx.view.setInt32(dataOff + 20, 400, true);
        rCtx.view.setUint8(dataOff + 24, 0);
        // leave name bytes as zero (null chars => empty string)

        handleEmfObjectRecord(rCtx, EMR_EXTCREATEFONTINDIRECTW, dataOff, 332);
        const font = rCtx.objectTable.get(5);
        expect(font).toBeDefined();
        if (font!.kind === "font") {
          expect(font!.family).toBe("sans-serif");
        }
      });

      it("ignores record if recSize < 332", () => {
        const rCtx = makeRCtx();
        const result = handleEmfObjectRecord(rCtx, EMR_EXTCREATEFONTINDIRECTW, 8, 200);
        expect(result).toBe(true);
        expect(rCtx.objectTable.size).toBe(0);
      });
    });

    // -- EMR_SELECTOBJECT --
    describe("EMR_SELECTOBJECT", () => {
      it("selects a pen from the object table and applies to state", () => {
        const rCtx = makeRCtx();
        rCtx.objectTable.set(1, { kind: "pen", style: 1, widthX: 5, color: "#abcdef" });
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 1, true); // ihObject = 1

        const result = handleEmfObjectRecord(rCtx, EMR_SELECTOBJECT, dataOff, 12);
        expect(result).toBe(true);
        expect(rCtx.state.penStyle).toBe(1);
        expect(rCtx.state.penWidth).toBe(5);
        expect(rCtx.state.penColor).toBe("#abcdef");
      });

      it("selects a brush from the object table", () => {
        const rCtx = makeRCtx();
        rCtx.objectTable.set(2, { kind: "brush", style: 0, color: "#112233" });
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 2, true);

        handleEmfObjectRecord(rCtx, EMR_SELECTOBJECT, dataOff, 12);
        expect(rCtx.state.brushStyle).toBe(0);
        expect(rCtx.state.brushColor).toBe("#112233");
      });

      it("selects a font from the object table", () => {
        const rCtx = makeRCtx();
        rCtx.objectTable.set(3, {
          kind: "font",
          height: 18,
          weight: 700,
          italic: true,
          family: "Courier",
        });
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 3, true);

        handleEmfObjectRecord(rCtx, EMR_SELECTOBJECT, dataOff, 12);
        expect(rCtx.state.fontHeight).toBe(18);
        expect(rCtx.state.fontWeight).toBe(700);
        expect(rCtx.state.fontItalic).toBe(true);
        expect(rCtx.state.fontFamily).toBe("Courier");
      });

      it("selects a stock object when handle >= STOCK_OBJECT_BASE", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        // stock object 7 = BLACK_PEN
        rCtx.view.setUint32(dataOff, STOCK_OBJECT_BASE + 7, true);

        handleEmfObjectRecord(rCtx, EMR_SELECTOBJECT, dataOff, 12);
        expect(rCtx.state.penStyle).toBe(0);
        expect(rCtx.state.penWidth).toBe(1);
        expect(rCtx.state.penColor).toBe("#000000");
      });

      it("does nothing when object handle not found", () => {
        const rCtx = makeRCtx();
        const originalPenColor = rCtx.state.penColor;
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 99, true); // non-existent handle

        handleEmfObjectRecord(rCtx, EMR_SELECTOBJECT, dataOff, 12);
        expect(rCtx.state.penColor).toBe(originalPenColor);
      });

      it("ignores record if recSize < 12", () => {
        const rCtx = makeRCtx();
        rCtx.objectTable.set(1, { kind: "pen", style: 2, widthX: 3, color: "#ff0000" });
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 1, true);

        handleEmfObjectRecord(rCtx, EMR_SELECTOBJECT, dataOff, 8);
        // State should be unchanged since recSize < 12
        expect(rCtx.state.penStyle).toBe(0);
      });
    });

    // -- EMR_DELETEOBJECT --
    describe("EMR_DELETEOBJECT", () => {
      it("removes an object from the object table", () => {
        const rCtx = makeRCtx();
        rCtx.objectTable.set(1, { kind: "pen", style: 0, widthX: 1, color: "#000000" });
        expect(rCtx.objectTable.size).toBe(1);

        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 1, true);
        const result = handleEmfObjectRecord(rCtx, EMR_DELETEOBJECT, dataOff, 12);
        expect(result).toBe(true);
        expect(rCtx.objectTable.size).toBe(0);
      });

      it("does not throw when deleting a non-existent handle", () => {
        const rCtx = makeRCtx();
        const dataOff = 8;
        rCtx.view.setUint32(dataOff, 999, true);
        expect(() =>
          handleEmfObjectRecord(rCtx, EMR_DELETEOBJECT, dataOff, 12),
        ).not.toThrow();
      });

      it("ignores record if recSize < 12", () => {
        const rCtx = makeRCtx();
        rCtx.objectTable.set(1, { kind: "pen", style: 0, widthX: 1, color: "#000000" });
        handleEmfObjectRecord(rCtx, EMR_DELETEOBJECT, 8, 8);
        expect(rCtx.objectTable.size).toBe(1); // unchanged
      });
    });
  });
});
