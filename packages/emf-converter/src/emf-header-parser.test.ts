import { describe, it, expect } from "vitest";
import {
  parseEmfHeader,
  getRenderableEmfBounds,
  parseWmfHeader,
} from "./emf-header-parser";
import { EMR_HEADER } from "./emf-constants";

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

/** Build a minimal valid EMF header (88+ bytes). */
function buildEmfHeader(opts: {
  boundsLeft?: number;
  boundsTop?: number;
  boundsRight?: number;
  boundsBottom?: number;
  frameLeft?: number;
  frameTop?: number;
  frameRight?: number;
  frameBottom?: number;
  recordType?: number;
} = {}): DataView {
  return buildBuffer(108, (v) => {
    v.setUint32(0, opts.recordType ?? EMR_HEADER, true);
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
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("emf-header-parser", () => {
  // -----------------------------------------------------------------------
  // parseEmfHeader
  // -----------------------------------------------------------------------
  describe("parseEmfHeader()", () => {
    it("parses a minimal valid header with default bounds and frame", () => {
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

    it("parses custom bounds and frame values", () => {
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
      expect(result!.frameW).toBe(5000); // 5100 - 100
      expect(result!.frameH).toBe(4000); // 4200 - 200
    });

    it("handles negative bounds (offset coordinates)", () => {
      const view = buildEmfHeader({
        boundsLeft: -100,
        boundsTop: -200,
        boundsRight: 700,
        boundsBottom: 400,
      });
      const result = parseEmfHeader(view);

      expect(result).not.toBeNull();
      expect(result!.bounds.left).toBe(-100);
      expect(result!.bounds.top).toBe(-200);
    });

    it("returns null for buffer smaller than 88 bytes", () => {
      const view = buildBuffer(60, () => {});
      expect(parseEmfHeader(view)).toBeNull();
    });

    it("returns null for empty buffer", () => {
      const view = new DataView(new ArrayBuffer(0));
      expect(parseEmfHeader(view)).toBeNull();
    });

    it("returns null when first record is not EMR_HEADER (type 1)", () => {
      const view = buildEmfHeader({ recordType: 99 });
      expect(parseEmfHeader(view)).toBeNull();
    });

    it("returns null when record type is 0", () => {
      const view = buildEmfHeader({ recordType: 0 });
      expect(parseEmfHeader(view)).toBeNull();
    });

    it("computes frame dimensions as (right - left) and (bottom - top)", () => {
      const view = buildEmfHeader({
        frameLeft: 500,
        frameTop: 300,
        frameRight: 2500,
        frameBottom: 1800,
      });
      const result = parseEmfHeader(view);
      expect(result).not.toBeNull();
      expect(result!.frameW).toBe(2000);
      expect(result!.frameH).toBe(1500);
    });
  });

  // -----------------------------------------------------------------------
  // getRenderableEmfBounds
  // -----------------------------------------------------------------------
  describe("getRenderableEmfBounds()", () => {
    it("returns bounds directly when they have positive dimensions", () => {
      const header = {
        bounds: { left: 0, top: 0, right: 800, bottom: 600 },
        frameW: 21000,
        frameH: 15000,
      };
      const result = getRenderableEmfBounds(header);
      expect(result).toEqual({ left: 0, top: 0, right: 800, bottom: 600 });
    });

    it("falls back to frame when bounds width is zero", () => {
      const header = {
        bounds: { left: 0, top: 0, right: 0, bottom: 0 },
        frameW: 500,
        frameH: 400,
      };
      const result = getRenderableEmfBounds(header);
      expect(result).toEqual({ left: 0, top: 0, right: 500, bottom: 400 });
    });

    it("falls back to frame when bounds dimensions are negative", () => {
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

    it("returns null when both bounds and frame are zero", () => {
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

    it("preserves non-zero bounds origin", () => {
      const header = {
        bounds: { left: 50, top: 100, right: 850, bottom: 700 },
        frameW: 21000,
        frameH: 15000,
      };
      const result = getRenderableEmfBounds(header);
      expect(result).toEqual({ left: 50, top: 100, right: 850, bottom: 700 });
    });
  });

  // -----------------------------------------------------------------------
  // parseWmfHeader
  // -----------------------------------------------------------------------
  describe("parseWmfHeader()", () => {
    function buildWmfHeader(opts: {
      boundsLeft?: number;
      boundsTop?: number;
      boundsRight?: number;
      boundsBottom?: number;
      unitsPerInch?: number;
      fileType?: number;
      maxRecordSizeWords?: number;
    } = {}): DataView {
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
        // Standard WMF header at offset 22
        v.setUint16(22, opts.fileType ?? 1, true);
        v.setUint16(24, 9, true); // headerSize in 16-bit words
        v.setUint16(26, 0x0300, true); // version
        v.setUint32(28, 20, true); // fileSize in words
        v.setUint32(30, opts.maxRecordSizeWords ?? 10, true);
      });
    }

    it("parses a valid WMF with Aldus placeable header", () => {
      const view = buildWmfHeader();
      const result = parseWmfHeader(view);

      expect(result).not.toBeNull();
      expect(result!.boundsLeft).toBe(0);
      expect(result!.boundsRight).toBe(800);
      expect(result!.boundsBottom).toBe(600);
      expect(result!.unitsPerInch).toBe(96);
      expect(result!.headerSize).toBe(40); // 22 + 9*2
      expect(result!.maxRecordSize).toBe(20); // 10 * 2
    });

    it("returns null for buffer too small", () => {
      const view = buildBuffer(10, () => {});
      expect(parseWmfHeader(view)).toBeNull();
    });

    it("returns null for invalid file type (0)", () => {
      const view = buildWmfHeader({ fileType: 0 });
      expect(parseWmfHeader(view)).toBeNull();
    });

    it("returns null for invalid file type (5)", () => {
      const view = buildWmfHeader({ fileType: 5 });
      expect(parseWmfHeader(view)).toBeNull();
    });

    it("accepts fileType 2 (disk-based)", () => {
      const view = buildWmfHeader({ fileType: 2 });
      const result = parseWmfHeader(view);
      expect(result).not.toBeNull();
    });

    it("defaults unitsPerInch to 96 when zero", () => {
      const view = buildWmfHeader({ unitsPerInch: 0 });
      const result = parseWmfHeader(view);
      expect(result).not.toBeNull();
      expect(result!.unitsPerInch).toBe(96);
    });

    it("handles WMF without Aldus header (standard header at offset 0)", () => {
      const view = buildBuffer(22, (v) => {
        v.setUint16(0, 1, true); // type
        v.setUint16(2, 9, true); // headerSize in 16-bit words
        v.setUint16(4, 0x0300, true); // version
        v.setUint32(6, 20, true); // fileSize in words
        v.setUint16(10, 0, true); // numObjects
        v.setUint32(12, 10, true); // maxRecordSize in words
      });
      const result = parseWmfHeader(view);
      expect(result).not.toBeNull();
      expect(result!.headerSize).toBe(18); // 0 + 9 * 2
      expect(result!.boundsRight).toBe(800); // default
      expect(result!.boundsBottom).toBe(600); // default
    });
  });
});
