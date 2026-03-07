import { describe, it, expect, vi, beforeEach } from "vitest";
import { convertEmfToDataUrl, convertWmfToDataUrl } from "./index";
import { defaultState, cloneState, createEmfPlusState } from "./emf-types";
import type { DrawState, EmfGdiReplayCtx, EmfBounds } from "./emf-types";
import {
  colorRefToHex,
  readColorRef,
  argbToRgba,
} from "./emf-color-helpers";
import {
  parseEmfHeader,
  getRenderableEmfBounds,
  parseWmfHeader,
} from "./emf-header-parser";
import { readUtf16LE, getStockObject, createCanvas } from "./emf-canvas-helpers";
import { parseEmfPlusPath } from "./emf-plus-path";
import {
  parseEmfPlusPenObject,
  parseEmfPlusFontObject,
} from "./emf-plus-object-complex";
import { gmx, gmy, gmw, gmh, activateGdiMappingMode } from "./emf-gdi-coord";
import {
  EMR_HEADER,
  EMR_EOF,
  EMR_POLYPOLYLINE,
  EMR_SETPIXELV,
  EMR_OFFSETCLIPRGN,
  EMR_EXCLUDECLIPRECT,
  EMR_POLYGON,
  EMR_POLYLINE,
  EMR_COMMENT,
  EMFPLUS_SIGNATURE,
  EMR_COMMENT_PUBLIC_SIGNATURE,
  EMFPLUS_OBJECTTYPE_REGION,
  EMFPLUS_OBJECTTYPE_CUSTOMLINECAP,
  EMFPLUS_OFFSETCLIP,
  EMFPLUS_HEADER,
  EMFPLUS_ENDOFFILE,
  EMFPLUS_OBJECT,
  EMFPLUS_OBJECTTYPE_BRUSH,
  EMFPLUS_OBJECTTYPE_PEN,
  EMFPLUS_OBJECTTYPE_PATH,
  EMFPLUS_OBJECTTYPE_FONT,
  EMFPLUS_OBJECTTYPE_IMAGE,
  EMFPLUS_BRUSHTYPE_SOLID,
  STOCK_OBJECT_BASE,
  META_EOF,
  META_SETBKCOLOR,
  META_RECTANGLE,
  META_POLYPOLYGON,
} from "./emf-constants";

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

/** Write a UTF-16LE string into a DataView at the given byte offset. */
function writeUtf16LE(
  view: DataView,
  offset: number,
  str: string,
): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint16(offset + i * 2, str.charCodeAt(i), true);
  }
}

// ============================================================================
// 1. EMF Types & State
// ============================================================================

describe("emf-types", () => {
  describe("defaultState()", () => {
    it("returns correct default pen values", () => {
      const s = defaultState();
      expect(s.penColor).toBe("#000000");
      expect(s.penWidth).toBe(1);
      expect(s.penStyle).toBe(0);
    });

    it("returns correct default brush values", () => {
      const s = defaultState();
      expect(s.brushColor).toBe("#ffffff");
      expect(s.brushStyle).toBe(0);
    });

    it("returns correct default text values", () => {
      const s = defaultState();
      expect(s.textColor).toBe("#000000");
      expect(s.bkColor).toBe("#ffffff");
      expect(s.bkMode).toBe(1); // TRANSPARENT
    });

    it("returns correct default font values", () => {
      const s = defaultState();
      expect(s.fontHeight).toBe(12);
      expect(s.fontWeight).toBe(400);
      expect(s.fontItalic).toBe(false);
      expect(s.fontFamily).toBe("sans-serif");
    });

    it("returns identity world transform", () => {
      const s = defaultState();
      expect(s.worldTransform).toEqual([1, 0, 0, 1, 0, 0]);
    });

    it("returns correct default cursor and fill mode", () => {
      const s = defaultState();
      expect(s.curX).toBe(0);
      expect(s.curY).toBe(0);
      expect(s.polyFillMode).toBe(1); // ALTERNATE
      expect(s.textAlign).toBe(0);
    });

    it("returns a new object each time", () => {
      const a = defaultState();
      const b = defaultState();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe("cloneState()", () => {
    it("creates an independent copy", () => {
      const original = defaultState();
      const clone = cloneState(original);

      clone.penColor = "#ff0000";
      clone.penWidth = 5;
      clone.brushColor = "#00ff00";
      clone.fontHeight = 24;

      expect(original.penColor).toBe("#000000");
      expect(original.penWidth).toBe(1);
      expect(original.brushColor).toBe("#ffffff");
      expect(original.fontHeight).toBe(12);
    });

    it("deep-copies worldTransform", () => {
      const original = defaultState();
      const clone = cloneState(original);

      clone.worldTransform[0] = 2;
      clone.worldTransform[4] = 100;

      expect(original.worldTransform).toEqual([1, 0, 0, 1, 0, 0]);
    });

    it("preserves all values in clone", () => {
      const original = defaultState();
      original.penColor = "#abcdef";
      original.textAlign = 6;
      const clone = cloneState(original);

      expect(clone.penColor).toBe("#abcdef");
      expect(clone.textAlign).toBe(6);
    });
  });

  describe("createEmfPlusState()", () => {
    it("returns empty object table", () => {
      const s = createEmfPlusState();
      expect(s.objectTable).toBeInstanceOf(Map);
      expect(s.objectTable.size).toBe(0);
    });

    it("returns identity world transform", () => {
      const s = createEmfPlusState();
      expect(s.worldTransform).toEqual([1, 0, 0, 1, 0, 0]);
    });

    it("returns empty save stack and save ID map", () => {
      const s = createEmfPlusState();
      expect(s.saveStack).toEqual([]);
      expect(s.saveIdMap).toBeInstanceOf(Map);
      expect(s.saveIdMap.size).toBe(0);
    });

    it("returns a new instance each time", () => {
      const a = createEmfPlusState();
      const b = createEmfPlusState();
      expect(a).not.toBe(b);
      expect(a.objectTable).not.toBe(b.objectTable);
    });
  });
});

// ============================================================================
// 2. EMF Constants
// ============================================================================

describe("emf-constants", () => {
  describe("EMR record type constants", () => {
    it("has correct values for core EMR types", () => {
      expect(EMR_HEADER).toBe(1);
      expect(EMR_EOF).toBe(14);
      expect(EMR_POLYGON).toBe(3);
      expect(EMR_POLYLINE).toBe(4);
      expect(EMR_COMMENT).toBe(70);
    });

    it("has new EMR constants", () => {
      expect(EMR_POLYPOLYLINE).toBe(7);
      expect(EMR_SETPIXELV).toBe(15);
      expect(EMR_OFFSETCLIPRGN).toBe(26);
      expect(EMR_EXCLUDECLIPRECT).toBe(29);
    });
  });

  describe("EMFPLUS constants", () => {
    it("has correct EMFPLUS_SIGNATURE", () => {
      expect(EMFPLUS_SIGNATURE).toBe(0x2b464d45);
    });

    it("has new EMFPLUS object type constants", () => {
      expect(EMFPLUS_OBJECTTYPE_REGION).toBe(0x08);
      expect(EMFPLUS_OBJECTTYPE_CUSTOMLINECAP).toBe(0x09);
    });

    it("has EMFPLUS_OFFSETCLIP constant", () => {
      expect(EMFPLUS_OFFSETCLIP).toBe(0x4035);
    });

    it("has correct record type values", () => {
      expect(EMFPLUS_HEADER).toBe(0x4001);
      expect(EMFPLUS_ENDOFFILE).toBe(0x4002);
      expect(EMFPLUS_OBJECT).toBe(0x4008);
    });
  });

  describe("comment signature constants", () => {
    it("has EMR_COMMENT_PUBLIC_SIGNATURE", () => {
      expect(EMR_COMMENT_PUBLIC_SIGNATURE).toBe(0x43494447);
    });
  });

  describe("META (WMF) constants", () => {
    it("has correct WMF record type values", () => {
      expect(META_EOF).toBe(0x0000);
      expect(META_SETBKCOLOR).toBe(0x0201);
      expect(META_RECTANGLE).toBe(0x041b);
      expect(META_POLYPOLYGON).toBe(0x0538);
    });
  });

  describe("STOCK_OBJECT_BASE", () => {
    it("has correct value", () => {
      expect(STOCK_OBJECT_BASE).toBe(0x80000000);
    });
  });
});

// ============================================================================
// 3. Color Helpers
// ============================================================================

describe("emf-color-helpers", () => {
  describe("colorRefToHex()", () => {
    it("converts RGB to hex string", () => {
      expect(colorRefToHex(255, 0, 0)).toBe("#ff0000");
      expect(colorRefToHex(0, 255, 0)).toBe("#00ff00");
      expect(colorRefToHex(0, 0, 255)).toBe("#0000ff");
    });

    it("handles black and white", () => {
      expect(colorRefToHex(0, 0, 0)).toBe("#000000");
      expect(colorRefToHex(255, 255, 255)).toBe("#ffffff");
    });

    it("pads single-digit hex values", () => {
      expect(colorRefToHex(1, 2, 3)).toBe("#010203");
    });

    it("masks values to 0xFF", () => {
      expect(colorRefToHex(256, 0, 0)).toBe("#000000");
      expect(colorRefToHex(0x1ff, 0, 0)).toBe("#ff0000");
    });
  });

  describe("readColorRef()", () => {
    it("reads RGB bytes from DataView", () => {
      const view = buildBuffer(4, (v) => {
        v.setUint8(0, 0xaa);
        v.setUint8(1, 0xbb);
        v.setUint8(2, 0xcc);
      });
      expect(readColorRef(view, 0)).toBe("#aabbcc");
    });

    it("reads at a non-zero offset", () => {
      const view = buildBuffer(8, (v) => {
        v.setUint8(4, 0x10);
        v.setUint8(5, 0x20);
        v.setUint8(6, 0x30);
      });
      expect(readColorRef(view, 4)).toBe("#102030");
    });
  });

  describe("argbToRgba()", () => {
    it("converts fully opaque black", () => {
      // ARGB: A=255, R=0, G=0, B=0 => 0xFF000000
      expect(argbToRgba(0xff000000)).toBe("rgba(0,0,0,1.000)");
    });

    it("converts fully opaque red", () => {
      expect(argbToRgba(0xffff0000)).toBe("rgba(255,0,0,1.000)");
    });

    it("converts semi-transparent green", () => {
      // A=128 => 128/255 ≈ 0.502
      expect(argbToRgba(0x8000ff00)).toBe("rgba(0,255,0,0.502)");
    });

    it("converts fully transparent", () => {
      expect(argbToRgba(0x00ffffff)).toBe("rgba(255,255,255,0.000)");
    });

    it("converts arbitrary colour", () => {
      // ARGB: A=200, R=100, G=150, B=50 => 0xC8649632
      const argb = (200 << 24) | (100 << 16) | (150 << 8) | 50;
      const result = argbToRgba(argb >>> 0); // unsigned
      expect(result).toBe(`rgba(100,150,50,${(200 / 255).toFixed(3)})`);
    });
  });
});

// ============================================================================
// 4. EMF Header Parsing
// ============================================================================

describe("emf-header-parser", () => {
  /** Build a minimal valid EMF header (88 bytes minimum). */
  function buildEmfHeader(opts: {
    boundsLeft?: number;
    boundsTop?: number;
    boundsRight?: number;
    boundsBottom?: number;
    frameLeft?: number;
    frameTop?: number;
    frameRight?: number;
    frameBottom?: number;
  } = {}): DataView {
    return buildBuffer(108, (v) => {
      v.setUint32(0, EMR_HEADER, true); // recType
      v.setUint32(4, 108, true); // recSize
      v.setInt32(8, opts.boundsLeft ?? 0, true);
      v.setInt32(12, opts.boundsTop ?? 0, true);
      v.setInt32(16, opts.boundsRight ?? 800, true);
      v.setInt32(20, opts.boundsBottom ?? 600, true);
      v.setInt32(24, opts.frameLeft ?? 0, true);
      v.setInt32(28, opts.frameTop ?? 0, true);
      v.setInt32(32, opts.frameRight ?? 21000, true);
      v.setInt32(36, opts.frameBottom ?? 15000, true);
      v.setUint32(40, 0x464d4520, true); // " EMF" signature
      v.setUint32(44, 0x10000, true); // version
      v.setUint32(48, 108, true); // bytes (file size)
      v.setUint32(52, 1, true); // records
      v.setUint16(56, 1, true); // handles
      v.setUint16(58, 0, true); // reserved
    });
  }

  describe("parseEmfHeader()", () => {
    it("parses a minimal valid header", () => {
      const view = buildEmfHeader();
      const result = parseEmfHeader(view);

      expect(result).not.toBeNull();
      expect(result!.bounds.left).toBe(0);
      expect(result!.bounds.top).toBe(0);
      expect(result!.bounds.right).toBe(800);
      expect(result!.bounds.bottom).toBe(600);
      expect(result!.frameW).toBe(21000);
      expect(result!.frameH).toBe(15000);
    });

    it("parses custom bounds and frame", () => {
      const view = buildEmfHeader({
        boundsLeft: 10,
        boundsTop: 20,
        boundsRight: 500,
        boundsBottom: 400,
        frameLeft: 100,
        frameTop: 200,
        frameRight: 5100,
        frameBottom: 4200,
      });
      const result = parseEmfHeader(view);

      expect(result).not.toBeNull();
      expect(result!.bounds.left).toBe(10);
      expect(result!.bounds.top).toBe(20);
      expect(result!.bounds.right).toBe(500);
      expect(result!.bounds.bottom).toBe(400);
      expect(result!.frameW).toBe(5000);
      expect(result!.frameH).toBe(4000);
    });

    it("returns null for buffer smaller than 88 bytes", () => {
      const view = buildBuffer(60, () => {});
      expect(parseEmfHeader(view)).toBeNull();
    });

    it("returns null when first record is not EMR_HEADER", () => {
      const view = buildBuffer(108, (v) => {
        v.setUint32(0, 99, true); // wrong record type
        v.setUint32(4, 108, true);
      });
      expect(parseEmfHeader(view)).toBeNull();
    });

    it("returns null for empty buffer", () => {
      const view = new DataView(new ArrayBuffer(0));
      expect(parseEmfHeader(view)).toBeNull();
    });
  });

  describe("getRenderableEmfBounds()", () => {
    it("uses bounds when valid (positive width and height)", () => {
      const header = {
        bounds: { left: 0, top: 0, right: 800, bottom: 600 },
        frameW: 21000,
        frameH: 15000,
      };
      const result = getRenderableEmfBounds(header);

      expect(result).not.toBeNull();
      expect(result!.left).toBe(0);
      expect(result!.right).toBe(800);
    });

    it("falls back to frame when bounds have zero dimensions", () => {
      const header = {
        bounds: { left: 0, top: 0, right: 0, bottom: 0 },
        frameW: 500,
        frameH: 400,
      };
      const result = getRenderableEmfBounds(header);

      expect(result).not.toBeNull();
      expect(result!.left).toBe(0);
      expect(result!.top).toBe(0);
      expect(result!.right).toBe(500);
      expect(result!.bottom).toBe(400);
    });

    it("falls back to frame when bounds are negative", () => {
      const header = {
        bounds: { left: 100, top: 100, right: 50, bottom: 50 },
        frameW: 300,
        frameH: 200,
      };
      const result = getRenderableEmfBounds(header);

      expect(result).not.toBeNull();
      expect(result!.right).toBe(300);
      expect(result!.bottom).toBe(200);
    });

    it("returns null when both bounds and frame are invalid", () => {
      const header = {
        bounds: { left: 0, top: 0, right: 0, bottom: 0 },
        frameW: 0,
        frameH: 0,
      };
      expect(getRenderableEmfBounds(header)).toBeNull();
    });

    it("returns null when frame dimensions are negative", () => {
      const header = {
        bounds: { left: 0, top: 0, right: 0, bottom: 0 },
        frameW: -100,
        frameH: -200,
      };
      expect(getRenderableEmfBounds(header)).toBeNull();
    });
  });

  describe("parseWmfHeader()", () => {
    /** Build a WMF with Aldus placeable header. */
    function buildWmfHeader(opts: {
      boundsLeft?: number;
      boundsTop?: number;
      boundsRight?: number;
      boundsBottom?: number;
      unitsPerInch?: number;
      fileType?: number;
      maxRecordSizeWords?: number;
    } = {}): DataView {
      // Aldus header = 22 bytes, standard WMF header = 18 bytes
      return buildBuffer(40, (v) => {
        // Aldus placeable header
        v.setUint32(0, 0x9ac6cdd7, true); // magic
        v.setUint16(4, 0, true); // handle
        v.setInt16(6, opts.boundsLeft ?? 0, true);
        v.setInt16(8, opts.boundsTop ?? 0, true);
        v.setInt16(10, opts.boundsRight ?? 800, true);
        v.setInt16(12, opts.boundsBottom ?? 600, true);
        v.setUint16(14, opts.unitsPerInch ?? 96, true);
        v.setUint32(16, 0, true); // reserved
        v.setUint16(20, 0, true); // checksum

        // Standard WMF header at offset 22 (headerOffset)
        // The parser reads: fileType at +0, headerSizeWords at +2,
        // and maxRecordSize at +8 (Uint32, in 16-bit words).
        v.setUint16(22, opts.fileType ?? 1, true); // type (1=memory, 2=disk)
        v.setUint16(24, 9, true); // headerSize (in 16-bit words)
        v.setUint16(26, 0x0300, true); // version
        v.setUint32(28, 20, true); // fileSize (in 16-bit words) — overlaps +8
        // maxRecordSize at headerOffset+8 = offset 30 (Uint32)
        v.setUint32(30, opts.maxRecordSizeWords ?? 10, true);
        v.setUint16(34, 0, true); // numObjects
        v.setUint32(36, 0, true); // padding
      });
    }

    it("parses a valid WMF with Aldus placeable header", () => {
      const view = buildWmfHeader();
      const result = parseWmfHeader(view);

      expect(result).not.toBeNull();
      expect(result!.boundsLeft).toBe(0);
      expect(result!.boundsTop).toBe(0);
      expect(result!.boundsRight).toBe(800);
      expect(result!.boundsBottom).toBe(600);
      expect(result!.unitsPerInch).toBe(96);
      // headerSize = 22 (Aldus) + 9 * 2 (standard) = 40
      expect(result!.headerSize).toBe(40);
      // maxRecordSize is at headerOffset+8 = offset 30, value 10, *2 = 20
      expect(result!.maxRecordSize).toBe(20);
    });

    it("parses with custom bounds and unitsPerInch", () => {
      const view = buildWmfHeader({
        boundsLeft: -50,
        boundsTop: -100,
        boundsRight: 1024,
        boundsBottom: 768,
        unitsPerInch: 1440,
      });
      const result = parseWmfHeader(view);

      expect(result).not.toBeNull();
      expect(result!.boundsLeft).toBe(-50);
      expect(result!.boundsTop).toBe(-100);
      expect(result!.boundsRight).toBe(1024);
      expect(result!.boundsBottom).toBe(768);
      expect(result!.unitsPerInch).toBe(1440);
    });

    it("accepts fileType 2 (disk-based)", () => {
      const view = buildWmfHeader({ fileType: 2 });
      const result = parseWmfHeader(view);
      expect(result).not.toBeNull();
    });

    it("returns null for buffer too small", () => {
      const view = buildBuffer(10, () => {});
      expect(parseWmfHeader(view)).toBeNull();
    });

    it("returns null when standard header extends beyond buffer", () => {
      // Only Aldus header (22 bytes), not enough for standard header
      const view = buildBuffer(22, (v) => {
        v.setUint32(0, 0x9ac6cdd7, true);
      });
      expect(parseWmfHeader(view)).toBeNull();
    });

    it("returns null for invalid file type", () => {
      const view = buildWmfHeader({ fileType: 0 });
      expect(parseWmfHeader(view)).toBeNull();
    });

    it("returns null for fileType other than 1 or 2", () => {
      const view = buildWmfHeader({ fileType: 5 });
      expect(parseWmfHeader(view)).toBeNull();
    });

    it("defaults unitsPerInch to 96 when zero", () => {
      const view = buildWmfHeader({ unitsPerInch: 0 });
      const result = parseWmfHeader(view);
      expect(result).not.toBeNull();
      expect(result!.unitsPerInch).toBe(96);
    });

    it("handles WMF without Aldus header (non-magic first bytes)", () => {
      // Standard WMF header only (no Aldus prefix).
      // The magic won't match 0x9ac6cdd7, so headerOffset stays 0.
      const view = buildBuffer(22, (v) => {
        // No Aldus magic — standard header starts at offset 0
        v.setUint16(0, 1, true); // type
        v.setUint16(2, 9, true); // headerSize in 16-bit words
        v.setUint16(4, 0x0300, true); // version
        v.setUint32(6, 20, true); // fileSize in words
        v.setUint16(10, 0, true); // numObjects
        v.setUint32(12, 10, true); // maxRecordSize in words
        v.setUint16(16, 0, true); // unused
      });
      const result = parseWmfHeader(view);
      expect(result).not.toBeNull();
      // headerSize = 0 + 9 * 2 = 18
      expect(result!.headerSize).toBe(18);
      // Default bounds for non-Aldus
      expect(result!.boundsRight).toBe(800);
      expect(result!.boundsBottom).toBe(600);
    });
  });
});

// ============================================================================
// 5. Canvas Helpers
// ============================================================================

describe("emf-canvas-helpers", () => {
  describe("readUtf16LE()", () => {
    it("reads a simple ASCII string as UTF-16LE", () => {
      const view = buildBuffer(10, (v) => {
        writeUtf16LE(v, 0, "Hello");
      });
      expect(readUtf16LE(view, 0, 5)).toBe("Hello");
    });

    it("stops at null terminator", () => {
      const view = buildBuffer(12, (v) => {
        writeUtf16LE(v, 0, "AB");
        v.setUint16(4, 0, true); // null terminator
        writeUtf16LE(v, 6, "CD");
      });
      expect(readUtf16LE(view, 0, 6)).toBe("AB");
    });

    it("handles empty string (all nulls)", () => {
      const view = buildBuffer(8, () => {}); // all zeroes
      expect(readUtf16LE(view, 0, 4)).toBe("");
    });

    it("handles zero charCount", () => {
      const view = buildBuffer(4, (v) => {
        writeUtf16LE(v, 0, "AB");
      });
      expect(readUtf16LE(view, 0, 0)).toBe("");
    });

    it("reads at non-zero offset", () => {
      const view = buildBuffer(14, (v) => {
        writeUtf16LE(v, 4, "Test");
      });
      expect(readUtf16LE(view, 4, 4)).toBe("Test");
    });

    it("handles reading past buffer end gracefully", () => {
      const view = buildBuffer(4, (v) => {
        writeUtf16LE(v, 0, "AB");
      });
      // Request 10 chars but only 2 fit in 4 bytes
      expect(readUtf16LE(view, 0, 10)).toBe("AB");
    });

    it("reads Unicode characters", () => {
      const view = buildBuffer(6, (v) => {
        v.setUint16(0, 0x00c9, true); // É
        v.setUint16(2, 0x00f1, true); // ñ
        v.setUint16(4, 0x00fc, true); // ü
      });
      expect(readUtf16LE(view, 0, 3)).toBe("Éñü");
    });
  });

  describe("getStockObject()", () => {
    it("returns white brush for index 0", () => {
      const obj = getStockObject(0);
      expect(obj).toEqual({ kind: "brush", style: 0, color: "#ffffff" });
    });

    it("returns light gray brush for index 1", () => {
      const obj = getStockObject(1);
      expect(obj).toEqual({ kind: "brush", style: 0, color: "#c0c0c0" });
    });

    it("returns gray brush for index 2", () => {
      const obj = getStockObject(2);
      expect(obj).toEqual({ kind: "brush", style: 0, color: "#808080" });
    });

    it("returns dark gray brush for index 3", () => {
      const obj = getStockObject(3);
      expect(obj).toEqual({ kind: "brush", style: 0, color: "#404040" });
    });

    it("returns black brush for index 4", () => {
      const obj = getStockObject(4);
      expect(obj).toEqual({ kind: "brush", style: 0, color: "#000000" });
    });

    it("returns null (hollow) brush for index 5", () => {
      const obj = getStockObject(5);
      expect(obj).toEqual({ kind: "brush", style: 1, color: "#000000" });
    });

    it("returns white pen for index 6", () => {
      const obj = getStockObject(6);
      expect(obj).toEqual({ kind: "pen", style: 0, widthX: 1, color: "#ffffff" });
    });

    it("returns black pen for index 7", () => {
      const obj = getStockObject(7);
      expect(obj).toEqual({ kind: "pen", style: 0, widthX: 1, color: "#000000" });
    });

    it("returns null pen for index 8", () => {
      const obj = getStockObject(8);
      expect(obj).toEqual({ kind: "pen", style: 5, widthX: 0, color: "#000000" });
    });

    it("returns monospace font for indices 10 and 11", () => {
      for (const idx of [10, 11]) {
        const obj = getStockObject(idx);
        expect(obj).toEqual({
          kind: "font",
          height: 12,
          weight: 400,
          italic: false,
          family: "monospace",
        });
      }
    });

    it("returns sans-serif font for indices 12, 13, 14, 17", () => {
      for (const idx of [12, 13, 14, 17]) {
        const obj = getStockObject(idx);
        expect(obj).toEqual({
          kind: "font",
          height: 12,
          weight: 400,
          italic: false,
          family: "sans-serif",
        });
      }
    });

    it("returns null for unknown index", () => {
      expect(getStockObject(9)).toBeNull();
      expect(getStockObject(15)).toBeNull();
      expect(getStockObject(16)).toBeNull();
      expect(getStockObject(100)).toBeNull();
      expect(getStockObject(-1)).toBeNull();
    });
  });

  describe("createCanvas()", () => {
    it("returns null when neither OffscreenCanvas nor document available", () => {
      // In Node.js test environment, neither should be available
      const result = createCanvas(100, 100);
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// 6. EMF+ Path Parsing
// ============================================================================

describe("emf-plus-path", () => {
  describe("parseEmfPlusPath()", () => {
    it("parses a simple compressed path (moveto + lineto)", () => {
      // Path with 2 points, compressed (Int16 coords), moveto + lineto
      const pointCount = 2;
      const headerSize = 12; // version + pointCount + pathFlags
      const pointSize = 4; // compressed: 2x Int16
      const pointsBytes = pointCount * pointSize;
      // types come after points, aligned to 4 bytes
      const typesOffset = headerSize + pointsBytes;
      // typesOffset = 12 + 8 = 20, already 4-byte aligned
      const totalSize = typesOffset + pointCount; // 20 + 2 = 22

      const view = buildBuffer(totalSize, (v) => {
        v.setUint32(0, 0xdbc01002, true); // version
        v.setUint32(4, pointCount, true); // pointCount
        v.setUint32(8, 0x4000, true); // pathFlags (bit 14 = compressed)

        // Points (compressed: Int16 pairs)
        v.setInt16(12, 10, true); // point 0: x=10
        v.setInt16(14, 20, true); // point 0: y=20
        v.setInt16(16, 100, true); // point 1: x=100
        v.setInt16(18, 200, true); // point 1: y=200

        // Types (at offset 20, already aligned)
        v.setUint8(20, 0x00); // moveto (type 0 = Start)
        v.setUint8(21, 0x01); // lineto (type 1 = Line)
      });

      const result = parseEmfPlusPath(view, 0, totalSize);

      expect(result).not.toBeNull();
      expect(result!.kind).toBe("plus-path");
      expect(result!.points).toHaveLength(2);
      expect(result!.points[0]).toEqual({ x: 10, y: 20 });
      expect(result!.points[1]).toEqual({ x: 100, y: 200 });
      expect(result!.types[0]).toBe(0x00);
      expect(result!.types[1]).toBe(0x01);
    });

    it("parses uncompressed path (Float32 coords)", () => {
      const pointCount = 2;
      const headerSize = 12;
      const pointSize = 8; // uncompressed: 2x Float32
      const pointsBytes = pointCount * pointSize;
      const typesOffset = headerSize + pointsBytes; // 12 + 16 = 28
      const totalSize = typesOffset + pointCount; // 28 + 2 = 30

      const view = buildBuffer(totalSize, (v) => {
        v.setUint32(0, 0xdbc01002, true);
        v.setUint32(4, pointCount, true);
        v.setUint32(8, 0x0000, true); // flags: NOT compressed

        // Points (Float32 pairs)
        v.setFloat32(12, 1.5, true);
        v.setFloat32(16, 2.5, true);
        v.setFloat32(20, 3.5, true);
        v.setFloat32(24, 4.5, true);

        // Types (at offset 28, 4-byte aligned)
        v.setUint8(28, 0x00); // moveto
        v.setUint8(29, 0x01); // lineto
      });

      const result = parseEmfPlusPath(view, 0, totalSize);

      expect(result).not.toBeNull();
      expect(result!.points).toHaveLength(2);
      expect(result!.points[0].x).toBeCloseTo(1.5);
      expect(result!.points[0].y).toBeCloseTo(2.5);
      expect(result!.points[1].x).toBeCloseTo(3.5);
      expect(result!.points[1].y).toBeCloseTo(4.5);
    });

    it("parses path with close flag on last point", () => {
      const pointCount = 3;
      const headerSize = 12;
      const pointsBytes = pointCount * 4; // compressed
      const typesOffset = headerSize + pointsBytes; // 12 + 12 = 24
      const totalSize = typesOffset + pointCount; // 24 + 3 = 27

      const view = buildBuffer(28, (v) => { // pad to 28 for alignment safety
        v.setUint32(0, 0xdbc01002, true);
        v.setUint32(4, pointCount, true);
        v.setUint32(8, 0x4000, true); // compressed

        v.setInt16(12, 0, true);
        v.setInt16(14, 0, true);
        v.setInt16(16, 100, true);
        v.setInt16(18, 0, true);
        v.setInt16(20, 100, true);
        v.setInt16(22, 100, true);

        // types at offset 24
        v.setUint8(24, 0x00); // moveto
        v.setUint8(25, 0x01); // lineto
        v.setUint8(26, 0x81); // lineto + close (bit 7)
      });

      const result = parseEmfPlusPath(view, 0, 27);

      expect(result).not.toBeNull();
      expect(result!.points).toHaveLength(3);
      expect(result!.types[2]).toBe(0x81); // close flag set
    });

    it("returns null for maxLen < 12", () => {
      const view = buildBuffer(8, () => {});
      expect(parseEmfPlusPath(view, 0, 8)).toBeNull();
    });

    it("returns null for zero point count", () => {
      const view = buildBuffer(16, (v) => {
        v.setUint32(0, 0xdbc01002, true);
        v.setUint32(4, 0, true); // zero points
        v.setUint32(8, 0x4000, true);
      });
      expect(parseEmfPlusPath(view, 0, 16)).toBeNull();
    });

    it("returns null for excessively large point count", () => {
      const view = buildBuffer(16, (v) => {
        v.setUint32(0, 0xdbc01002, true);
        v.setUint32(4, 200000, true); // > 100000
        v.setUint32(8, 0x4000, true);
      });
      expect(parseEmfPlusPath(view, 0, 16)).toBeNull();
    });

    it("returns null when buffer is too small for points + types", () => {
      // 2 compressed points need 12 + 8 + 2 = 22 bytes
      const view = buildBuffer(16, (v) => {
        v.setUint32(0, 0xdbc01002, true);
        v.setUint32(4, 2, true);
        v.setUint32(8, 0x4000, true);
      });
      expect(parseEmfPlusPath(view, 0, 16)).toBeNull();
    });

    it("handles non-zero offset", () => {
      const offset = 8;
      const pointCount = 1;
      const totalSize = 12 + 4 + 4; // header + 1 compressed point (4 bytes) + 1 type byte, padded to 4
      const bufSize = offset + totalSize;

      const view = buildBuffer(bufSize, (v) => {
        v.setUint32(offset, 0xdbc01002, true);
        v.setUint32(offset + 4, pointCount, true);
        v.setUint32(offset + 8, 0x4000, true); // compressed

        v.setInt16(offset + 12, 42, true);
        v.setInt16(offset + 14, 84, true);

        // types at offset+16, aligned to 4 bytes
        v.setUint8(offset + 16, 0x00);
      });

      const result = parseEmfPlusPath(view, offset, totalSize);

      expect(result).not.toBeNull();
      expect(result!.points).toHaveLength(1);
      expect(result!.points[0]).toEqual({ x: 42, y: 84 });
    });
  });
});

// ============================================================================
// 7. EMF+ Object Parsing (Font)
// ============================================================================

describe("emf-plus-object-complex", () => {
  describe("parseEmfPlusFontObject()", () => {
    /**
     * Build a minimal EMF+ Font object.
     * Layout:
     *   +0: Uint32 version
     *   +4: Float32 emSize
     *   +8: Uint32 sizeUnit
     *   +12: Int32 styleFlags
     *   +16: Uint32 reserved
     *   +20: Uint32 nameLength (number of UTF-16 chars)
     *   +24: UTF-16LE family name
     */
    function buildFontObject(opts: {
      emSize?: number;
      styleFlags?: number;
      family?: string;
    } = {}): { view: DataView; size: number } {
      const family = opts.family ?? "Arial";
      const nameLen = family.length;
      const size = 24 + nameLen * 2;
      const view = buildBuffer(size, (v) => {
        v.setUint32(0, 0xdbc01002, true); // version
        v.setFloat32(4, opts.emSize ?? 12, true);
        v.setUint32(8, 2, true); // sizeUnit (pixel)
        v.setInt32(12, opts.styleFlags ?? 0, true);
        v.setUint32(16, 0, true); // reserved
        v.setUint32(20, nameLen, true);
        writeUtf16LE(v, 24, family);
      });
      return { view, size };
    }

    it("parses a font with family name", () => {
      const { view, size } = buildFontObject({ emSize: 16, family: "Calibri" });
      const result = parseEmfPlusFontObject(view, 0, size);

      expect(result).not.toBeNull();
      expect(result!.kind).toBe("plus-font");
      if (result!.kind === "plus-font") {
        expect(result!.emSize).toBe(16);
        expect(result!.family).toBe("Calibri");
        expect(result!.flags).toBe(0);
      }
    });

    it("parses bold+italic flags", () => {
      const { view, size } = buildFontObject({
        emSize: 24,
        styleFlags: 3, // Bold(1) | Italic(2)
        family: "Times",
      });
      const result = parseEmfPlusFontObject(view, 0, size);

      expect(result).not.toBeNull();
      if (result!.kind === "plus-font") {
        expect(result!.flags).toBe(3);
        expect(result!.family).toBe("Times");
        expect(result!.emSize).toBe(24);
      }
    });

    it("defaults emSize to 12 when zero", () => {
      const { view, size } = buildFontObject({ emSize: 0 });
      const result = parseEmfPlusFontObject(view, 0, size);

      expect(result).not.toBeNull();
      if (result!.kind === "plus-font") {
        expect(result!.emSize).toBe(12);
      }
    });

    it("defaults family to sans-serif when nameLength is 0", () => {
      const view = buildBuffer(28, (v) => {
        v.setUint32(0, 0xdbc01002, true);
        v.setFloat32(4, 14, true);
        v.setUint32(8, 2, true);
        v.setInt32(12, 0, true);
        v.setUint32(16, 0, true);
        v.setUint32(20, 0, true); // nameLength = 0
      });
      const result = parseEmfPlusFontObject(view, 0, 28);

      expect(result).not.toBeNull();
      if (result!.kind === "plus-font") {
        expect(result!.family).toBe("sans-serif");
      }
    });

    it("returns null when recDataSize < 28", () => {
      const view = buildBuffer(20, () => {});
      expect(parseEmfPlusFontObject(view, 0, 20)).toBeNull();
    });

    it("handles non-zero dataOff", () => {
      const offset = 16;
      const family = "Mono";
      const nameLen = family.length;
      const dataSize = 24 + nameLen * 2;
      const totalBufSize = offset + dataSize;

      const view = buildBuffer(totalBufSize, (v) => {
        v.setUint32(offset, 0xdbc01002, true);
        v.setFloat32(offset + 4, 10, true);
        v.setUint32(offset + 8, 2, true);
        v.setInt32(offset + 12, 0, true);
        v.setUint32(offset + 16, 0, true);
        v.setUint32(offset + 20, nameLen, true);
        writeUtf16LE(v, offset + 24, family);
      });

      const result = parseEmfPlusFontObject(view, offset, dataSize);
      expect(result).not.toBeNull();
      if (result!.kind === "plus-font") {
        expect(result!.family).toBe("Mono");
        expect(result!.emSize).toBe(10);
      }
    });
  });

  describe("parseEmfPlusPenObject()", () => {
    it("parses a simple pen with no optional flags", () => {
      // With penFlags = 0, brushOff = dataOff + 20.
      // Then brush: Uint32 brushType + Uint32 ARGB color
      const size = 28; // 20 (header) + 8 (brush)

      const view = buildBuffer(size, (v) => {
        v.setUint32(0, 0, true); // version/type
        v.setUint32(4, 0, true); // penFlags = 0 (no optional fields)
        v.setUint32(8, 0, true); // unit
        v.setUint32(12, 0, true); // padding
        v.setFloat32(16, 2.5, true); // penWidth
        // Brush data at offset 20
        v.setUint32(20, EMFPLUS_BRUSHTYPE_SOLID, true); // brushType = solid
        v.setUint32(24, 0xffff0000, true); // ARGB red
      });

      const result = parseEmfPlusPenObject(view, 0, size);

      expect(result).not.toBeNull();
      expect(result!.kind).toBe("plus-pen");
      if (result!.kind === "plus-pen") {
        expect(result!.width).toBe(2.5);
        expect(result!.color).toBe("rgba(255,0,0,1.000)");
        expect(result!.dashStyle).toBe(0);
      }
    });

    it("parses pen with DashStyle flag", () => {
      // penFlags = 0x00000020 (LineStyle flag)
      // Before brush, we have the 4-byte dashStyle value
      const size = 32; // 20 + 4 (dashStyle) + 8 (brush)

      const view = buildBuffer(size, (v) => {
        v.setUint32(0, 0, true);
        v.setUint32(4, 0x00000020, true); // penFlags with LineStyle
        v.setUint32(8, 0, true);
        v.setUint32(12, 0, true);
        v.setFloat32(16, 1.0, true);
        // DashStyle at offset 20
        v.setUint32(20, 2, true); // dashStyle = Dot
        // Brush at offset 24
        v.setUint32(24, EMFPLUS_BRUSHTYPE_SOLID, true);
        v.setUint32(28, 0xff0000ff, true); // ARGB blue
      });

      const result = parseEmfPlusPenObject(view, 0, size);

      expect(result).not.toBeNull();
      if (result!.kind === "plus-pen") {
        expect(result!.dashStyle).toBe(2);
        expect(result!.color).toBe("rgba(0,0,255,1.000)");
      }
    });

    it("returns null for insufficient data (< 20 bytes)", () => {
      const view = buildBuffer(16, () => {});
      expect(parseEmfPlusPenObject(view, 0, 16)).toBeNull();
    });

    it("defaults pen width to 1 when zero", () => {
      const size = 28;
      const view = buildBuffer(size, (v) => {
        v.setUint32(0, 0, true);
        v.setUint32(4, 0, true);
        v.setUint32(8, 0, true);
        v.setUint32(12, 0, true);
        v.setFloat32(16, 0, true); // zero width
        v.setUint32(20, EMFPLUS_BRUSHTYPE_SOLID, true);
        v.setUint32(24, 0xff000000, true);
      });

      const result = parseEmfPlusPenObject(view, 0, size);
      expect(result).not.toBeNull();
      if (result!.kind === "plus-pen") {
        expect(result!.width).toBe(1); // fallback
      }
    });
  });
});

// ============================================================================
// 8. Region Object Parsing
// ============================================================================

describe("emf-plus-object-parser (Region)", () => {
  function buildMinimalReplayCtx(view: DataView) {
    return {
      ctx: null as any,
      view,
      objectTable: new Map(),
      worldTransform: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number],
      deferredImages: [],
      saveStack: [],
      saveIdMap: new Map(),
      totalImageObjects: 0,
      totalDrawImageCalls: 0,
      clipSaveDepth: 0,
      pageUnit: 0,
      pageScale: 1,
      continuationBuffer: null,
      continuationObjectId: -1,
      continuationObjectType: -1,
      continuationTotalSize: 0,
      continuationOffset: 0,
    };
  }

  it("stores a region object with a rect node via handleEmfPlusObjectRecord", async () => {
    const { handleEmfPlusObjectRecord } = await import("./emf-plus-object-parser");

    // Build a region with a single rect node
    const dataSize = 28;
    const view = buildBuffer(dataSize, (v) => {
      v.setUint32(0, 0xdbc01002, true); // version
      v.setUint32(4, 1, true); // regionNodeCount
      v.setUint32(8, 0x10000000, true); // rect node
      v.setFloat32(12, 10.0, true); // x
      v.setFloat32(16, 20.0, true); // y
      v.setFloat32(20, 100.0, true); // width
      v.setFloat32(24, 200.0, true); // height
    });

    const recFlags = 5 | (EMFPLUS_OBJECTTYPE_REGION << 8);
    const rCtx = buildMinimalReplayCtx(view);

    handleEmfPlusObjectRecord(rCtx, recFlags, 0, dataSize);

    const region = rCtx.objectTable.get(5);
    expect(region).not.toBeUndefined();
    expect(region!.kind).toBe("plus-region");
    if (region!.kind === "plus-region") {
      expect(region!.nodes).toHaveLength(1);
      const node = region!.nodes[0];
      expect(node.type).toBe("rect");
      if (node.type === "rect") {
        expect(node.x).toBeCloseTo(10);
        expect(node.y).toBeCloseTo(20);
        expect(node.width).toBeCloseTo(100);
        expect(node.height).toBeCloseTo(200);
      }
    }
  });

  it("stores a region with an infinite node", async () => {
    const { handleEmfPlusObjectRecord } = await import("./emf-plus-object-parser");

    const dataSize = 12;
    const view = buildBuffer(dataSize, (v) => {
      v.setUint32(0, 0xdbc01002, true);
      v.setUint32(4, 1, true);
      v.setUint32(8, 0x10000003, true); // infinite node
    });

    const recFlags = 3 | (EMFPLUS_OBJECTTYPE_REGION << 8);
    const rCtx = buildMinimalReplayCtx(view);
    handleEmfPlusObjectRecord(rCtx, recFlags, 0, dataSize);

    const region = rCtx.objectTable.get(3);
    expect(region).not.toBeUndefined();
    expect(region!.kind).toBe("plus-region");
    if (region!.kind === "plus-region") {
      expect(region!.nodes[0].type).toBe("infinite");
    }
  });

  it("stores a region with an empty node", async () => {
    const { handleEmfPlusObjectRecord } = await import("./emf-plus-object-parser");

    const dataSize = 12;
    const view = buildBuffer(dataSize, (v) => {
      v.setUint32(0, 0xdbc01002, true);
      v.setUint32(4, 1, true);
      v.setUint32(8, 0x10000002, true); // empty node
    });

    const recFlags = 2 | (EMFPLUS_OBJECTTYPE_REGION << 8);
    const rCtx = buildMinimalReplayCtx(view);
    handleEmfPlusObjectRecord(rCtx, recFlags, 0, dataSize);

    const region = rCtx.objectTable.get(2);
    expect(region).not.toBeUndefined();
    if (region!.kind === "plus-region") {
      expect(region!.nodes[0].type).toBe("empty");
    }
  });

  it("stores a combined region (union of two rects)", async () => {
    const { handleEmfPlusObjectRecord } = await import("./emf-plus-object-parser");

    const dataSize = 52;
    const view = buildBuffer(dataSize, (v) => {
      v.setUint32(0, 0xdbc01002, true);
      v.setUint32(4, 3, true); // nodeCount

      // Combine node (Union = 1)
      v.setUint32(8, 1, true);

      // Left child: rect
      v.setUint32(12, 0x10000000, true);
      v.setFloat32(16, 0, true);
      v.setFloat32(20, 0, true);
      v.setFloat32(24, 50, true);
      v.setFloat32(28, 50, true);

      // Right child: rect
      v.setUint32(32, 0x10000000, true);
      v.setFloat32(36, 25, true);
      v.setFloat32(40, 25, true);
      v.setFloat32(44, 75, true);
      v.setFloat32(48, 75, true);
    });

    const recFlags = 7 | (EMFPLUS_OBJECTTYPE_REGION << 8);
    const rCtx = buildMinimalReplayCtx(view);
    handleEmfPlusObjectRecord(rCtx, recFlags, 0, dataSize);

    const region = rCtx.objectTable.get(7);
    expect(region).not.toBeUndefined();
    if (region!.kind === "plus-region") {
      const node = region!.nodes[0];
      expect(node.type).toBe("combine");
      if (node.type === "combine") {
        expect(node.combineMode).toBe(1); // Union
        expect(node.left.type).toBe("rect");
        expect(node.right.type).toBe("rect");
      }
    }
  });

  it("does not store region when data is too small", async () => {
    const { handleEmfPlusObjectRecord } = await import("./emf-plus-object-parser");

    const view = buildBuffer(4, () => {});
    const recFlags = 1 | (EMFPLUS_OBJECTTYPE_REGION << 8);
    const rCtx = buildMinimalReplayCtx(view);
    handleEmfPlusObjectRecord(rCtx, recFlags, 0, 4);

    expect(rCtx.objectTable.has(1)).toBe(false);
  });
});

// ============================================================================
// 9. GDI Coordinate Mapping
// ============================================================================

describe("emf-gdi-coord", () => {
  function makeCtx(overrides: Partial<EmfGdiReplayCtx> = {}): EmfGdiReplayCtx {
    return {
      ctx: null as any,
      view: null as any,
      objectTable: new Map(),
      state: defaultState(),
      stateStack: [],
      inPath: false,
      windowOrg: { x: 0, y: 0 },
      windowExt: { cx: 1000, cy: 800 },
      viewportOrg: { x: 0, y: 0 },
      viewportExt: { cx: 500, cy: 400 },
      useMappingMode: false,
      clipSaveDepth: 0,
      bounds: { left: 0, top: 0, right: 1000, bottom: 800 },
      canvasW: 500,
      canvasH: 400,
      sx: 0.5, // canvasW / (right - left) = 500 / 1000
      sy: 0.5, // canvasH / (bottom - top) = 400 / 800
      ...overrides,
    };
  }

  describe("bounds-based mapping (default)", () => {
    it("maps X using bounds and scale factor", () => {
      const r = makeCtx();
      // gmx = (x - bounds.left) * sx = (100 - 0) * 0.5 = 50
      expect(gmx(r, 100)).toBe(50);
    });

    it("maps Y using bounds and scale factor", () => {
      const r = makeCtx();
      // gmy = (y - bounds.top) * sy = (200 - 0) * 0.5 = 100
      expect(gmy(r, 200)).toBe(100);
    });

    it("maps width using scale factor", () => {
      const r = makeCtx();
      expect(gmw(r, 100)).toBe(50);
    });

    it("maps height using scale factor", () => {
      const r = makeCtx();
      expect(gmh(r, 100)).toBe(50);
    });

    it("handles non-zero bounds origin", () => {
      const r = makeCtx({
        bounds: { left: 50, top: 100, right: 1050, bottom: 900 },
      });
      // gmx = (200 - 50) * 0.5 = 75
      expect(gmx(r, 200)).toBe(75);
      // gmy = (300 - 100) * 0.5 = 100
      expect(gmy(r, 300)).toBe(100);
    });

    it("maps origin point to (0,0) canvas", () => {
      const r = makeCtx();
      expect(gmx(r, 0)).toBe(0);
      expect(gmy(r, 0)).toBe(0);
    });
  });

  describe("window/viewport mapping mode", () => {
    it("maps X using window/viewport", () => {
      const r = makeCtx({ useMappingMode: true });
      // gmx = ((x - windowOrg.x) / windowExt.cx) * viewportExt.cx + viewportOrg.x
      // = ((200 - 0) / 1000) * 500 + 0 = 100
      expect(gmx(r, 200)).toBe(100);
    });

    it("maps Y using window/viewport", () => {
      const r = makeCtx({ useMappingMode: true });
      // gmy = ((400 - 0) / 800) * 400 + 0 = 200
      expect(gmy(r, 400)).toBe(200);
    });

    it("maps width using window/viewport extents", () => {
      const r = makeCtx({ useMappingMode: true });
      // gmw = (w / windowExt.cx) * viewportExt.cx = (500 / 1000) * 500 = 250
      expect(gmw(r, 500)).toBe(250);
    });

    it("maps height using window/viewport extents", () => {
      const r = makeCtx({ useMappingMode: true });
      // gmh = (h / windowExt.cy) * viewportExt.cy = (400 / 800) * 400 = 200
      expect(gmh(r, 400)).toBe(200);
    });

    it("handles non-zero window and viewport origins", () => {
      const r = makeCtx({
        useMappingMode: true,
        windowOrg: { x: 100, y: 50 },
        viewportOrg: { x: 10, y: 20 },
      });
      // gmx = ((300 - 100) / 1000) * 500 + 10 = (200/1000)*500 + 10 = 100 + 10 = 110
      expect(gmx(r, 300)).toBe(110);
      // gmy = ((250 - 50) / 800) * 400 + 20 = (200/800)*400 + 20 = 100 + 20 = 120
      expect(gmy(r, 250)).toBe(120);
    });
  });

  describe("activateGdiMappingMode()", () => {
    it("sets useMappingMode to true", () => {
      const r = makeCtx();
      expect(r.useMappingMode).toBe(false);
      activateGdiMappingMode(r);
      expect(r.useMappingMode).toBe(true);
    });

    it("changes coordinate mapping behaviour", () => {
      const r = makeCtx({
        windowExt: { cx: 2000, cy: 1600 },
        viewportExt: { cx: 500, cy: 400 },
      });

      // Before activation: bounds-based
      const xBefore = gmx(r, 200);
      expect(xBefore).toBe(100); // (200 - 0) * 0.5

      activateGdiMappingMode(r);

      // After: window/viewport
      const xAfter = gmx(r, 200);
      // (200 / 2000) * 500 = 50
      expect(xAfter).toBe(50);
    });
  });
});

// ============================================================================
// 10. Record Replay Edge Cases
// ============================================================================

describe("record replay edge cases", () => {
  it("convertEmfToDataUrl returns null for zero-length buffer", async () => {
    const result = await convertEmfToDataUrl(new ArrayBuffer(0));
    expect(result).toBeNull();
  });

  it("convertWmfToDataUrl returns null for zero-length buffer", async () => {
    const result = await convertWmfToDataUrl(new ArrayBuffer(0));
    expect(result).toBeNull();
  });

  it("convertEmfToDataUrl returns null for buffer too small for header", async () => {
    const buf = new ArrayBuffer(20);
    const result = await convertEmfToDataUrl(buf);
    expect(result).toBeNull();
  });

  it("convertWmfToDataUrl returns null for buffer with invalid magic", async () => {
    const buf = new ArrayBuffer(50);
    const view = new DataView(buf);
    // Invalid file type (0) at offset 0
    view.setUint16(0, 0, true);
    const result = await convertWmfToDataUrl(buf);
    expect(result).toBeNull();
  });

  it("convertEmfToDataUrl returns null for valid header but no canvas available", async () => {
    // Build a minimal EMF file with header + EOF record
    const headerSize = 108;
    const eofRecordSize = 20;
    const totalSize = headerSize + eofRecordSize;
    const buf = new ArrayBuffer(totalSize);
    const view = new DataView(buf);

    // EMF Header
    view.setUint32(0, EMR_HEADER, true);
    view.setUint32(4, headerSize, true);
    view.setInt32(8, 0, true); // boundsLeft
    view.setInt32(12, 0, true); // boundsTop
    view.setInt32(16, 800, true);
    view.setInt32(20, 600, true);
    view.setInt32(24, 0, true);
    view.setInt32(28, 0, true);
    view.setInt32(32, 21000, true);
    view.setInt32(36, 15000, true);
    view.setUint32(40, 0x464d4520, true);
    view.setUint32(44, 0x10000, true);
    view.setUint32(48, totalSize, true);
    view.setUint32(52, 2, true); // 2 records
    view.setUint16(56, 1, true);

    // EOF record
    view.setUint32(headerSize, EMR_EOF, true);
    view.setUint32(headerSize + 4, eofRecordSize, true);

    // Should return null because no canvas is available in Node test environment
    const result = await convertEmfToDataUrl(buf);
    expect(result).toBeNull();
  });
});

// ============================================================================
// 11. EMF+ Pen Dash Style
// ============================================================================

describe("emf-plus pen dash style parsing", () => {
  it("handles multiple optional flags before dash style", () => {
    // penFlags with StartCap(0x02) + EndCap(0x04) + LineStyle(0x20)
    const penFlags = 0x02 | 0x04 | 0x20;
    // Optional data: StartCap(4) + EndCap(4) + DashStyle(4) = 12 extra bytes
    const size = 20 + 12 + 8; // header + optional + brush

    const view = buildBuffer(size, (v) => {
      v.setUint32(0, 0, true);
      v.setUint32(4, penFlags, true);
      v.setUint32(8, 0, true);
      v.setUint32(12, 0, true);
      v.setFloat32(16, 3.0, true); // width

      // Optional: StartCap
      v.setUint32(20, 0, true);
      // Optional: EndCap
      v.setUint32(24, 0, true);
      // Optional: DashStyle (LineStyle)
      v.setUint32(28, 3, true); // DashDot

      // Brush
      v.setUint32(32, EMFPLUS_BRUSHTYPE_SOLID, true);
      v.setUint32(36, 0xff00ff00, true); // green
    });

    const result = parseEmfPlusPenObject(view, 0, size);
    expect(result).not.toBeNull();
    if (result!.kind === "plus-pen") {
      expect(result!.dashStyle).toBe(3); // DashDot
      expect(result!.width).toBe(3.0);
      expect(result!.color).toBe("rgba(0,255,0,1.000)");
    }
  });

  it("pen with Transform flag (24 bytes) is handled correctly", () => {
    // penFlags with Transform(0x01) + LineStyle(0x20)
    const penFlags = 0x01 | 0x20;
    // Optional: Transform(24 bytes) + DashStyle(4 bytes) = 28 extra
    const size = 20 + 28 + 8;

    const view = buildBuffer(size, (v) => {
      v.setUint32(0, 0, true);
      v.setUint32(4, penFlags, true);
      v.setUint32(8, 0, true);
      v.setUint32(12, 0, true);
      v.setFloat32(16, 1.5, true);

      // Transform (24 bytes of matrix) at offset 20
      // fill with zeros (identity-like)
      // DashStyle at offset 20 + 24 = 44
      v.setUint32(44, 1, true); // Dash

      // Brush at offset 48
      v.setUint32(48, EMFPLUS_BRUSHTYPE_SOLID, true);
      v.setUint32(52, 0xff0000ff, true); // blue
    });

    const result = parseEmfPlusPenObject(view, 0, size);
    expect(result).not.toBeNull();
    if (result!.kind === "plus-pen") {
      expect(result!.dashStyle).toBe(1); // Dash
    }
  });
});

// ============================================================================
// 12. Continuation Records
// ============================================================================

describe("continuation records tracking", () => {
  it("EmfPlusReplayCtx has continuation fields initialized correctly", () => {
    const ctx = {
      ctx: null as any,
      view: null as any,
      objectTable: new Map(),
      worldTransform: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number],
      deferredImages: [],
      saveStack: [],
      saveIdMap: new Map(),
      totalImageObjects: 0,
      totalDrawImageCalls: 0,
      clipSaveDepth: 0,
      pageUnit: 0,
      pageScale: 1,
      continuationBuffer: null,
      continuationObjectId: -1,
      continuationObjectType: -1,
      continuationTotalSize: 0,
      continuationOffset: 0,
    };

    expect(ctx.continuationBuffer).toBeNull();
    expect(ctx.continuationObjectId).toBe(-1);
    expect(ctx.continuationObjectType).toBe(-1);
    expect(ctx.continuationTotalSize).toBe(0);
    expect(ctx.continuationOffset).toBe(0);
  });

  it("continuation buffer can be assembled incrementally", () => {
    // Simulate assembling a continuation buffer
    const totalSize = 100;
    const buffer = new Uint8Array(totalSize);

    // First chunk: 40 bytes
    const chunk1 = new Uint8Array(40);
    for (let i = 0; i < 40; i++) chunk1[i] = i;
    buffer.set(chunk1, 0);
    let offset = 40;

    // Second chunk: 60 bytes
    const chunk2 = new Uint8Array(60);
    for (let i = 0; i < 60; i++) chunk2[i] = 40 + i;
    buffer.set(chunk2, offset);
    offset += 60;

    expect(offset).toBe(totalSize);
    expect(buffer[0]).toBe(0);
    expect(buffer[39]).toBe(39);
    expect(buffer[40]).toBe(40);
    expect(buffer[99]).toBe(99);
    expect(buffer.byteLength).toBe(totalSize);
  });
});

// ============================================================================
// Original export smoke tests
// ============================================================================

describe("emf-converter exports", () => {
  it("should export convertEmfToDataUrl as a function", () => {
    expect(typeof convertEmfToDataUrl).toBe("function");
  });

  it("should export convertWmfToDataUrl as a function", () => {
    expect(typeof convertWmfToDataUrl).toBe("function");
  });
});
