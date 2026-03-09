import { describe, it, expect, vi } from "vitest";
import { PptxSlideBackgroundBuilder } from "./PptxSlideBackgroundBuilder";
import type { XmlObject, PptxSlide } from "../../types";
import type { PptxSlideBackgroundBuilderInput } from "./PptxSlideBackgroundBuilder";

/**
 * Create a minimal PptxSlideBackgroundBuilderInput with sensible stubs.
 * Only the slide-level properties and the slideNode vary per test;
 * the zip, saveState, and relationship registry are stubbed.
 */
function createInput(
  slide: Partial<PptxSlide>,
  slideNode?: XmlObject,
): PptxSlideBackgroundBuilderInput {
  return {
    slideNode: slideNode ?? { "p:cSld": {} },
    slide: {
      id: "slide-1",
      number: 1,
      elements: [],
      ...slide,
    } as PptxSlide,
    zip: {
      file: vi.fn(),
    } as any,
    saveState: {
      nextMediaPath: vi.fn().mockReturnValue("ppt/media/image1.png"),
    } as any,
    relationshipRegistry: {
      nextRelationshipId: vi.fn().mockReturnValue("rId10"),
      upsertRelationship: vi.fn(),
    } as any,
    slideImageRelationshipType:
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
    parseDataUrlToBytes: vi.fn().mockReturnValue({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      extension: "png",
    }),
  };
}

describe("PptxSlideBackgroundBuilder", () => {
  const builder = new PptxSlideBackgroundBuilder();

  // ── No background ────────────────────────────────────────────────────

  it("removes p:bg when no background properties are set", () => {
    const slideNode: XmlObject = {
      "p:cSld": {
        "p:bg": { "p:bgPr": { "a:solidFill": {} } },
      },
    };
    const input = createInput({}, slideNode);
    builder.applyBackground(input);

    const cSld = slideNode["p:cSld"] as XmlObject;
    expect(cSld["p:bg"]).toBeUndefined();
  });

  it("removes p:bg when backgroundColor is transparent", () => {
    const slideNode: XmlObject = {
      "p:cSld": {
        "p:bg": { "p:bgPr": {} },
      },
    };
    const input = createInput({ backgroundColor: "transparent" }, slideNode);
    builder.applyBackground(input);

    const cSld = slideNode["p:cSld"] as XmlObject;
    expect(cSld["p:bg"]).toBeUndefined();
  });

  it("removes p:bg when backgroundColor is empty string", () => {
    const slideNode: XmlObject = {
      "p:cSld": {
        "p:bg": { "p:bgPr": {} },
      },
    };
    const input = createInput({ backgroundColor: "" }, slideNode);
    builder.applyBackground(input);

    const cSld = slideNode["p:cSld"] as XmlObject;
    expect(cSld["p:bg"]).toBeUndefined();
  });

  // ── Solid color background ───────────────────────────────────────────

  it("generates a:solidFill for a hex background color", () => {
    const input = createInput({ backgroundColor: "#FF6600" });
    builder.applyBackground(input);

    const cSld = input.slideNode["p:cSld"] as XmlObject;
    const bg = cSld["p:bg"] as XmlObject;
    const bgPr = bg["p:bgPr"] as XmlObject;

    expect(bgPr["a:solidFill"]).toBeDefined();
    const solidFill = bgPr["a:solidFill"] as XmlObject;
    const srgbClr = solidFill["a:srgbClr"] as XmlObject;
    expect(srgbClr["@_val"]).toBe("FF6600");
  });

  it("strips # from hex color in solidFill output", () => {
    const input = createInput({ backgroundColor: "#aabbcc" });
    builder.applyBackground(input);

    const cSld = input.slideNode["p:cSld"] as XmlObject;
    const bgPr = (cSld["p:bg"] as XmlObject)["p:bgPr"] as XmlObject;
    const srgbClr = (bgPr["a:solidFill"] as XmlObject)[
      "a:srgbClr"
    ] as XmlObject;
    // Should uppercase and strip #
    expect(srgbClr["@_val"]).toBe("AABBCC");
  });

  it("includes a:effectLst in bgPr for solid fill", () => {
    const input = createInput({ backgroundColor: "#FF0000" });
    builder.applyBackground(input);

    const cSld = input.slideNode["p:cSld"] as XmlObject;
    const bgPr = (cSld["p:bg"] as XmlObject)["p:bgPr"] as XmlObject;
    expect(bgPr["a:effectLst"]).toEqual({});
  });

  // ── Image background ─────────────────────────────────────────────────

  it("generates a:blipFill for a data-URL background image", () => {
    const input = createInput({
      backgroundImage: "data:image/png;base64,iVBOR...",
    });
    builder.applyBackground(input);

    const cSld = input.slideNode["p:cSld"] as XmlObject;
    const bgPr = (cSld["p:bg"] as XmlObject)["p:bgPr"] as XmlObject;

    expect(bgPr["a:blipFill"]).toBeDefined();
    const blipFill = bgPr["a:blipFill"] as XmlObject;
    const blip = blipFill["a:blip"] as XmlObject;
    expect(blip["@_r:embed"]).toBe("rId10");
    expect(blipFill["a:stretch"]).toEqual({ "a:fillRect": {} });
  });

  it("writes image bytes to zip and registers relationship", () => {
    const input = createInput({
      backgroundImage: "data:image/png;base64,iVBOR...",
    });
    builder.applyBackground(input);

    expect(input.zip.file).toHaveBeenCalledWith(
      "ppt/media/image1.png",
      expect.any(Uint8Array),
    );
    expect(input.relationshipRegistry.upsertRelationship).toHaveBeenCalledWith(
      "rId10",
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
      "../media/image1.png",
    );
  });

  it("image background takes priority over solid color", () => {
    const input = createInput({
      backgroundColor: "#FF0000",
      backgroundImage: "data:image/png;base64,iVBOR...",
    });
    builder.applyBackground(input);

    const cSld = input.slideNode["p:cSld"] as XmlObject;
    const bgPr = (cSld["p:bg"] as XmlObject)["p:bgPr"] as XmlObject;

    // Should have blipFill, not solidFill
    expect(bgPr["a:blipFill"]).toBeDefined();
    expect(bgPr["a:solidFill"]).toBeUndefined();
  });

  // ── cSld initialization ──────────────────────────────────────────────

  it("creates p:cSld if missing from slideNode", () => {
    const slideNode: XmlObject = {};
    const input = createInput({ backgroundColor: "#00FF00" }, slideNode);
    builder.applyBackground(input);

    const cSld = slideNode["p:cSld"] as XmlObject;
    expect(cSld).toBeDefined();
    expect(cSld["p:bg"]).toBeDefined();
  });

  // ── When parseDataUrlToBytes returns null ──────────────────────────────

  it("produces bgPr with only effectLst when image parsing fails (no solidFill fallback)", () => {
    // The builder enters the hasBackgroundImage branch; when parsing fails
    // the blipFill is simply skipped. The else-if for solidFill is not reached.
    const input = createInput({
      backgroundColor: "#FF0000",
      backgroundImage: "data:image/png;base64,corrupted",
    });
    (input.parseDataUrlToBytes as ReturnType<typeof vi.fn>).mockReturnValue(
      null,
    );
    builder.applyBackground(input);

    const cSld = input.slideNode["p:cSld"] as XmlObject;
    const bgPr = (cSld["p:bg"] as XmlObject)["p:bgPr"] as XmlObject;
    // Neither blipFill (parse failed) nor solidFill (branch skipped) are present
    expect(bgPr["a:blipFill"]).toBeUndefined();
    expect(bgPr["a:solidFill"]).toBeUndefined();
    // effectLst is always present in bgPr
    expect(bgPr["a:effectLst"]).toEqual({});
  });
});
