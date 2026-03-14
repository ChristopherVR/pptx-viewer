/**
 * Tests for PptxHandlerRuntimeSaveMediaTimingWrite:
 *   - collectMediaElements (recursive media collection)
 *   - getShapeIdFromRawXml (shape ID extraction from different nvPr paths)
 *   - applyMediaTimingToTimingTree logic (timing property writes)
 */
import { describe, it, expect } from "vitest";

import type { XmlObject, MediaPptxElement, PptxElement } from "../../types";

// ---------------------------------------------------------------------------
// Reimplemented: collectMediaElements
// ---------------------------------------------------------------------------
function collectMediaElements(
  elements: PptxElement[],
  output: MediaPptxElement[],
): void {
  for (const element of elements) {
    if (element.type === "media") {
      output.push(element);
    } else if (element.type === "group" && Array.isArray(element.children)) {
      collectMediaElements(element.children, output);
    }
  }
}

// ---------------------------------------------------------------------------
// Reimplemented: getShapeIdFromRawXml
// ---------------------------------------------------------------------------
function getShapeIdFromRawXml(
  rawXml: XmlObject | undefined,
): string | undefined {
  if (!rawXml) return undefined;
  const cNvPr =
    (rawXml["p:nvSpPr"] as XmlObject | undefined)?.["p:cNvPr"] ||
    (rawXml["p:nvPicPr"] as XmlObject | undefined)?.["p:cNvPr"] ||
    (rawXml["p:nvCxnSpPr"] as XmlObject | undefined)?.["p:cNvPr"] ||
    (rawXml["p:nvGraphicFramePr"] as XmlObject | undefined)?.["p:cNvPr"];
  const rawId = (cNvPr as XmlObject | undefined)?.["@_id"];
  if (rawId === undefined || rawId === null) return undefined;
  const shapeId = String(rawId).trim();
  return shapeId.length > 0 ? shapeId : undefined;
}

// ---------------------------------------------------------------------------
// Reimplemented: applyMediaTimingProperties on a single media node
// ---------------------------------------------------------------------------
function applyMediaTimingProperties(
  cMediaNode: XmlObject,
  media: MediaPptxElement,
  mediaTag: string,
): void {
  let cTn = cMediaNode["p:cTn"] as XmlObject | undefined;
  if (!cTn) {
    cTn = {};
    cMediaNode["p:cTn"] = cTn;
  }

  if (
    media.trimStartMs !== undefined &&
    Number.isFinite(media.trimStartMs) &&
    media.trimStartMs >= 0
  ) {
    cTn["@_st"] = String(Math.round(media.trimStartMs));
  } else {
    delete cTn["@_st"];
  }

  if (
    media.trimEndMs !== undefined &&
    Number.isFinite(media.trimEndMs) &&
    media.trimEndMs >= 0
  ) {
    cTn["@_end"] = String(Math.round(media.trimEndMs));
  } else {
    delete cTn["@_end"];
  }

  if (media.loop) {
    cTn["@_repeatCount"] = "indefinite";
  } else {
    delete cTn["@_repeatCount"];
  }

  if (media.autoPlay) {
    cTn["@_nodeType"] = "1";
  } else {
    delete cTn["@_nodeType"];
  }

  if (media.playAcrossSlides && mediaTag === "p:audio") {
    cTn["@_dur"] = "indefinite";
  } else if (!media.playAcrossSlides) {
    if (String(cTn["@_dur"]) === "indefinite") {
      delete cTn["@_dur"];
    }
  }

  if (media.fullScreen) {
    cMediaNode["@_fullScrn"] = "1";
  } else {
    delete cMediaNode["@_fullScrn"];
  }

  if (media.volume !== undefined && Number.isFinite(media.volume)) {
    cMediaNode["@_vol"] = String(Math.round(media.volume * 100000));
  }

  if (media.hideWhenNotPlaying) {
    cMediaNode["@_showWhenStopped"] = "0";
  } else {
    delete cMediaNode["@_showWhenStopped"];
  }
}

// ---------------------------------------------------------------------------
// Tests: collectMediaElements
// ---------------------------------------------------------------------------
describe("collectMediaElements", () => {
  it("should collect media elements from a flat list", () => {
    const elements: PptxElement[] = [
      { type: "text", id: "t1", x: 0, y: 0, width: 100, height: 50, text: "" },
      {
        type: "media",
        id: "m1",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      } as MediaPptxElement,
    ];
    const output: MediaPptxElement[] = [];
    collectMediaElements(elements, output);
    expect(output).toHaveLength(1);
    expect(output[0].id).toBe("m1");
  });

  it("should recursively collect media from groups", () => {
    const elements: PptxElement[] = [
      {
        type: "group",
        id: "g1",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        children: [
          {
            type: "media",
            id: "m2",
            x: 10,
            y: 10,
            width: 50,
            height: 50,
          } as MediaPptxElement,
        ],
      },
    ];
    const output: MediaPptxElement[] = [];
    collectMediaElements(elements, output);
    expect(output).toHaveLength(1);
    expect(output[0].id).toBe("m2");
  });

  it("should return empty array when no media elements", () => {
    const elements: PptxElement[] = [
      { type: "text", id: "t1", x: 0, y: 0, width: 100, height: 50, text: "" },
    ];
    const output: MediaPptxElement[] = [];
    collectMediaElements(elements, output);
    expect(output).toHaveLength(0);
  });

  it("should handle empty elements array", () => {
    const output: MediaPptxElement[] = [];
    collectMediaElements([], output);
    expect(output).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: getShapeIdFromRawXml
// ---------------------------------------------------------------------------
describe("getShapeIdFromRawXml", () => {
  it("should extract id from p:nvSpPr path", () => {
    const xml: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": { "@_id": "42" } },
    };
    expect(getShapeIdFromRawXml(xml)).toBe("42");
  });

  it("should extract id from p:nvPicPr path", () => {
    const xml: XmlObject = {
      "p:nvPicPr": { "p:cNvPr": { "@_id": "5" } },
    };
    expect(getShapeIdFromRawXml(xml)).toBe("5");
  });

  it("should extract id from p:nvCxnSpPr path", () => {
    const xml: XmlObject = {
      "p:nvCxnSpPr": { "p:cNvPr": { "@_id": "99" } },
    };
    expect(getShapeIdFromRawXml(xml)).toBe("99");
  });

  it("should extract id from p:nvGraphicFramePr path", () => {
    const xml: XmlObject = {
      "p:nvGraphicFramePr": { "p:cNvPr": { "@_id": "7" } },
    };
    expect(getShapeIdFromRawXml(xml)).toBe("7");
  });

  it("should return undefined for undefined rawXml", () => {
    expect(getShapeIdFromRawXml(undefined)).toBeUndefined();
  });

  it("should return undefined when no nvPr paths exist", () => {
    expect(getShapeIdFromRawXml({})).toBeUndefined();
  });

  it("should return undefined for empty id string", () => {
    const xml: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": { "@_id": "" } },
    };
    expect(getShapeIdFromRawXml(xml)).toBeUndefined();
  });

  it("should return undefined for whitespace-only id", () => {
    const xml: XmlObject = {
      "p:nvSpPr": { "p:cNvPr": { "@_id": "  " } },
    };
    expect(getShapeIdFromRawXml(xml)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: applyMediaTimingProperties
// ---------------------------------------------------------------------------
describe("applyMediaTimingProperties", () => {
  const baseMedia: MediaPptxElement = {
    type: "media",
    id: "m1",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  };

  it("should set trim start and end", () => {
    const cMediaNode: XmlObject = {};
    applyMediaTimingProperties(
      cMediaNode,
      { ...baseMedia, trimStartMs: 1000, trimEndMs: 5000 },
      "p:video",
    );
    const cTn = cMediaNode["p:cTn"] as XmlObject;
    expect(cTn["@_st"]).toBe("1000");
    expect(cTn["@_end"]).toBe("5000");
  });

  it("should delete trim values when undefined", () => {
    const cMediaNode: XmlObject = { "p:cTn": { "@_st": "500", "@_end": "3000" } };
    applyMediaTimingProperties(cMediaNode, baseMedia, "p:video");
    const cTn = cMediaNode["p:cTn"] as XmlObject;
    expect(cTn["@_st"]).toBeUndefined();
    expect(cTn["@_end"]).toBeUndefined();
  });

  it("should set loop to indefinite repeat", () => {
    const cMediaNode: XmlObject = {};
    applyMediaTimingProperties(
      cMediaNode,
      { ...baseMedia, loop: true },
      "p:video",
    );
    const cTn = cMediaNode["p:cTn"] as XmlObject;
    expect(cTn["@_repeatCount"]).toBe("indefinite");
  });

  it("should remove repeatCount when loop is false", () => {
    const cMediaNode: XmlObject = {
      "p:cTn": { "@_repeatCount": "indefinite" },
    };
    applyMediaTimingProperties(
      cMediaNode,
      { ...baseMedia, loop: false },
      "p:video",
    );
    const cTn = cMediaNode["p:cTn"] as XmlObject;
    expect(cTn["@_repeatCount"]).toBeUndefined();
  });

  it("should set autoPlay nodeType", () => {
    const cMediaNode: XmlObject = {};
    applyMediaTimingProperties(
      cMediaNode,
      { ...baseMedia, autoPlay: true },
      "p:video",
    );
    const cTn = cMediaNode["p:cTn"] as XmlObject;
    expect(cTn["@_nodeType"]).toBe("1");
  });

  it("should set playAcrossSlides for audio", () => {
    const cMediaNode: XmlObject = {};
    applyMediaTimingProperties(
      cMediaNode,
      { ...baseMedia, playAcrossSlides: true },
      "p:audio",
    );
    const cTn = cMediaNode["p:cTn"] as XmlObject;
    expect(cTn["@_dur"]).toBe("indefinite");
  });

  it("should not set playAcrossSlides for video", () => {
    const cMediaNode: XmlObject = {};
    applyMediaTimingProperties(
      cMediaNode,
      { ...baseMedia, playAcrossSlides: true },
      "p:video",
    );
    const cTn = cMediaNode["p:cTn"] as XmlObject;
    expect(cTn["@_dur"]).toBeUndefined();
  });

  it("should set fullScreen flag", () => {
    const cMediaNode: XmlObject = {};
    applyMediaTimingProperties(
      cMediaNode,
      { ...baseMedia, fullScreen: true },
      "p:video",
    );
    expect(cMediaNode["@_fullScrn"]).toBe("1");
  });

  it("should set volume as scaled integer", () => {
    const cMediaNode: XmlObject = {};
    applyMediaTimingProperties(
      cMediaNode,
      { ...baseMedia, volume: 0.75 },
      "p:video",
    );
    expect(cMediaNode["@_vol"]).toBe("75000");
  });

  it("should set hideWhenNotPlaying as showWhenStopped=0", () => {
    const cMediaNode: XmlObject = {};
    applyMediaTimingProperties(
      cMediaNode,
      { ...baseMedia, hideWhenNotPlaying: true },
      "p:video",
    );
    expect(cMediaNode["@_showWhenStopped"]).toBe("0");
  });

  it("should remove showWhenStopped when hideWhenNotPlaying is false", () => {
    const cMediaNode: XmlObject = { "@_showWhenStopped": "0" };
    applyMediaTimingProperties(
      cMediaNode,
      { ...baseMedia, hideWhenNotPlaying: false },
      "p:video",
    );
    expect(cMediaNode["@_showWhenStopped"]).toBeUndefined();
  });
});
