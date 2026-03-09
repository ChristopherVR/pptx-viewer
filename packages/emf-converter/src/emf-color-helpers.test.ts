import { describe, it, expect } from "vitest";
import { colorRefToHex, readColorRef, argbToRgba } from "./emf-color-helpers";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("emf-color-helpers", () => {
  describe("colorRefToHex()", () => {
    it("converts pure red", () => {
      expect(colorRefToHex(255, 0, 0)).toBe("#ff0000");
    });

    it("converts pure green", () => {
      expect(colorRefToHex(0, 255, 0)).toBe("#00ff00");
    });

    it("converts pure blue", () => {
      expect(colorRefToHex(0, 0, 255)).toBe("#0000ff");
    });

    it("converts black (0,0,0)", () => {
      expect(colorRefToHex(0, 0, 0)).toBe("#000000");
    });

    it("converts white (255,255,255)", () => {
      expect(colorRefToHex(255, 255, 255)).toBe("#ffffff");
    });

    it("pads single-digit hex values with leading zero", () => {
      expect(colorRefToHex(1, 2, 3)).toBe("#010203");
      expect(colorRefToHex(0, 0, 15)).toBe("#00000f");
    });

    it("masks values to 0xFF (256 wraps to 0)", () => {
      expect(colorRefToHex(256, 0, 0)).toBe("#000000");
    });

    it("masks values to 0xFF (0x1ff keeps lower byte)", () => {
      expect(colorRefToHex(0x1ff, 0, 0)).toBe("#ff0000");
    });

    it("handles mid-range values", () => {
      expect(colorRefToHex(128, 64, 32)).toBe("#804020");
    });

    it("handles all channels at 0x80", () => {
      expect(colorRefToHex(0x80, 0x80, 0x80)).toBe("#808080");
    });
  });

  describe("readColorRef()", () => {
    it("reads RGB bytes from DataView at offset 0", () => {
      const view = buildBuffer(4, (v) => {
        v.setUint8(0, 0xaa);
        v.setUint8(1, 0xbb);
        v.setUint8(2, 0xcc);
      });
      expect(readColorRef(view, 0)).toBe("#aabbcc");
    });

    it("reads RGB bytes at a non-zero offset", () => {
      const view = buildBuffer(8, (v) => {
        v.setUint8(4, 0x10);
        v.setUint8(5, 0x20);
        v.setUint8(6, 0x30);
      });
      expect(readColorRef(view, 4)).toBe("#102030");
    });

    it("reads black from zeroed buffer", () => {
      const view = buildBuffer(4, () => {});
      expect(readColorRef(view, 0)).toBe("#000000");
    });

    it("reads white (0xFF in each channel)", () => {
      const view = buildBuffer(4, (v) => {
        v.setUint8(0, 0xff);
        v.setUint8(1, 0xff);
        v.setUint8(2, 0xff);
      });
      expect(readColorRef(view, 0)).toBe("#ffffff");
    });

    it("ignores the 4th byte (reserved byte in COLORREF)", () => {
      const view = buildBuffer(4, (v) => {
        v.setUint8(0, 0x11);
        v.setUint8(1, 0x22);
        v.setUint8(2, 0x33);
        v.setUint8(3, 0xff); // reserved/alpha byte
      });
      expect(readColorRef(view, 0)).toBe("#112233");
    });
  });

  describe("argbToRgba()", () => {
    it("converts fully opaque black", () => {
      expect(argbToRgba(0xff000000)).toBe("rgba(0,0,0,1.000)");
    });

    it("converts fully opaque white", () => {
      expect(argbToRgba(0xffffffff)).toBe("rgba(255,255,255,1.000)");
    });

    it("converts fully opaque red", () => {
      expect(argbToRgba(0xffff0000)).toBe("rgba(255,0,0,1.000)");
    });

    it("converts fully opaque green", () => {
      expect(argbToRgba(0xff00ff00)).toBe("rgba(0,255,0,1.000)");
    });

    it("converts fully opaque blue", () => {
      expect(argbToRgba(0xff0000ff)).toBe("rgba(0,0,255,1.000)");
    });

    it("converts fully transparent white", () => {
      expect(argbToRgba(0x00ffffff)).toBe("rgba(255,255,255,0.000)");
    });

    it("converts semi-transparent green (alpha=128)", () => {
      // 128/255 = 0.50196... rounded to 3 decimals = 0.502
      expect(argbToRgba(0x8000ff00)).toBe("rgba(0,255,0,0.502)");
    });

    it("converts arbitrary ARGB value", () => {
      // ARGB: A=200, R=100, G=150, B=50
      const argb = ((200 << 24) | (100 << 16) | (150 << 8) | 50) >>> 0;
      const expected = `rgba(100,150,50,${(200 / 255).toFixed(3)})`;
      expect(argbToRgba(argb)).toBe(expected);
    });

    it("handles alpha=1 (nearly transparent)", () => {
      const argb = ((1 << 24) | (255 << 16)) >>> 0;
      expect(argbToRgba(argb)).toBe(`rgba(255,0,0,${(1 / 255).toFixed(3)})`);
    });

    it("handles alpha=254 (nearly opaque)", () => {
      const argb = ((254 << 24) | (0 << 16) | (0 << 8) | 255) >>> 0;
      expect(argbToRgba(argb)).toBe(`rgba(0,0,255,${(254 / 255).toFixed(3)})`);
    });
  });
});
