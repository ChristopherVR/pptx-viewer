import { describe, it, expect } from "vitest";
import { PptxSlideTransitionService } from "./PptxSlideTransitionService";
import { PptxXmlLookupService } from "./PptxXmlLookupService";
import type { XmlObject } from "../types";

function createService(): PptxSlideTransitionService {
  const xmlLookupService = new PptxXmlLookupService();
  return new PptxSlideTransitionService({
    xmlLookupService,
    getXmlLocalName: (xmlKey: string) => {
      if (!xmlKey) return "";
      const withoutAttr = xmlKey.startsWith("@_") ? xmlKey.slice(2) : xmlKey;
      const idx = withoutAttr.lastIndexOf(":");
      return idx < 0 ? withoutAttr : withoutAttr.slice(idx + 1);
    },
  });
}

// ---------------------------------------------------------------------------
// parseSlideTransition
// ---------------------------------------------------------------------------

describe("PptxSlideTransitionService.parseSlideTransition", () => {
  const service = createService();

  it("returns undefined for undefined input", () => {
    expect(service.parseSlideTransition(undefined)).toBeUndefined();
  });

  it("returns undefined when slide has no transition element", () => {
    const slideXml: XmlObject = {
      "p:sld": {},
    };
    expect(service.parseSlideTransition(slideXml)).toBeUndefined();
  });

  it("parses a basic fade transition", () => {
    const slideXml: XmlObject = {
      "p:sld": {
        "p:transition": {
          "@_dur": "1000",
          "p:fade": {},
        },
      },
    };
    const result = service.parseSlideTransition(slideXml);
    expect(result).toBeDefined();
    expect(result!.type).toBe("fade");
    expect(result!.durationMs).toBe(1000);
  });

  it("parses a wipe transition with direction", () => {
    const slideXml: XmlObject = {
      "p:sld": {
        "p:transition": {
          "p:wipe": { "@_dir": "d" },
        },
      },
    };
    const result = service.parseSlideTransition(slideXml);
    expect(result).toBeDefined();
    expect(result!.type).toBe("wipe");
    expect(result!.direction).toBe("d");
  });

  it("parses a split transition with orientation", () => {
    const slideXml: XmlObject = {
      "p:sld": {
        "p:transition": {
          "p:split": { "@_orient": "horz" },
        },
      },
    };
    const result = service.parseSlideTransition(slideXml);
    expect(result).toBeDefined();
    expect(result!.type).toBe("split");
    expect(result!.orient).toBe("horz");
  });

  it("parses a wheel transition with spokes", () => {
    const slideXml: XmlObject = {
      "p:sld": {
        "p:transition": {
          "p:wheel": { "@_spokes": "4" },
        },
      },
    };
    const result = service.parseSlideTransition(slideXml);
    expect(result).toBeDefined();
    expect(result!.type).toBe("wheel");
    expect(result!.spokes).toBe(4);
  });

  it("ignores spokes values outside valid range", () => {
    const slideXml: XmlObject = {
      "p:sld": {
        "p:transition": {
          "p:wheel": { "@_spokes": "20" },
        },
      },
    };
    const result = service.parseSlideTransition(slideXml);
    expect(result!.spokes).toBeUndefined();
  });

  it("parses advanceOnClick attribute", () => {
    const slideXml: XmlObject = {
      "p:sld": {
        "p:transition": {
          "@_advClick": "0",
          "p:fade": {},
        },
      },
    };
    const result = service.parseSlideTransition(slideXml);
    expect(result!.advanceOnClick).toBe(false);
  });

  it("parses advanceAfterMs attribute", () => {
    const slideXml: XmlObject = {
      "p:sld": {
        "p:transition": {
          "@_advTm": "5000",
          "p:fade": {},
        },
      },
    };
    const result = service.parseSlideTransition(slideXml);
    expect(result!.advanceAfterMs).toBe(5000);
  });

  it("parses a push transition", () => {
    const slideXml: XmlObject = {
      "p:sld": {
        "p:transition": {
          "p:push": { "@_dir": "r" },
        },
      },
    };
    const result = service.parseSlideTransition(slideXml);
    expect(result!.type).toBe("push");
    expect(result!.direction).toBe("r");
  });

  it("parses thruBlk attribute", () => {
    const slideXml: XmlObject = {
      "p:sld": {
        "p:transition": {
          "p:blinds": { "@_thruBlk": "1" },
        },
      },
    };
    const result = service.parseSlideTransition(slideXml);
    expect(result!.type).toBe("blinds");
    expect(result!.thruBlk).toBe(true);
  });

  it("defaults to cut when no transition type element is present", () => {
    const slideXml: XmlObject = {
      "p:sld": {
        "p:transition": {
          "@_dur": "250",
        },
      },
    };
    const result = service.parseSlideTransition(slideXml);
    expect(result!.type).toBe("cut");
  });
});

// ---------------------------------------------------------------------------
// buildSlideTransitionXml
// ---------------------------------------------------------------------------

describe("PptxSlideTransitionService.buildSlideTransitionXml", () => {
  const service = createService();

  it('returns undefined for "none" transition type', () => {
    const result = service.buildSlideTransitionXml({
      type: "none",
    });
    expect(result).toBeUndefined();
  });

  it("builds a fade transition XML", () => {
    const result = service.buildSlideTransitionXml({
      type: "fade",
      durationMs: 1000,
    });
    expect(result).toBeDefined();
    expect(result!["p:fade"]).toBeDefined();
    expect(result!["@_dur"]).toBe("1000");
  });

  it("builds a wipe transition with direction", () => {
    const result = service.buildSlideTransitionXml({
      type: "wipe",
      direction: "d",
    });
    expect(result).toBeDefined();
    expect(result!["p:wipe"]).toBeDefined();
    const wipeNode = result!["p:wipe"] as XmlObject;
    expect(wipeNode["@_dir"]).toBe("d");
  });

  it("builds a split transition with orientation", () => {
    const result = service.buildSlideTransitionXml({
      type: "split",
      orient: "vert",
    });
    expect(result).toBeDefined();
    const splitNode = result!["p:split"] as XmlObject;
    expect(splitNode["@_orient"]).toBe("vert");
  });

  it("builds a wheel transition with spokes", () => {
    const result = service.buildSlideTransitionXml({
      type: "wheel",
      spokes: 4,
    });
    expect(result).toBeDefined();
    const wheelNode = result!["p:wheel"] as XmlObject;
    expect(wheelNode["@_spokes"]).toBe("4");
  });

  it("includes advanceOnClick attribute", () => {
    const result = service.buildSlideTransitionXml({
      type: "fade",
      advanceOnClick: false,
    });
    expect(result!["@_advClick"]).toBe("0");
  });

  it("includes advanceAfterMs attribute", () => {
    const result = service.buildSlideTransitionXml({
      type: "fade",
      advanceAfterMs: 3000,
    });
    expect(result!["@_advTm"]).toBe("3000");
  });

  it("builds a cut transition as default", () => {
    const result = service.buildSlideTransitionXml({
      type: "cut",
    });
    expect(result).toBeDefined();
    expect(result!["p:cut"]).toEqual({});
  });

  it("includes rawSoundAction when present", () => {
    const rawSound: XmlObject = { "p:stSnd": { "p:snd": {} } };
    const result = service.buildSlideTransitionXml({
      type: "fade",
      rawSoundAction: rawSound,
    });
    expect(result!["p:sndAc"]).toBe(rawSound);
  });

  it("includes rawExtLst for non-p14 types", () => {
    const rawExt: XmlObject = { "p:ext": {} };
    const result = service.buildSlideTransitionXml({
      type: "fade",
      rawExtLst: rawExt,
    });
    expect(result!["p:extLst"]).toBe(rawExt);
  });

  it("builds thruBlk attribute", () => {
    const result = service.buildSlideTransitionXml({
      type: "blinds",
      thruBlk: true,
    });
    const blindsNode = result!["p:blinds"] as XmlObject;
    expect(blindsNode["@_thruBlk"]).toBe("1");
  });

  it("omits duration when not finite", () => {
    const result = service.buildSlideTransitionXml({
      type: "fade",
      durationMs: NaN,
    });
    expect(result!["@_dur"]).toBeUndefined();
  });

  it("omits duration when zero or negative", () => {
    const result = service.buildSlideTransitionXml({
      type: "fade",
      durationMs: 0,
    });
    expect(result!["@_dur"]).toBeUndefined();
  });
});
