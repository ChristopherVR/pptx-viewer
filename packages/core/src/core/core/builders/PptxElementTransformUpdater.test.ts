import { describe, it, expect } from "vitest";
import { PptxElementTransformUpdater } from "./PptxElementTransformUpdater";
import type { PptxElement, XmlObject } from "../../types";

const EMU_PER_PX = 9525; // standard 96 DPI

/**
 * Helper to build a minimal PptxElement matching the required fields.
 * PptxElement is a discriminated union; we use type "shape" as the simplest
 * variant that satisfies the base interface.
 */
function makeElement(
  overrides: Partial<{
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    flipHorizontal: boolean;
    flipVertical: boolean;
  }>,
): PptxElement {
  return {
    type: "shape",
    id: "test-el-1",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 100,
    height: overrides.height ?? 100,
    rotation: overrides.rotation,
    flipHorizontal: overrides.flipHorizontal,
    flipVertical: overrides.flipVertical,
  } as unknown as PptxElement;
}

/**
 * Builds a shape XML object with a p:spPr > a:xfrm structure.
 */
function makeShapeXml(opts?: {
  useGroupTransform?: boolean;
}): XmlObject {
  if (opts?.useGroupTransform) {
    return {
      "p:xfrm": {
        "a:off": { "@_x": "0", "@_y": "0" },
        "a:ext": { "@_cx": "0", "@_cy": "0" },
      },
    };
  }
  return {
    "p:spPr": {
      "a:xfrm": {
        "a:off": { "@_x": "0", "@_y": "0" },
        "a:ext": { "@_cx": "0", "@_cy": "0" },
      },
    },
  };
}

describe("PptxElementTransformUpdater", () => {
  const updater = new PptxElementTransformUpdater();

  // ── Basic position update ────────────────────────────────────────────

  it("updates x, y position to correct EMU values", () => {
    const shape = makeShapeXml();
    const element = makeElement({ x: 96, y: 48 }); // 96px=1inch, 48px=0.5inch
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    const off = xfrm["a:off"] as XmlObject;
    // 96 * 9525 = 914400 EMU = 1 inch
    expect(off["@_x"]).toBe("914400");
    // 48 * 9525 = 457200 EMU = 0.5 inch
    expect(off["@_y"]).toBe("457200");
  });

  // ── Size update ──────────────────────────────────────────────────────

  it("updates width, height to correct EMU values", () => {
    const shape = makeShapeXml();
    const element = makeElement({ width: 200, height: 150 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    const ext = xfrm["a:ext"] as XmlObject;
    expect(ext["@_cx"]).toBe(String(200 * EMU_PER_PX));
    expect(ext["@_cy"]).toBe(String(150 * EMU_PER_PX));
  });

  // ── 1 inch = 914400 EMU ──────────────────────────────────────────────

  it("one inch (96px) produces 914400 EMU", () => {
    const shape = makeShapeXml();
    const element = makeElement({ x: 96, y: 96, width: 96, height: 96 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect((xfrm["a:off"] as XmlObject)["@_x"]).toBe("914400");
    expect((xfrm["a:off"] as XmlObject)["@_y"]).toBe("914400");
    expect((xfrm["a:ext"] as XmlObject)["@_cx"]).toBe("914400");
    expect((xfrm["a:ext"] as XmlObject)["@_cy"]).toBe("914400");
  });

  // ── Rotation ─────────────────────────────────────────────────────────

  it("sets rotation in 60000ths of a degree", () => {
    const shape = makeShapeXml();
    const element = makeElement({ rotation: 45 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    // 45 degrees * 60000 = 2700000
    expect(xfrm["@_rot"]).toBe("2700000");
  });

  it("handles 90-degree rotation", () => {
    const shape = makeShapeXml();
    const element = makeElement({ rotation: 90 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_rot"]).toBe("5400000");
  });

  it("handles 360-degree rotation", () => {
    const shape = makeShapeXml();
    const element = makeElement({ rotation: 360 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_rot"]).toBe("21600000");
  });

  it("does not set rotation when undefined", () => {
    const shape = makeShapeXml();
    const element = makeElement({});
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_rot"]).toBeUndefined();
  });

  // ── Flip states ──────────────────────────────────────────────────────

  it("sets flipH=1 when flipHorizontal is true", () => {
    const shape = makeShapeXml();
    const element = makeElement({ flipHorizontal: true });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_flipH"]).toBe("1");
  });

  it("removes flipH when flipHorizontal is false/undefined", () => {
    const shape = makeShapeXml();
    // Pre-set flipH so we can verify it gets removed
    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    xfrm["@_flipH"] = "1";

    const element = makeElement({ flipHorizontal: false });
    updater.applyTransform(shape, element, EMU_PER_PX);

    expect(xfrm["@_flipH"]).toBeUndefined();
  });

  it("sets flipV=1 when flipVertical is true", () => {
    const shape = makeShapeXml();
    const element = makeElement({ flipVertical: true });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect(xfrm["@_flipV"]).toBe("1");
  });

  it("removes flipV when flipVertical is false/undefined", () => {
    const shape = makeShapeXml();
    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    xfrm["@_flipV"] = "1";

    const element = makeElement({ flipVertical: false });
    updater.applyTransform(shape, element, EMU_PER_PX);

    expect(xfrm["@_flipV"]).toBeUndefined();
  });

  // ── Group transform (p:xfrm) fallback ───────────────────────────────

  it("handles p:xfrm (group transform) when p:spPr is absent", () => {
    const shape = makeShapeXml({ useGroupTransform: true });
    const element = makeElement({ x: 50, y: 25, width: 300, height: 200 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = shape["p:xfrm"] as XmlObject;
    expect((xfrm["a:off"] as XmlObject)["@_x"]).toBe(
      String(50 * EMU_PER_PX),
    );
    expect((xfrm["a:off"] as XmlObject)["@_y"]).toBe(
      String(25 * EMU_PER_PX),
    );
    expect((xfrm["a:ext"] as XmlObject)["@_cx"]).toBe(
      String(300 * EMU_PER_PX),
    );
    expect((xfrm["a:ext"] as XmlObject)["@_cy"]).toBe(
      String(200 * EMU_PER_PX),
    );
  });

  // ── No-op when no transform node exists ──────────────────────────────

  it("does nothing when shape has no transform node at all", () => {
    const shape: XmlObject = { "p:spPr": {} };
    const element = makeElement({ x: 100, y: 100 });
    updater.applyTransform(shape, element, EMU_PER_PX);
    // Should not throw and should not create a transform
    expect((shape["p:spPr"] as XmlObject)["a:xfrm"]).toBeUndefined();
  });

  // ── Creates a:off / a:ext if missing ─────────────────────────────────

  it("creates a:off and a:ext nodes if they are missing from xfrm", () => {
    const shape: XmlObject = {
      "p:spPr": {
        "a:xfrm": {},
      },
    };
    const element = makeElement({ x: 10, y: 20, width: 30, height: 40 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect((xfrm["a:off"] as XmlObject)["@_x"]).toBe(
      String(10 * EMU_PER_PX),
    );
    expect((xfrm["a:off"] as XmlObject)["@_y"]).toBe(
      String(20 * EMU_PER_PX),
    );
    expect((xfrm["a:ext"] as XmlObject)["@_cx"]).toBe(
      String(30 * EMU_PER_PX),
    );
    expect((xfrm["a:ext"] as XmlObject)["@_cy"]).toBe(
      String(40 * EMU_PER_PX),
    );
  });

  // ── Fractional pixel values ──────────────────────────────────────────

  it("rounds fractional pixel values to nearest integer EMU", () => {
    const shape = makeShapeXml();
    const element = makeElement({ x: 10.7, y: 20.3 });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    // 10.7 * 9525 = 101917.5 → 101918 (Math.round)
    expect((xfrm["a:off"] as XmlObject)["@_x"]).toBe(
      String(Math.round(10.7 * EMU_PER_PX)),
    );
    expect((xfrm["a:off"] as XmlObject)["@_y"]).toBe(
      String(Math.round(20.3 * EMU_PER_PX)),
    );
  });

  // ── Combined position + rotation + flip ──────────────────────────────

  it("applies all transform properties simultaneously", () => {
    const shape = makeShapeXml();
    const element = makeElement({
      x: 100,
      y: 200,
      width: 400,
      height: 300,
      rotation: 30,
      flipHorizontal: true,
      flipVertical: true,
    });
    updater.applyTransform(shape, element, EMU_PER_PX);

    const xfrm = (shape["p:spPr"] as XmlObject)["a:xfrm"] as XmlObject;
    expect((xfrm["a:off"] as XmlObject)["@_x"]).toBe(
      String(100 * EMU_PER_PX),
    );
    expect((xfrm["a:off"] as XmlObject)["@_y"]).toBe(
      String(200 * EMU_PER_PX),
    );
    expect((xfrm["a:ext"] as XmlObject)["@_cx"]).toBe(
      String(400 * EMU_PER_PX),
    );
    expect((xfrm["a:ext"] as XmlObject)["@_cy"]).toBe(
      String(300 * EMU_PER_PX),
    );
    expect(xfrm["@_rot"]).toBe(String(30 * 60000));
    expect(xfrm["@_flipH"]).toBe("1");
    expect(xfrm["@_flipV"]).toBe("1");
  });
});
