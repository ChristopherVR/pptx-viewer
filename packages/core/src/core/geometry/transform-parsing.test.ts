import { describe, it, expect } from "vitest";
import {
  getElementTransform,
  getTextCompensationTransform,
} from "./transform-utils";
import { PptxElementTransformUpdater } from "../core/builders/PptxElementTransformUpdater";
import type { PptxElement, XmlObject } from "../types";

/**
 * Tests for OpenXML xfrm (transform) parsing and serialization.
 *
 * Per ECMA-376 §20.1.7.6 (xfrm), the transform element carries:
 *   - a:off  x, y    — offset in EMU
 *   - a:ext  cx, cy  — extent (width/height) in EMU
 *   - @_rot           — rotation in 60000ths of a degree
 *   - @_flipH         — horizontal flip ("0"/"1" or "false"/"true")
 *   - @_flipV         — vertical flip ("0"/"1" or "false"/"true")
 *
 * Group transforms (p:grpSpPr > a:xfrm) additionally have:
 *   - a:chOff  x, y  — child coordinate space offset
 *   - a:chExt  cx, cy — child coordinate space extent
 *
 * EMU_PER_PX = 9525
 */

const EMU_PER_PX = 9525;

// Helper: create a minimal PptxElement for testing transform-utils
function makePptxElement(
  overrides: Partial<PptxElement> = {},
): PptxElement {
  return {
    id: "test-1",
    type: "shape",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...overrides,
  } as PptxElement;
}

// ---------------------------------------------------------------------------
// Basic offset + extent parsing (x, y, cx, cy in EMU)
// ---------------------------------------------------------------------------

describe("xfrm offset + extent parsing (EMU to px)", () => {
  it("converts basic offset and extent from EMU to pixels", () => {
    // Simulating what the runtime does: parseInt(value) / EMU_PER_PX
    const rawX = "1524000"; // 160 px
    const rawY = "1397000"; // ~146.67 px
    const rawCx = "6096000"; // 640 px
    const rawCy = "741680"; // ~77.87 px

    const x = Math.round(parseInt(rawX) / EMU_PER_PX);
    const y = Math.round(parseInt(rawY) / EMU_PER_PX);
    const width = Math.round(parseInt(rawCx) / EMU_PER_PX);
    const height = Math.round(parseInt(rawCy) / EMU_PER_PX);

    expect(x).toBe(160);
    expect(y).toBeCloseTo(146.7, 0);
    expect(width).toBe(640);
    expect(height).toBeCloseTo(77.9, 0);
  });

  it("parses zero offset and extent", () => {
    const x = Math.round(parseInt("0") / EMU_PER_PX);
    const y = Math.round(parseInt("0") / EMU_PER_PX);
    const cx = Math.round(parseInt("0") / EMU_PER_PX);
    const cy = Math.round(parseInt("0") / EMU_PER_PX);

    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(cx).toBe(0);
    expect(cy).toBe(0);
  });

  it("parses full-slide shape (9144000 x 6858000 EMU)", () => {
    const width = Math.round(9144000 / EMU_PER_PX);
    const height = Math.round(6858000 / EMU_PER_PX);
    expect(width).toBe(960);
    expect(height).toBe(720);
  });

  it("parses half-slide shape", () => {
    const width = Math.round(4572000 / EMU_PER_PX);
    const height = Math.round(3429000 / EMU_PER_PX);
    expect(width).toBe(480);
    expect(height).toBe(360);
  });

  it("parses quarter-slide shape", () => {
    const width = Math.round(2286000 / EMU_PER_PX);
    const height = Math.round(1714500 / EMU_PER_PX);
    expect(width).toBe(240);
    expect(height).toBe(180);
  });
});

// ---------------------------------------------------------------------------
// Rotation parsing (60000ths -> degrees)
// ---------------------------------------------------------------------------

describe("rotation parsing (60000ths of a degree)", () => {
  it("@_rot=5400000 => 90 degrees", () => {
    const rot = parseInt("5400000") / 60000;
    expect(rot).toBe(90);
  });

  it("@_rot=10800000 => 180 degrees", () => {
    const rot = parseInt("10800000") / 60000;
    expect(rot).toBe(180);
  });

  it("@_rot=16200000 => 270 degrees", () => {
    const rot = parseInt("16200000") / 60000;
    expect(rot).toBe(270);
  });

  it("undefined @_rot yields undefined rotation", () => {
    const rawRot = undefined;
    const rot = rawRot ? parseInt(String(rawRot)) / 60000 : undefined;
    expect(rot).toBeUndefined();
  });

  it("fractional rotation: @_rot=2700000 => 45 degrees", () => {
    const rot = parseInt("2700000") / 60000;
    expect(rot).toBe(45);
  });
});

// ---------------------------------------------------------------------------
// Flip states (flipH, flipV as boolean)
// ---------------------------------------------------------------------------

describe("flip state parsing", () => {
  // Matches the parseBooleanAttr logic: "1" or "true" => true, else false
  function parseBooleanAttr(value: unknown): boolean {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "1" || normalized === "true";
  }

  it("@_flipH='1' => flipHorizontal=true", () => {
    expect(parseBooleanAttr("1")).toBe(true);
  });

  it("@_flipH='0' => flipHorizontal=false", () => {
    expect(parseBooleanAttr("0")).toBe(false);
  });

  it("@_flipH='true' => flipHorizontal=true", () => {
    expect(parseBooleanAttr("true")).toBe(true);
  });

  it("@_flipH='false' => flipHorizontal=false", () => {
    expect(parseBooleanAttr("false")).toBe(false);
  });

  it("undefined @_flipH => flipHorizontal=false (default)", () => {
    expect(parseBooleanAttr(undefined)).toBe(false);
  });

  it("@_flipV='1' => flipVertical=true", () => {
    expect(parseBooleanAttr("1")).toBe(true);
  });

  it("undefined @_flipV => flipVertical=false (default)", () => {
    expect(parseBooleanAttr(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group transforms with child offset/extent (chOff, chExt)
// ---------------------------------------------------------------------------

describe("group transform with child coordinate space", () => {
  it("computes scale factors from parent extent / child extent", () => {
    // Group: off(0,0) ext(9144000,6858000) chOff(0,0) chExt(9144000,6858000)
    // => scale = 1:1
    const parentW = Math.round(9144000 / EMU_PER_PX);
    const parentH = Math.round(6858000 / EMU_PER_PX);
    const chW = Math.round(9144000 / EMU_PER_PX);
    const chH = Math.round(6858000 / EMU_PER_PX);

    const scaleX = chW > 0 ? parentW / chW : 1;
    const scaleY = chH > 0 ? parentH / chH : 1;

    expect(scaleX).toBe(1);
    expect(scaleY).toBe(1);
  });

  it("computes 2x scale when parent is twice child extent", () => {
    const parentW = Math.round(9144000 / EMU_PER_PX); // 960
    const parentH = Math.round(6858000 / EMU_PER_PX); // 720
    const chW = Math.round(4572000 / EMU_PER_PX); // 480
    const chH = Math.round(3429000 / EMU_PER_PX); // 360

    const scaleX = chW > 0 ? parentW / chW : 1;
    const scaleY = chH > 0 ? parentH / chH : 1;

    expect(scaleX).toBe(2);
    expect(scaleY).toBe(2);
  });

  it("transforms child element coordinates relative to group", () => {
    const parentX = 100;
    const parentY = 50;
    const chX = 0;
    const chY = 0;
    const scaleX = 2;
    const scaleY = 2;

    // Child element at (50, 25) in child coord space
    const childX = 50;
    const childY = 25;

    const relativeX = childX - chX;
    const relativeY = childY - chY;
    const newX = parentX + relativeX * scaleX;
    const newY = parentY + relativeY * scaleY;

    expect(newX).toBe(200); // 100 + 50*2
    expect(newY).toBe(100); // 50 + 25*2
  });

  it("handles zero child extent with scale fallback to 1", () => {
    const chW = 0;
    const chH = 0;
    const parentW = 960;
    const parentH = 720;

    const scaleX = chW > 0 ? parentW / chW : 1;
    const scaleY = chH > 0 ? parentH / chH : 1;

    expect(scaleX).toBe(1);
    expect(scaleY).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getElementTransform (CSS transform string builder)
// ---------------------------------------------------------------------------

describe("getElementTransform", () => {
  it("returns undefined when no transforms apply", () => {
    const el = makePptxElement();
    expect(getElementTransform(el)).toBeUndefined();
  });

  it("returns scaleX(-1) for flipHorizontal", () => {
    const el = makePptxElement({ flipHorizontal: true });
    expect(getElementTransform(el)).toBe("scaleX(-1)");
  });

  it("returns scaleY(-1) for flipVertical", () => {
    const el = makePptxElement({ flipVertical: true });
    expect(getElementTransform(el)).toBe("scaleY(-1)");
  });

  it("returns rotate(45deg) for 45 degree rotation", () => {
    const el = makePptxElement({ rotation: 45 });
    expect(getElementTransform(el)).toBe("rotate(45deg)");
  });

  it("combines flipH, flipV, and rotation", () => {
    const el = makePptxElement({
      flipHorizontal: true,
      flipVertical: true,
      rotation: 90,
    });
    expect(getElementTransform(el)).toBe(
      "scaleX(-1) scaleY(-1) rotate(90deg)",
    );
  });
});

// ---------------------------------------------------------------------------
// getTextCompensationTransform
// ---------------------------------------------------------------------------

describe("getTextCompensationTransform", () => {
  it("returns undefined when no flips", () => {
    const el = makePptxElement();
    expect(getTextCompensationTransform(el)).toBeUndefined();
  });

  it("does not include rotation (only flips)", () => {
    const el = makePptxElement({ rotation: 90 });
    expect(getTextCompensationTransform(el)).toBeUndefined();
  });

  it("returns scaleX(-1) for flipHorizontal", () => {
    const el = makePptxElement({ flipHorizontal: true, rotation: 45 });
    expect(getTextCompensationTransform(el)).toBe("scaleX(-1)");
  });
});

// ---------------------------------------------------------------------------
// PptxElementTransformUpdater (px -> EMU serialization)
// ---------------------------------------------------------------------------

describe("PptxElementTransformUpdater.applyTransform", () => {
  const updater = new PptxElementTransformUpdater();

  it("writes element position and size as EMU strings", () => {
    const shape: XmlObject = {
      "p:spPr": {
        "a:xfrm": {
          "a:off": { "@_x": "0", "@_y": "0" },
          "a:ext": { "@_cx": "0", "@_cy": "0" },
        },
      },
    };

    const element = makePptxElement({
      x: 160,
      y: 120,
      width: 640,
      height: 480,
    });

    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    const off = xfrm["a:off"] as XmlObject;
    const ext = xfrm["a:ext"] as XmlObject;

    expect(off["@_x"]).toBe(String(Math.round(160 * EMU_PER_PX)));
    expect(off["@_y"]).toBe(String(Math.round(120 * EMU_PER_PX)));
    expect(ext["@_cx"]).toBe(String(Math.round(640 * EMU_PER_PX)));
    expect(ext["@_cy"]).toBe(String(Math.round(480 * EMU_PER_PX)));
  });

  it("writes rotation as 60000ths of a degree", () => {
    const shape: XmlObject = {
      "p:spPr": {
        "a:xfrm": {
          "a:off": {},
          "a:ext": {},
        },
      },
    };

    const element = makePptxElement({ rotation: 90 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_rot"]).toBe("5400000"); // 90 * 60000
  });

  it("writes 45-degree rotation correctly", () => {
    const shape: XmlObject = {
      "p:spPr": {
        "a:xfrm": {
          "a:off": {},
          "a:ext": {},
        },
      },
    };

    const element = makePptxElement({ rotation: 45 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_rot"]).toBe("2700000"); // 45 * 60000
  });

  it("writes flipH='1' when flipHorizontal is true", () => {
    const shape: XmlObject = {
      "p:spPr": {
        "a:xfrm": {
          "a:off": {},
          "a:ext": {},
        },
      },
    };

    const element = makePptxElement({ flipHorizontal: true });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_flipH"]).toBe("1");
  });

  it("deletes flipH when flipHorizontal is false", () => {
    const shape: XmlObject = {
      "p:spPr": {
        "a:xfrm": {
          "@_flipH": "1",
          "a:off": {},
          "a:ext": {},
        },
      },
    };

    const element = makePptxElement({ flipHorizontal: false });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_flipH"]).toBeUndefined();
  });

  it("writes flipV='1' when flipVertical is true", () => {
    const shape: XmlObject = {
      "p:spPr": {
        "a:xfrm": {
          "a:off": {},
          "a:ext": {},
        },
      },
    };

    const element = makePptxElement({ flipVertical: true });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_flipV"]).toBe("1");
  });

  it("does not modify shape when no xfrm element exists", () => {
    const shape: XmlObject = {
      "p:spPr": {},
    };
    const element = makePptxElement({ x: 100, y: 200 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    // Should not throw and should not create xfrm
    expect((shape["p:spPr"] as XmlObject)["a:xfrm"]).toBeUndefined();
  });
});
