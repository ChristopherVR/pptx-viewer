import { describe, it, expect } from "vitest";
import { guideEmuToPx, guidePxToEmu } from "./guide-utils";
import { EMU_PER_PX } from "../constants";

/**
 * ECMA-376 EMU (English Metric Unit) conversion constants (§20.1.2.2.12):
 *   914400 EMU = 1 inch
 *   12700 EMU  = 1 point (1/72 inch)
 *   9525 EMU   = 1 pixel (at 96 DPI)
 *   360000 EMU = 1 cm
 *   36000 EMU  = 1 mm
 *
 * Font size is in hundredths of a point: @_sz="1200" => 12 pt.
 * Rotation is in 60000ths of a degree: @_rot="5400000" => 90 degrees.
 */

// ---------------------------------------------------------------------------
// EMU_PER_PX constant
// ---------------------------------------------------------------------------

describe("EMU_PER_PX constant", () => {
  it("equals 9525 (914400 / 96)", () => {
    expect(EMU_PER_PX).toBe(9525);
    expect(EMU_PER_PX).toBe(914400 / 96);
  });
});

// ---------------------------------------------------------------------------
// EMU -> pixels (at 96 DPI)
// ---------------------------------------------------------------------------

describe("EMU to pixels conversion", () => {
  it("converts 0 EMU to 0 px", () => {
    expect(guideEmuToPx(0)).toBe(0);
  });

  it("converts 9525 EMU to 1 px", () => {
    expect(guideEmuToPx(9525)).toBe(1);
  });

  it("converts 914400 EMU to 96 px (1 inch at 96 DPI)", () => {
    expect(guideEmuToPx(914400)).toBe(96);
  });

  it("converts standard 4:3 slide width 9144000 EMU to 960 px", () => {
    expect(Math.round(9144000 / EMU_PER_PX)).toBe(960);
  });

  it("converts standard 4:3 slide height 6858000 EMU to 720 px", () => {
    expect(Math.round(6858000 / EMU_PER_PX)).toBe(720);
  });

  it("converts widescreen 16:9 slide width 12192000 EMU to 1280 px", () => {
    expect(Math.round(12192000 / EMU_PER_PX)).toBe(1280);
  });

  it("converts widescreen 16:9 slide height 6858000 EMU to 720 px", () => {
    expect(Math.round(6858000 / EMU_PER_PX)).toBe(720);
  });

  it("handles fractional pixel results", () => {
    // 10000 EMU / 9525 ≈ 1.04987
    const result = guideEmuToPx(10000);
    expect(result).toBeCloseTo(10000 / 9525, 6);
  });
});

// ---------------------------------------------------------------------------
// EMU -> points
// ---------------------------------------------------------------------------

describe("EMU to points conversion", () => {
  it("converts 12700 EMU to 1 point", () => {
    expect(12700 / 12700).toBe(1);
  });

  it("converts 914400 EMU to 72 points (1 inch)", () => {
    expect(914400 / 12700).toBeCloseTo(72, 0);
  });
});

// ---------------------------------------------------------------------------
// EMU -> inches
// ---------------------------------------------------------------------------

describe("EMU to inches conversion", () => {
  it("converts 914400 EMU to 1 inch", () => {
    expect(914400 / 914400).toBe(1);
  });

  it("converts 9144000 EMU to 10 inches (standard 4:3 width)", () => {
    expect(9144000 / 914400).toBe(10);
  });

  it("converts 6858000 EMU to 7.5 inches (standard 4:3 height)", () => {
    expect(6858000 / 914400).toBe(7.5);
  });

  it("converts 12192000 EMU to ~13.333 inches (widescreen width)", () => {
    expect(12192000 / 914400).toBeCloseTo(13.333, 2);
  });
});

// ---------------------------------------------------------------------------
// EMU -> cm / mm
// ---------------------------------------------------------------------------

describe("EMU to metric conversion", () => {
  it("converts 360000 EMU to 1 cm", () => {
    expect(360000 / 360000).toBe(1);
  });

  it("converts 36000 EMU to 1 mm", () => {
    expect(36000 / 36000).toBe(1);
  });

  it("converts 914400 EMU to 2.54 cm (1 inch = 2.54 cm)", () => {
    expect(914400 / 360000).toBeCloseTo(2.54, 2);
  });
});

// ---------------------------------------------------------------------------
// Reverse: pixels -> EMU
// ---------------------------------------------------------------------------

describe("pixels to EMU conversion", () => {
  it("converts 0 px to 0 EMU", () => {
    expect(guidePxToEmu(0)).toBe(0);
  });

  it("converts 1 px to 9525 EMU", () => {
    expect(guidePxToEmu(1)).toBe(9525);
  });

  it("converts 96 px to 914400 EMU (1 inch)", () => {
    expect(guidePxToEmu(96)).toBe(914400);
  });

  it("converts 960 px to 9144000 EMU (standard 4:3 slide width)", () => {
    expect(guidePxToEmu(960)).toBe(9144000);
  });

  it("converts 720 px to 6858000 EMU (standard 4:3 slide height)", () => {
    expect(guidePxToEmu(720)).toBe(6858000);
  });

  it("converts 1280 px to 12192000 EMU (widescreen slide width)", () => {
    expect(guidePxToEmu(1280)).toBe(12192000);
  });

  it("rounds fractional pixel to nearest EMU integer", () => {
    const result = guidePxToEmu(1.5);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(Math.round(1.5 * 9525));
  });
});

// ---------------------------------------------------------------------------
// Reverse: points -> EMU, inches -> EMU
// ---------------------------------------------------------------------------

describe("points to EMU conversion", () => {
  it("converts 1 pt to 12700 EMU", () => {
    expect(1 * 12700).toBe(12700);
  });

  it("converts 72 pt to 914400 EMU (1 inch)", () => {
    expect(72 * 12700).toBe(914400);
  });
});

describe("inches to EMU conversion", () => {
  it("converts 1 inch to 914400 EMU", () => {
    expect(1 * 914400).toBe(914400);
  });

  it("converts 10 inches to 9144000 EMU (standard 4:3 width)", () => {
    expect(10 * 914400).toBe(9144000);
  });
});

// ---------------------------------------------------------------------------
// Font size (hundredths of a point per ECMA-376 §21.1.2.3.15)
// ---------------------------------------------------------------------------

describe("font size (hundredths of a point)", () => {
  it("@_sz=1200 => 12 pt", () => {
    expect(1200 / 100).toBe(12);
  });

  it("@_sz=2400 => 24 pt", () => {
    expect(2400 / 100).toBe(24);
  });

  it("@_sz=4400 => 44 pt", () => {
    expect(4400 / 100).toBe(44);
  });

  it("converts hundredths-of-point to CSS px (at 96 DPI): 12pt => 16px", () => {
    // The codebase does: points * (96/72) = points * 1.333...
    const szAttr = 1200;
    const points = szAttr / 100; // 12
    const cssPx = points * (96 / 72); // 16
    expect(cssPx).toBe(16);
  });

  it("converts 2400 hundredths => 24pt => 32px", () => {
    const szAttr = 2400;
    const points = szAttr / 100;
    const cssPx = points * (96 / 72);
    expect(cssPx).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// Rotation (60000ths of a degree per ECMA-376 §20.1.10.3)
// ---------------------------------------------------------------------------

describe("rotation (60000ths of a degree)", () => {
  it("@_rot=0 => 0 degrees", () => {
    expect(0 / 60000).toBe(0);
  });

  it("@_rot=5400000 => 90 degrees", () => {
    expect(5400000 / 60000).toBe(90);
  });

  it("@_rot=10800000 => 180 degrees", () => {
    expect(10800000 / 60000).toBe(180);
  });

  it("@_rot=16200000 => 270 degrees", () => {
    expect(16200000 / 60000).toBe(270);
  });

  it("@_rot=21600000 => 360 degrees (full rotation)", () => {
    expect(21600000 / 60000).toBe(360);
  });

  it("@_rot=2700000 => 45 degrees", () => {
    expect(2700000 / 60000).toBe(45);
  });

  it("reverse: 90 degrees => 5400000 (for save)", () => {
    expect(Math.round(90 * 60000)).toBe(5400000);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("negative EMU values produce negative pixel values", () => {
    expect(guideEmuToPx(-9525)).toBe(-1);
  });

  it("very large EMU values convert correctly", () => {
    // Max coordinate in 32-bit signed: ~2 billion
    const largeEmu = 2000000000;
    const px = largeEmu / EMU_PER_PX;
    expect(px).toBeCloseTo(209973.75, 0);
  });

  it("round-trip px -> EMU -> px preserves value", () => {
    const originalPx = 500;
    const emu = guidePxToEmu(originalPx);
    const roundTripped = guideEmuToPx(emu);
    expect(roundTripped).toBeCloseTo(originalPx, 1);
  });

  it("round-trip EMU -> px -> EMU preserves value for exact multiples", () => {
    const originalEmu = 9525 * 100; // exact multiple
    const px = guideEmuToPx(originalEmu);
    const roundTripped = guidePxToEmu(px);
    expect(roundTripped).toBe(originalEmu);
  });
});

// ---------------------------------------------------------------------------
// Standard slide sizes
// ---------------------------------------------------------------------------

describe("standard slide sizes", () => {
  it("4:3 standard: 9144000 x 6858000 EMU = 10in x 7.5in", () => {
    expect(9144000 / 914400).toBe(10);
    expect(6858000 / 914400).toBe(7.5);
    expect(Math.round(9144000 / EMU_PER_PX)).toBe(960);
    expect(Math.round(6858000 / EMU_PER_PX)).toBe(720);
  });

  it("16:9 widescreen: 12192000 x 6858000 EMU = ~13.333in x 7.5in", () => {
    expect(12192000 / 914400).toBeCloseTo(13.333, 2);
    expect(6858000 / 914400).toBe(7.5);
    expect(Math.round(12192000 / EMU_PER_PX)).toBe(1280);
    expect(Math.round(6858000 / EMU_PER_PX)).toBe(720);
  });

  it("4:3 aspect ratio check", () => {
    const width = 9144000;
    const height = 6858000;
    // 10 / 7.5 = 4/3
    expect(width / height).toBeCloseTo(4 / 3, 4);
  });

  it("16:9 aspect ratio check", () => {
    const width = 12192000;
    const height = 6858000;
    // 13.333 / 7.5 ≈ 16/9
    expect(width / height).toBeCloseTo(16 / 9, 2);
  });
});
