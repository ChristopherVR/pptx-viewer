import { describe, it, expect } from "vitest";
import { PptxNativeAnimationService } from "./PptxNativeAnimationService";
import type { XmlObject } from "../types";

// ==========================================================================
// Test helpers
// ==========================================================================

function buildSlideXml(timingContent: XmlObject): XmlObject {
  return {
    "p:sld": {
      "p:timing": timingContent,
    },
  };
}

function buildTimingWithAnimNode(
  animNodeAttrs: Record<string, unknown>,
  childNodes?: XmlObject,
): XmlObject {
  return {
    "p:tnLst": {
      "p:par": {
        "p:cTn": {
          "@_nodeType": "tmRoot",
          "p:childTnLst": {
            "p:seq": {
              "p:cTn": {
                "@_nodeType": "mainSeq",
                "p:childTnLst": {
                  "p:par": {
                    "p:cTn": {
                      ...animNodeAttrs,
                      "p:childTnLst": {
                        "p:animEffect": {
                          "p:cBhvr": {
                            "p:tgtEl": {
                              "p:spTgt": {
                                "@_spid": "shape1",
                              },
                            },
                          },
                        },
                        ...childNodes,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

const service = new PptxNativeAnimationService();

// ==========================================================================
// Basic parsing
// ==========================================================================

describe("PptxNativeAnimationService.parseNativeAnimations", () => {
  it("returns undefined for slide without timing data", () => {
    const result = service.parseNativeAnimations({ "p:sld": {} });
    expect(result).toBeUndefined();
  });

  it("returns undefined for null/undefined input", () => {
    expect(service.parseNativeAnimations({} as XmlObject)).toBeUndefined();
    expect(
      service.parseNativeAnimations(null as unknown as XmlObject),
    ).toBeUndefined();
  });

  it("parses a basic entrance animation", () => {
    const slideXml = buildSlideXml(
      buildTimingWithAnimNode({
        "@_presetClass": "entr",
        "@_presetID": "10",
        "@_dur": "500",
      }),
    );

    const result = service.parseNativeAnimations(slideXml);
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThanOrEqual(1);

    const anim = result!.find((a) => a.targetId === "shape1");
    expect(anim).toBeDefined();
    expect(anim!.presetClass).toBe("entr");
    expect(anim!.presetId).toBe(10);
    expect(anim!.durationMs).toBe(500);
  });

  it("parses afterPrevious trigger from nodeType", () => {
    const slideXml = buildSlideXml(
      buildTimingWithAnimNode({
        "@_nodeType": "afterPrevious",
        "@_presetClass": "entr",
        "@_presetID": "10",
        "@_dur": "300",
      }),
    );

    const result = service.parseNativeAnimations(slideXml);
    expect(result).toBeDefined();
    const anim = result!.find((a) => a.targetId === "shape1");
    expect(anim).toBeDefined();
    expect(anim!.trigger).toBe("afterPrevious");
  });

  it("parses withPrevious trigger from nodeType", () => {
    const slideXml = buildSlideXml(
      buildTimingWithAnimNode({
        "@_nodeType": "withEffect",
        "@_presetClass": "entr",
        "@_presetID": "10",
        "@_dur": "300",
      }),
    );

    const result = service.parseNativeAnimations(slideXml);
    expect(result).toBeDefined();
    const anim = result!.find((a) => a.targetId === "shape1");
    expect(anim).toBeDefined();
    expect(anim!.trigger).toBe("withPrevious");
  });

  it("parses onHover trigger from mouseOver nodeType", () => {
    const slideXml = buildSlideXml(
      buildTimingWithAnimNode({
        "@_nodeType": "mouseOver",
        "@_presetClass": "emph",
        "@_presetID": "26",
        "@_dur": "800",
      }),
    );

    const result = service.parseNativeAnimations(slideXml);
    expect(result).toBeDefined();
    const anim = result!.find((a) => a.targetId === "shape1");
    expect(anim).toBeDefined();
    expect(anim!.trigger).toBe("onHover");
  });

  it("parses onHover trigger from hoverEffect nodeType", () => {
    const slideXml = buildSlideXml(
      buildTimingWithAnimNode({
        "@_nodeType": "hoverEffect",
        "@_presetClass": "emph",
        "@_presetID": "26",
        "@_dur": "800",
      }),
    );

    const result = service.parseNativeAnimations(slideXml);
    expect(result).toBeDefined();
    const anim = result!.find((a) => a.targetId === "shape1");
    expect(anim).toBeDefined();
    expect(anim!.trigger).toBe("onHover");
  });

  it("parses onHover from onMouseOver event in start conditions", () => {
    const slideXml = buildSlideXml(
      buildTimingWithAnimNode({
        "@_presetClass": "emph",
        "@_presetID": "26",
        "@_dur": "800",
        "p:stCondLst": {
          "p:cond": {
            "@_evt": "onMouseOver",
            "@_delay": "0",
          },
        },
      }),
    );

    const result = service.parseNativeAnimations(slideXml);
    expect(result).toBeDefined();
    const anim = result!.find((a) => a.targetId === "shape1");
    expect(anim).toBeDefined();
    expect(anim!.trigger).toBe("onHover");
  });

  it("parses repeat count", () => {
    const slideXml = buildSlideXml(
      buildTimingWithAnimNode({
        "@_presetClass": "emph",
        "@_presetID": "26",
        "@_dur": "500",
        "@_repeatCount": "3000", // 3000/1000 = 3 times
      }),
    );

    const result = service.parseNativeAnimations(slideXml);
    expect(result).toBeDefined();
    const anim = result!.find((a) => a.targetId === "shape1");
    expect(anim).toBeDefined();
    expect(anim!.repeatCount).toBe(3);
  });

  it("parses indefinite repeat count as Infinity", () => {
    const slideXml = buildSlideXml(
      buildTimingWithAnimNode({
        "@_presetClass": "emph",
        "@_presetID": "26",
        "@_dur": "500",
        "@_repeatCount": "indefinite",
      }),
    );

    const result = service.parseNativeAnimations(slideXml);
    expect(result).toBeDefined();
    const anim = result!.find((a) => a.targetId === "shape1");
    expect(anim).toBeDefined();
    expect(anim!.repeatCount).toBe(Infinity);
  });

  it("parses autoReverse flag", () => {
    const slideXml = buildSlideXml(
      buildTimingWithAnimNode({
        "@_presetClass": "emph",
        "@_presetID": "26",
        "@_dur": "500",
        "@_autoRev": "1",
      }),
    );

    const result = service.parseNativeAnimations(slideXml);
    expect(result).toBeDefined();
    const anim = result!.find((a) => a.targetId === "shape1");
    expect(anim).toBeDefined();
    expect(anim!.autoReverse).toBe(true);
  });

  it("parses afterDelay trigger from positive delay in start conditions", () => {
    const slideXml = buildSlideXml(
      buildTimingWithAnimNode({
        "@_presetClass": "entr",
        "@_presetID": "10",
        "@_dur": "500",
        "@_delay": "2000",
        "p:stCondLst": {
          "p:cond": {
            "@_delay": "2000",
          },
        },
      }),
    );

    const result = service.parseNativeAnimations(slideXml);
    expect(result).toBeDefined();
    const anim = result!.find((a) => a.targetId === "shape1");
    expect(anim).toBeDefined();
    expect(anim!.trigger).toBe("afterDelay");
  });

  it("parses motion path from p:animMotion", () => {
    const slideXml = buildSlideXml(
      buildTimingWithAnimNode(
        {
          "@_presetClass": "path",
          "@_presetID": "1",
          "@_dur": "1000",
        },
        {
          "p:animMotion": {
            "@_path": "M 0 0 L 0.5 0.5",
            "@_origin": "layout",
            "p:cBhvr": {
              "p:tgtEl": {
                "p:spTgt": { "@_spid": "shape1" },
              },
            },
          },
        },
      ),
    );

    const result = service.parseNativeAnimations(slideXml);
    expect(result).toBeDefined();
    const anim = result!.find(
      (a) => a.targetId === "shape1" && a.motionPath,
    );
    expect(anim).toBeDefined();
    expect(anim!.motionPath).toBe("M 0 0 L 0.5 0.5");
    expect(anim!.motionOrigin).toBe("layout");
  });
});

// ==========================================================================
// Interactive sequences
// ==========================================================================

describe("PptxNativeAnimationService - interactive sequences", () => {
  it("parses interactive sequences with trigger shape ID", () => {
    const slideXml = buildSlideXml({
      "p:tnLst": {
        "p:par": {
          "p:cTn": {
            "@_nodeType": "tmRoot",
            "p:childTnLst": {
              "p:seq": [
                // Main sequence
                {
                  "p:cTn": {
                    "@_nodeType": "mainSeq",
                    "p:childTnLst": {
                      "p:par": {
                        "p:cTn": {
                          "@_presetClass": "entr",
                          "@_presetID": "10",
                          "@_dur": "500",
                          "p:childTnLst": {
                            "p:animEffect": {
                              "p:cBhvr": {
                                "p:tgtEl": {
                                  "p:spTgt": { "@_spid": "shape1" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                // Interactive sequence (triggered by clicking shape2)
                {
                  "p:cTn": {
                    "@_nodeType": "interactiveSeq",
                    "p:stCondLst": {
                      "p:cond": {
                        "@_evt": "onClick",
                        "@_delay": "0",
                        "p:tgtEl": {
                          "p:spTgt": { "@_spid": "shape2" },
                        },
                      },
                    },
                    "p:childTnLst": {
                      "p:par": {
                        "p:cTn": {
                          "@_presetClass": "entr",
                          "@_presetID": "1",
                          "@_dur": "300",
                          "p:childTnLst": {
                            "p:animEffect": {
                              "p:cBhvr": {
                                "p:tgtEl": {
                                  "p:spTgt": { "@_spid": "shape3" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    });

    const result = service.parseNativeAnimations(slideXml);
    expect(result).toBeDefined();

    // Should have both the main animation and the interactive one
    const mainAnim = result!.find((a) => a.targetId === "shape1");
    expect(mainAnim).toBeDefined();

    const interactiveAnim = result!.find(
      (a) => a.targetId === "shape3" && a.trigger === "onShapeClick",
    );
    expect(interactiveAnim).toBeDefined();
    expect(interactiveAnim!.triggerShapeId).toBe("shape2");
  });
});
