import { describe, it, expect, beforeAll } from "vitest";
import { decodeRleBitmap } from "./emf-dib-rle-decoder";
import type { SetPixelFn } from "./emf-dib-rle-decoder";

// ---------------------------------------------------------------------------
// Polyfill ImageData for Node.js (not available outside browsers)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ImageData === "undefined") {
    (globalThis as any).ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray, width: number, height?: number) {
        this.data = data;
        this.width = width;
        this.height = height ?? (data.length / 4 / width);
      }
    };
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBuffer(bytes: number[]): DataView {
  const buf = new ArrayBuffer(bytes.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) u8[i] = bytes[i];
  return new DataView(buf);
}

function makeOutput(width: number, height: number) {
  const out = new Uint8ClampedArray(width * height * 4);
  const pixels: Array<{ x: number; y: number; r: number; g: number; b: number; a: number }> = [];
  const setPixel: SetPixelFn = (x, y, r, g, b, a) => {
    pixels.push({ x, y, r, g, b, a });
    const idx = (y * width + x) * 4;
    out[idx] = r;
    out[idx + 1] = g;
    out[idx + 2] = b;
    out[idx + 3] = a;
  };
  return { out, pixels, setPixel };
}

// Basic color table: index 0=red, 1=green, 2=blue
const colorTable: Array<[number, number, number]> = [
  [255, 0, 0],     // 0 = red
  [0, 255, 0],     // 1 = green
  [0, 0, 255],     // 2 = blue
  [255, 255, 0],   // 3 = yellow
];

// ---------------------------------------------------------------------------
// RLE8 tests
// ---------------------------------------------------------------------------

describe("decodeRleBitmap - RLE8", () => {
  it("decodes a simple RLE8 run of one color", () => {
    // RLE8: run of 4 pixels of color index 0 (red), then end-of-bitmap
    const bytes = [
      4, 0,   // 4 pixels of color index 0
      0, 1,   // end of bitmap
    ];
    const view = buildBuffer(bytes);
    const { out, pixels, setPixel } = makeOutput(4, 1);

    decodeRleBitmap(view, 0, bytes.length, 4, 1, false, false, colorTable, out, setPixel);

    expect(pixels).toHaveLength(4);
    for (const p of pixels) {
      expect(p.r).toBe(255);
      expect(p.g).toBe(0);
      expect(p.b).toBe(0);
    }
  });

  it("decodes RLE8 with end-of-line marker advancing to next row", () => {
    // 2-pixel wide, 2-row high
    // Row 0 (bottom): 2 red pixels, end-of-line
    // Row 1 (top): 2 green pixels, end-of-bitmap
    const bytes = [
      2, 0,   // 2 pixels of red (index 0)
      0, 0,   // end of line
      2, 1,   // 2 pixels of green (index 1)
      0, 1,   // end of bitmap
    ];
    const view = buildBuffer(bytes);
    const { out, pixels, setPixel } = makeOutput(2, 2);

    decodeRleBitmap(view, 0, bytes.length, 2, 2, false, false, colorTable, out, setPixel);

    // We expect 4 pixels total
    expect(pixels).toHaveLength(4);
  });

  it("decodes RLE8 absolute mode (uncompressed run)", () => {
    // Absolute mode: 0, count, then literal indices, padded to even
    // 3 literal pixels: indices 0, 1, 2, then padding byte
    const bytes = [
      0, 3,    // absolute run of 3 pixels
      0, 1, 2, // pixel indices
      0,       // padding to even boundary
      0, 1,    // end of bitmap
    ];
    const view = buildBuffer(bytes);
    const { out, pixels, setPixel } = makeOutput(3, 1);

    decodeRleBitmap(view, 0, bytes.length, 3, 1, false, false, colorTable, out, setPixel);

    expect(pixels).toHaveLength(3);
    expect(pixels[0].r).toBe(255); // red
    expect(pixels[1].g).toBe(255); // green
    expect(pixels[2].b).toBe(255); // blue
  });

  it("handles delta escape (cursor move)", () => {
    // Delta: 0, 2, dx, dy
    const bytes = [
      0, 2,    // delta escape
      2, 0,    // move right 2 pixels, 0 rows
      1, 1,    // 1 pixel of green (index 1)
      0, 1,    // end of bitmap
    ];
    const view = buildBuffer(bytes);
    const { out, pixels, setPixel } = makeOutput(4, 1);

    decodeRleBitmap(view, 0, bytes.length, 4, 1, false, false, colorTable, out, setPixel);

    // After delta, x=2, so the pixel is placed at x=2
    expect(pixels).toHaveLength(1);
    expect(pixels[0].x).toBe(2);
  });

  it("stops at end-of-bitmap marker", () => {
    const bytes = [
      2, 0,   // 2 red pixels
      0, 1,   // end of bitmap
      2, 1,   // these should be ignored
    ];
    const view = buildBuffer(bytes);
    const { out, pixels, setPixel } = makeOutput(4, 1);

    decodeRleBitmap(view, 0, bytes.length, 4, 1, false, false, colorTable, out, setPixel);

    expect(pixels).toHaveLength(2);
  });

  it("returns ImageData with correct dimensions", () => {
    const bytes = [0, 1]; // end of bitmap
    const view = buildBuffer(bytes);
    const { out, setPixel } = makeOutput(8, 4);

    const imageData = decodeRleBitmap(view, 0, bytes.length, 8, 4, false, false, colorTable, out, setPixel);

    expect(imageData.width).toBe(8);
    expect(imageData.height).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// RLE4 tests
// ---------------------------------------------------------------------------

describe("decodeRleBitmap - RLE4", () => {
  it("decodes an RLE4 encoded run alternating two colors", () => {
    // RLE4: run of 4 pixels, alternating between high nibble (index 0) and low nibble (index 1)
    // Byte value 0x01: high nibble=0 (red), low nibble=1 (green)
    const bytes = [
      4, 0x01,  // 4 pixels: red, green, red, green
      0, 1,     // end of bitmap
    ];
    const view = buildBuffer(bytes);
    const { out, pixels, setPixel } = makeOutput(4, 1);

    decodeRleBitmap(view, 0, bytes.length, 4, 1, false, true, colorTable, out, setPixel);

    expect(pixels).toHaveLength(4);
    expect(pixels[0].r).toBe(255); // red
    expect(pixels[1].g).toBe(255); // green
    expect(pixels[2].r).toBe(255); // red
    expect(pixels[3].g).toBe(255); // green
  });

  it("decodes RLE4 absolute mode", () => {
    // Absolute mode in RLE4: 0, count, then nibble-packed data
    // 4 pixels: indices packed as two bytes
    const bytes = [
      0, 4,    // absolute run of 4 pixels
      0x01,    // high=0 (red), low=1 (green)
      0x23,    // high=2 (blue), low=3 (yellow)
      0,       // padding
      0, 1,    // end of bitmap
    ];
    const view = buildBuffer(bytes);
    const { out, pixels, setPixel } = makeOutput(4, 1);

    decodeRleBitmap(view, 0, bytes.length, 4, 1, false, true, colorTable, out, setPixel);

    expect(pixels).toHaveLength(4);
    expect(pixels[0].r).toBe(255); // index 0 = red
    expect(pixels[1].g).toBe(255); // index 1 = green
    expect(pixels[2].b).toBe(255); // index 2 = blue
  });

  it("handles RLE4 end-of-bitmap correctly", () => {
    const bytes = [
      2, 0x00,  // 2 red pixels
      0, 1,     // end of bitmap
    ];
    const view = buildBuffer(bytes);
    const { out, pixels, setPixel } = makeOutput(4, 1);

    decodeRleBitmap(view, 0, bytes.length, 4, 1, false, true, colorTable, out, setPixel);

    expect(pixels).toHaveLength(2);
    expect(pixels[0].r).toBe(255);
    expect(pixels[1].r).toBe(255);
  });
});
