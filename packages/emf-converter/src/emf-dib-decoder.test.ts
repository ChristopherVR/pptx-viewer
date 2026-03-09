import { describe, it, expect } from "vitest";
import {
  countTrailingZeros,
  parseBitfieldMasks,
  decodeUncompressedRows,
} from "./emf-dib-uncompressed";
import type { BitfieldMasks } from "./emf-dib-uncompressed";

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

/** Default identity masks (used for non-bitfield modes). */
function identityMasks(): BitfieldMasks {
  return {
    rMask: 0,
    gMask: 0,
    bMask: 0,
    rShift: 0,
    gShift: 0,
    bShift: 0,
    rMax: 1,
    gMax: 1,
    bMax: 1,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("emf-dib-uncompressed", () => {
  // -----------------------------------------------------------------------
  // countTrailingZeros
  // -----------------------------------------------------------------------
  describe("countTrailingZeros()", () => {
    it("returns 0 for zero", () => {
      expect(countTrailingZeros(0)).toBe(0);
    });

    it("returns 0 for odd numbers", () => {
      expect(countTrailingZeros(1)).toBe(0);
      expect(countTrailingZeros(3)).toBe(0);
      expect(countTrailingZeros(0xff)).toBe(0);
    });

    it("returns correct count for powers of two", () => {
      expect(countTrailingZeros(2)).toBe(1);
      expect(countTrailingZeros(4)).toBe(2);
      expect(countTrailingZeros(8)).toBe(3);
      expect(countTrailingZeros(16)).toBe(4);
      expect(countTrailingZeros(256)).toBe(8);
    });

    it("returns correct count for standard mask values", () => {
      // RGB565 masks
      expect(countTrailingZeros(0xf800)).toBe(11); // red mask
      expect(countTrailingZeros(0x07e0)).toBe(5); // green mask
      expect(countTrailingZeros(0x001f)).toBe(0); // blue mask
    });

    it("returns correct count for RGB555 masks", () => {
      expect(countTrailingZeros(0x7c00)).toBe(10); // red
      expect(countTrailingZeros(0x03e0)).toBe(5); // green
      expect(countTrailingZeros(0x001f)).toBe(0); // blue
    });
  });

  // -----------------------------------------------------------------------
  // parseBitfieldMasks
  // -----------------------------------------------------------------------
  describe("parseBitfieldMasks()", () => {
    it("returns zero masks for BI_RGB with 24bpp", () => {
      // No bitfield data needed for BI_RGB
      const view = buildBuffer(60, () => {});
      const masks = parseBitfieldMasks(view, 0, 40, 0, 24);
      expect(masks).not.toBeNull();
      expect(masks!.rMask).toBe(0);
      expect(masks!.gMask).toBe(0);
      expect(masks!.bMask).toBe(0);
    });

    it("returns default RGB555 masks for BI_RGB with 16bpp", () => {
      const view = buildBuffer(60, () => {});
      const masks = parseBitfieldMasks(view, 0, 40, 0, 16);
      expect(masks).not.toBeNull();
      expect(masks!.rMask).toBe(0x7c00);
      expect(masks!.gMask).toBe(0x03e0);
      expect(masks!.bMask).toBe(0x001f);
      expect(masks!.rShift).toBe(10);
      expect(masks!.gShift).toBe(5);
      expect(masks!.bShift).toBe(0);
      expect(masks!.rMax).toBe(31);
      expect(masks!.gMax).toBe(31);
      expect(masks!.bMax).toBe(31);
    });

    it("reads custom bitfield masks for BI_BITFIELDS (compression=3)", () => {
      const BI_BITFIELDS = 3;
      // Build a buffer with BITMAPINFOHEADER (40 bytes) + 12 bytes of masks
      const view = buildBuffer(60, (v) => {
        // Bitfield masks come right after the header
        v.setUint32(40, 0x00ff0000, true); // rMask
        v.setUint32(44, 0x0000ff00, true); // gMask
        v.setUint32(48, 0x000000ff, true); // bMask
      });
      const masks = parseBitfieldMasks(view, 0, 40, BI_BITFIELDS, 32);
      expect(masks).not.toBeNull();
      expect(masks!.rMask).toBe(0x00ff0000);
      expect(masks!.gMask).toBe(0x0000ff00);
      expect(masks!.bMask).toBe(0x000000ff);
      expect(masks!.rShift).toBe(16);
      expect(masks!.gShift).toBe(8);
      expect(masks!.bShift).toBe(0);
    });

    it("returns null when bitfield data extends beyond view", () => {
      const BI_BITFIELDS = 3;
      // Buffer too small for masks after header
      const view = buildBuffer(44, () => {});
      const masks = parseBitfieldMasks(view, 0, 40, BI_BITFIELDS, 32);
      expect(masks).toBeNull();
    });

    it("handles non-zero bmiOffset", () => {
      const BI_BITFIELDS = 3;
      const bmiOffset = 20;
      const headerSize = 40;
      const view = buildBuffer(80, (v) => {
        v.setUint32(bmiOffset + headerSize, 0xf800, true); // rMask (RGB565)
        v.setUint32(bmiOffset + headerSize + 4, 0x07e0, true); // gMask
        v.setUint32(bmiOffset + headerSize + 8, 0x001f, true); // bMask
      });
      const masks = parseBitfieldMasks(view, bmiOffset, headerSize, BI_BITFIELDS, 16);
      expect(masks).not.toBeNull();
      expect(masks!.rMask).toBe(0xf800);
      expect(masks!.rShift).toBe(11);
    });
  });

  // -----------------------------------------------------------------------
  // decodeUncompressedRows — 24 bpp
  // -----------------------------------------------------------------------
  describe("decodeUncompressedRows() — 24 bpp", () => {
    it("decodes a 1x1 bottom-up 24bpp pixel (BGR -> RGBA)", () => {
      // 24bpp row stride: ceil((24*1+31)/32)*4 = 4 bytes
      const view = buildBuffer(4, (v) => {
        v.setUint8(0, 0xff); // B
        v.setUint8(1, 0x80); // G
        v.setUint8(2, 0x40); // R
      });
      const out = new Uint8ClampedArray(4);
      decodeUncompressedRows(view, 0, 1, 1, false, 24, [], identityMasks(), out);
      // Output should be RGBA: R=0x40, G=0x80, B=0xff, A=255
      expect(out[0]).toBe(0x40);
      expect(out[1]).toBe(0x80);
      expect(out[2]).toBe(0xff);
      expect(out[3]).toBe(255);
    });

    it("decodes a 2x1 bottom-up 24bpp row", () => {
      // 24bpp 2px: 6 bytes of pixel data, row stride = ceil((24*2+31)/32)*4 = 8
      const view = buildBuffer(8, (v) => {
        // Pixel 0: B=0, G=0, R=0xff (red)
        v.setUint8(0, 0x00);
        v.setUint8(1, 0x00);
        v.setUint8(2, 0xff);
        // Pixel 1: B=0xff, G=0, R=0 (blue)
        v.setUint8(3, 0xff);
        v.setUint8(4, 0x00);
        v.setUint8(5, 0x00);
      });
      const out = new Uint8ClampedArray(2 * 1 * 4);
      decodeUncompressedRows(view, 0, 2, 1, false, 24, [], identityMasks(), out);
      // Pixel 0: RGBA(255, 0, 0, 255)
      expect(out[0]).toBe(0xff);
      expect(out[1]).toBe(0x00);
      expect(out[2]).toBe(0x00);
      expect(out[3]).toBe(255);
      // Pixel 1: RGBA(0, 0, 255, 255)
      expect(out[4]).toBe(0x00);
      expect(out[5]).toBe(0x00);
      expect(out[6]).toBe(0xff);
      expect(out[7]).toBe(255);
    });

    it("decodes a 1x2 bottom-up 24bpp image (row order flip)", () => {
      // Row stride for 1px wide 24bpp: 4 bytes
      // Bottom-up: row 0 in file = bottom row
      const view = buildBuffer(8, (v) => {
        // File row 0 (bottom of image): B=0, G=0xff, R=0
        v.setUint8(0, 0x00);
        v.setUint8(1, 0xff);
        v.setUint8(2, 0x00);
        // File row 1 (top of image): B=0, G=0, R=0xff
        v.setUint8(4, 0x00);
        v.setUint8(5, 0x00);
        v.setUint8(6, 0xff);
      });
      const out = new Uint8ClampedArray(1 * 2 * 4);
      decodeUncompressedRows(view, 0, 1, 2, false, 24, [], identityMasks(), out);
      // Output row 0 (top): should be file row 1 => R=0xff, G=0, B=0
      expect(out[0]).toBe(0xff);
      expect(out[1]).toBe(0x00);
      expect(out[2]).toBe(0x00);
      // Output row 1 (bottom): should be file row 0 => R=0, G=0xff, B=0
      expect(out[4]).toBe(0x00);
      expect(out[5]).toBe(0xff);
      expect(out[6]).toBe(0x00);
    });
  });

  // -----------------------------------------------------------------------
  // decodeUncompressedRows — 32 bpp
  // -----------------------------------------------------------------------
  describe("decodeUncompressedRows() — 32 bpp", () => {
    it("decodes a 1x1 32bpp pixel (BGRA -> RGBA, alpha=0 becomes 255)", () => {
      const view = buildBuffer(4, (v) => {
        v.setUint8(0, 0x11); // B
        v.setUint8(1, 0x22); // G
        v.setUint8(2, 0x33); // R
        v.setUint8(3, 0x00); // A (0 => treated as 255)
      });
      const out = new Uint8ClampedArray(4);
      decodeUncompressedRows(view, 0, 1, 1, false, 32, [], identityMasks(), out);
      expect(out[0]).toBe(0x33); // R
      expect(out[1]).toBe(0x22); // G
      expect(out[2]).toBe(0x11); // B
      expect(out[3]).toBe(255); // A: 0 => 255
    });

    it("preserves non-zero alpha in 32bpp", () => {
      const view = buildBuffer(4, (v) => {
        v.setUint8(0, 0x00); // B
        v.setUint8(1, 0x00); // G
        v.setUint8(2, 0xff); // R
        v.setUint8(3, 0x80); // A = 128
      });
      const out = new Uint8ClampedArray(4);
      decodeUncompressedRows(view, 0, 1, 1, false, 32, [], identityMasks(), out);
      expect(out[0]).toBe(0xff);
      expect(out[3]).toBe(0x80);
    });
  });

  // -----------------------------------------------------------------------
  // decodeUncompressedRows — 8 bpp (indexed)
  // -----------------------------------------------------------------------
  describe("decodeUncompressedRows() — 8 bpp (indexed)", () => {
    it("maps index to colour table", () => {
      // 1x1 8bpp, row stride = 4
      const colorTable: Array<[number, number, number]> = [
        [0, 0, 0], // index 0: black
        [255, 0, 0], // index 1: red
        [0, 255, 0], // index 2: green
      ];
      const view = buildBuffer(4, (v) => {
        v.setUint8(0, 2); // index 2 => green
      });
      const out = new Uint8ClampedArray(4);
      decodeUncompressedRows(view, 0, 1, 1, false, 8, colorTable, identityMasks(), out);
      expect(out[0]).toBe(0); // R
      expect(out[1]).toBe(255); // G
      expect(out[2]).toBe(0); // B
      expect(out[3]).toBe(255); // A
    });
  });

  // -----------------------------------------------------------------------
  // decodeUncompressedRows — 1 bpp (monochrome)
  // -----------------------------------------------------------------------
  describe("decodeUncompressedRows() — 1 bpp (monochrome)", () => {
    it("decodes a 1-bit-per-pixel image using colour table", () => {
      const colorTable: Array<[number, number, number]> = [
        [0, 0, 0], // bit 0: black
        [255, 255, 255], // bit 1: white
      ];
      // 8px wide 1bpp => 1 byte of pixel data, row stride = 4
      const view = buildBuffer(4, (v) => {
        v.setUint8(0, 0b10101010); // alternating black and white
      });
      const out = new Uint8ClampedArray(8 * 1 * 4);
      decodeUncompressedRows(view, 0, 8, 1, false, 1, colorTable, identityMasks(), out);
      // Pixel 0 (bit 7 = 1) => white
      expect(out[0]).toBe(255);
      expect(out[1]).toBe(255);
      expect(out[2]).toBe(255);
      // Pixel 1 (bit 6 = 0) => black
      expect(out[4]).toBe(0);
      expect(out[5]).toBe(0);
      expect(out[6]).toBe(0);
      // Pixel 2 (bit 5 = 1) => white
      expect(out[8]).toBe(255);
    });
  });

  // -----------------------------------------------------------------------
  // decodeUncompressedRows — top-down
  // -----------------------------------------------------------------------
  describe("decodeUncompressedRows() — top-down", () => {
    it("preserves row order for top-down image", () => {
      const view = buildBuffer(8, (v) => {
        // Row 0: B=0xff, G=0, R=0 => blue
        v.setUint8(0, 0xff);
        v.setUint8(1, 0x00);
        v.setUint8(2, 0x00);
        // Row 1: B=0, G=0xff, R=0 => green
        v.setUint8(4, 0x00);
        v.setUint8(5, 0xff);
        v.setUint8(6, 0x00);
      });
      const out = new Uint8ClampedArray(1 * 2 * 4);
      decodeUncompressedRows(view, 0, 1, 2, true, 24, [], identityMasks(), out);
      // Row 0 stays as row 0
      expect(out[0]).toBe(0x00); // R
      expect(out[1]).toBe(0x00); // G
      expect(out[2]).toBe(0xff); // B
      // Row 1 stays as row 1
      expect(out[4]).toBe(0x00); // R
      expect(out[5]).toBe(0xff); // G
      expect(out[6]).toBe(0x00); // B
    });
  });
});
