import { describe, it, expect } from "vitest";
import {
  guideEmuToPx,
  guidePxToEmu,
  parseSlideDrawingGuides,
  buildGuideListExtension,
  P14_GUIDE_URI,
} from "./guide-utils";
import type { XmlObject } from "../types";

// ---------------------------------------------------------------------------
// guideEmuToPx / guidePxToEmu (unit conversions)
// ---------------------------------------------------------------------------

describe("guideEmuToPx", () => {
  it("converts 0 EMU to 0 px", () => {
    expect(guideEmuToPx(0)).toBe(0);
  });

  it("converts 9525 EMU to 1 px", () => {
    // 914400/96 = 9525
    expect(guideEmuToPx(9525)).toBe(1);
  });

  it("converts 914400 EMU to 96 px (1 inch at 96 DPI)", () => {
    expect(guideEmuToPx(914400)).toBe(96);
  });

  it("converts 457200 EMU to 48 px (half inch)", () => {
    expect(guideEmuToPx(457200)).toBe(48);
  });

  it("handles fractional results", () => {
    const result = guideEmuToPx(10000);
    expect(result).toBeCloseTo(10000 / 9525, 6);
  });
});

describe("guidePxToEmu", () => {
  it("converts 0 px to 0 EMU", () => {
    expect(guidePxToEmu(0)).toBe(0);
  });

  it("converts 1 px to 9525 EMU", () => {
    expect(guidePxToEmu(1)).toBe(9525);
  });

  it("converts 96 px to 914400 EMU (1 inch)", () => {
    expect(guidePxToEmu(96)).toBe(914400);
  });

  it("rounds the result to nearest integer", () => {
    const result = guidePxToEmu(1.5);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(Math.round(1.5 * 9525));
  });

  it("round-trips with guideEmuToPx", () => {
    const px = 100;
    const emu = guidePxToEmu(px);
    const backToPx = guideEmuToPx(emu);
    expect(backToPx).toBeCloseTo(px, 1);
  });
});

// ---------------------------------------------------------------------------
// parseSlideDrawingGuides
// ---------------------------------------------------------------------------

describe("parseSlideDrawingGuides", () => {
  it("returns empty array when no p:sld element", () => {
    expect(parseSlideDrawingGuides({})).toEqual([]);
  });

  it("returns empty array when no p:extLst", () => {
    expect(parseSlideDrawingGuides({ "p:sld": {} })).toEqual([]);
  });

  it("returns empty array when ext URI does not match guide URI", () => {
    const xml: XmlObject = {
      "p:sld": {
        "p:extLst": {
          "p:ext": {
            "@_uri": "{OTHER-URI}",
          },
        },
      },
    };
    expect(parseSlideDrawingGuides(xml)).toEqual([]);
  });

  it("parses a single horizontal guide", () => {
    const xml: XmlObject = {
      "p:sld": {
        "p:extLst": {
          "p:ext": {
            "@_uri": P14_GUIDE_URI,
            "p14:sldGuideLst": {
              "p14:guide": {
                "@_id": "1",
                "@_orient": "horz",
                "@_pos": "2880",
              },
            },
          },
        },
      },
    };
    const guides = parseSlideDrawingGuides(xml);
    expect(guides).toHaveLength(1);
    expect(guides[0].id).toBe("1");
    expect(guides[0].orientation).toBe("horz");
    // pos=2880, 1 pos unit = 12700/8 = 1587.5 EMU, so 2880 * 1587.5 = 4572000
    expect(guides[0].positionEmu).toBe(Math.round(2880 * (12700 / 8)));
  });

  it("parses a vertical guide (default orientation)", () => {
    const xml: XmlObject = {
      "p:sld": {
        "p:extLst": {
          "p:ext": {
            "@_uri": P14_GUIDE_URI,
            "p14:sldGuideLst": {
              "p14:guide": {
                "@_id": "2",
                "@_pos": "1440",
              },
            },
          },
        },
      },
    };
    const guides = parseSlideDrawingGuides(xml);
    expect(guides).toHaveLength(1);
    expect(guides[0].orientation).toBe("vert");
  });

  it("parses guide colour from a:srgbClr", () => {
    const xml: XmlObject = {
      "p:sld": {
        "p:extLst": {
          "p:ext": {
            "@_uri": P14_GUIDE_URI,
            "p14:sldGuideLst": {
              "p14:guide": {
                "@_id": "3",
                "@_pos": "100",
                "a:srgbClr": { "@_val": "FF0000" },
              },
            },
          },
        },
      },
    };
    const guides = parseSlideDrawingGuides(xml);
    expect(guides).toHaveLength(1);
    expect(guides[0].color).toBe("#FF0000");
  });

  it("parses multiple guides from an array", () => {
    const xml: XmlObject = {
      "p:sld": {
        "p:extLst": {
          "p:ext": {
            "@_uri": P14_GUIDE_URI,
            "p14:sldGuideLst": {
              "p14:guide": [
                { "@_id": "1", "@_orient": "horz", "@_pos": "2880" },
                { "@_id": "2", "@_pos": "1440" },
              ],
            },
          },
        },
      },
    };
    const guides = parseSlideDrawingGuides(xml);
    expect(guides).toHaveLength(2);
    expect(guides[0].orientation).toBe("horz");
    expect(guides[1].orientation).toBe("vert");
  });
});

// ---------------------------------------------------------------------------
// buildGuideListExtension
// ---------------------------------------------------------------------------

describe("buildGuideListExtension", () => {
  it("builds extension with correct URI", () => {
    const result = buildGuideListExtension([]);
    expect(result["@_uri"]).toBe(P14_GUIDE_URI);
  });

  it("builds a single guide element (not wrapped in array)", () => {
    const guides = [
      { id: "1", orientation: "horz" as const, positionEmu: 4572000 },
    ];
    const result = buildGuideListExtension(guides);
    const guideList = result["p14:sldGuideLst"] as XmlObject;
    const guide = guideList["p14:guide"] as XmlObject;
    expect(guide["@_id"]).toBe("1");
    expect(guide["@_orient"]).toBe("horz");
    // pos = round(4572000 / (12700/8)) = round(4572000 / 1587.5) = 2880
    expect(guide["@_pos"]).toBe("2880");
  });

  it("builds multiple guide elements as an array", () => {
    const guides = [
      { id: "1", orientation: "horz" as const, positionEmu: 4572000 },
      { id: "2", orientation: "vert" as const, positionEmu: 2286000 },
    ];
    const result = buildGuideListExtension(guides);
    const guideList = result["p14:sldGuideLst"] as XmlObject;
    const guideNodes = guideList["p14:guide"];
    expect(Array.isArray(guideNodes)).toBe(true);
    expect((guideNodes as XmlObject[]).length).toBe(2);
  });

  it("omits orient for vertical guides (default)", () => {
    const guides = [
      { id: "1", orientation: "vert" as const, positionEmu: 1000 },
    ];
    const result = buildGuideListExtension(guides);
    const guideList = result["p14:sldGuideLst"] as XmlObject;
    const guide = guideList["p14:guide"] as XmlObject;
    expect(guide["@_orient"]).toBeUndefined();
  });

  it("includes colour when provided", () => {
    const guides = [
      { id: "1", orientation: "horz" as const, positionEmu: 0, color: "#00FF00" },
    ];
    const result = buildGuideListExtension(guides);
    const guideList = result["p14:sldGuideLst"] as XmlObject;
    const guide = guideList["p14:guide"] as XmlObject;
    const clr = guide["a:srgbClr"] as XmlObject;
    expect(clr["@_val"]).toBe("00FF00");
  });

  it("round-trips parse -> build -> parse", () => {
    const originalXml: XmlObject = {
      "p:sld": {
        "p:extLst": {
          "p:ext": {
            "@_uri": P14_GUIDE_URI,
            "p14:sldGuideLst": {
              "p14:guide": {
                "@_id": "1",
                "@_orient": "horz",
                "@_pos": "2880",
              },
            },
          },
        },
      },
    };
    const parsed = parseSlideDrawingGuides(originalXml);
    const rebuilt = buildGuideListExtension(parsed);
    // Re-parse the rebuilt extension
    const reparsedXml: XmlObject = {
      "p:sld": {
        "p:extLst": {
          "p:ext": rebuilt,
        },
      },
    };
    const reparsed = parseSlideDrawingGuides(reparsedXml);
    expect(reparsed).toHaveLength(1);
    expect(reparsed[0].id).toBe("1");
    expect(reparsed[0].orientation).toBe("horz");
    expect(reparsed[0].positionEmu).toBe(parsed[0].positionEmu);
  });
});
