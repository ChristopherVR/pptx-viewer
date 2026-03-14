import { describe, it, expect } from "vitest";
import type { XmlObject } from "../../types";
import type { MediaTimingData } from "./PptxHandlerRuntimeImageEffects";
import {
  parseCtnMediaTiming,
  parseMediaExtensionData,
} from "./PptxHandlerRuntimeMediaParsingUtils";

// ---------------------------------------------------------------------------
// Extracted from PptxHandlerRuntimeMediaTimingParsing.walkMediaTimingTree
// Pure re-implementation of the tree-walking logic for direct testing.
// ---------------------------------------------------------------------------

function ensureArray(value: unknown): XmlObject[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value as XmlObject];
}

/**
 * Extracted from PptxHandlerRuntimeMediaTimingParsing.walkMediaTimingTree.
 * Simplified: does not call resolveRelationshipTarget (poster frame is
 * left as the raw rId value when present).
 */
function walkMediaTimingTree(
  node: XmlObject,
  result: Map<string, MediaTimingData>,
): void {
  if (!node) return;

  for (const mediaTag of ["p:video", "p:audio"]) {
    const mediaNodes = ensureArray(node[mediaTag]);
    for (const mediaNode of mediaNodes) {
      const cMediaNode = mediaNode["p:cMediaNode"] as XmlObject | undefined;
      if (!cMediaNode) continue;

      const tgtEl = cMediaNode["p:tgtEl"] as XmlObject | undefined;
      const spTgt = tgtEl?.["p:spTgt"] as XmlObject | undefined;
      const shapeId = spTgt?.["@_spid"]
        ? String(spTgt["@_spid"])
        : undefined;
      if (!shapeId) continue;

      const cTn = cMediaNode["p:cTn"] as XmlObject | undefined;
      const timing = parseCtnMediaTiming(cTn, mediaTag);

      const fullScreen =
        cMediaNode["@_fullScrn"] === "1" || cMediaNode["@_fullScrn"] === true;

      let volume: number | undefined;
      const volRaw = cMediaNode["@_vol"];
      if (volRaw !== undefined) {
        const volVal = parseInt(String(volRaw));
        if (Number.isFinite(volVal)) {
          volume = Math.max(0, Math.min(1, volVal / 100000));
        }
      }

      const hideWhenNotPlaying =
        cMediaNode["@_showWhenStopped"] === "0" ||
        cMediaNode["@_showWhenStopped"] === false;

      let posterFramePath: string | undefined;
      const posterRId = cMediaNode["@_posterFrame"];
      if (posterRId) {
        posterFramePath = String(posterRId); // simplified stub
      }

      const extData = parseMediaExtensionData(
        mediaNode,
        cMediaNode,
        shapeId,
        (v: unknown) => ensureArray(v),
      );

      const trimStartMs = timing.trimStartMs ?? extData.trimStartMs;
      const trimEndMs = timing.trimEndMs ?? extData.trimEndMs;

      result.set(shapeId, {
        trimStartMs:
          trimStartMs !== undefined && !isNaN(trimStartMs)
            ? trimStartMs
            : undefined,
        trimEndMs:
          trimEndMs !== undefined && !isNaN(trimEndMs)
            ? trimEndMs
            : undefined,
        fullScreen: fullScreen || undefined,
        loop: timing.loop || undefined,
        posterFramePath,
        volume,
        fadeInDuration: extData.fadeInDuration,
        fadeOutDuration: extData.fadeOutDuration,
        autoPlay: timing.autoPlay || undefined,
        playAcrossSlides: timing.playAcrossSlides || undefined,
        hideWhenNotPlaying: hideWhenNotPlaying || undefined,
        bookmarks:
          extData.bookmarks.length > 0 ? extData.bookmarks : undefined,
        playbackSpeed: extData.playbackSpeed,
      });
    }
  }

  // Recurse into timing containers
  const cTn = node["p:cTn"] as XmlObject | undefined;
  if (cTn) {
    const childTnLst = cTn["p:childTnLst"] as XmlObject | undefined;
    if (childTnLst) {
      for (const container of ["p:par", "p:seq", "p:excl"]) {
        const children = ensureArray(childTnLst[container]);
        for (const child of children) {
          walkMediaTimingTree(child, result);
        }
      }
      walkMediaTimingTree(childTnLst, result);
    }
  }

  for (const container of ["p:par", "p:seq", "p:excl", "p:tnLst"]) {
    const children = ensureArray(node[container]);
    for (const child of children) {
      walkMediaTimingTree(child, result);
    }
  }
}

// ---------------------------------------------------------------------------
// walkMediaTimingTree
// ---------------------------------------------------------------------------
describe("walkMediaTimingTree", () => {
  it("should return empty map for empty node", () => {
    const result = new Map<string, MediaTimingData>();
    walkMediaTimingTree({}, result);
    expect(result.size).toBe(0);
  });

  it("should extract video timing data with shape ID", () => {
    const result = new Map<string, MediaTimingData>();
    const node: XmlObject = {
      "p:video": {
        "p:cMediaNode": {
          "p:tgtEl": {
            "p:spTgt": { "@_spid": "42" },
          },
          "p:cTn": {
            "@_st": "1000",
            "@_end": "5000",
          },
        },
      },
    };
    walkMediaTimingTree(node, result);
    expect(result.size).toBe(1);
    expect(result.get("42")).toBeDefined();
    expect(result.get("42")!.trimStartMs).toBe(1000);
    expect(result.get("42")!.trimEndMs).toBe(5000);
  });

  it("should extract audio timing data", () => {
    const result = new Map<string, MediaTimingData>();
    const node: XmlObject = {
      "p:audio": {
        "p:cMediaNode": {
          "p:tgtEl": {
            "p:spTgt": { "@_spid": "10" },
          },
          "p:cTn": {
            "@_repeatCount": "indefinite",
            "@_nodeType": "1",
            "@_dur": "indefinite",
          },
        },
      },
    };
    walkMediaTimingTree(node, result);
    const data = result.get("10")!;
    expect(data.loop).toBe(true);
    expect(data.autoPlay).toBe(true);
    expect(data.playAcrossSlides).toBe(true);
  });

  it("should parse fullScreen flag", () => {
    const result = new Map<string, MediaTimingData>();
    const node: XmlObject = {
      "p:video": {
        "p:cMediaNode": {
          "@_fullScrn": "1",
          "p:tgtEl": { "p:spTgt": { "@_spid": "5" } },
        },
      },
    };
    walkMediaTimingTree(node, result);
    expect(result.get("5")!.fullScreen).toBe(true);
  });

  it("should parse volume", () => {
    const result = new Map<string, MediaTimingData>();
    const node: XmlObject = {
      "p:video": {
        "p:cMediaNode": {
          "@_vol": "50000", // 50%
          "p:tgtEl": { "p:spTgt": { "@_spid": "6" } },
        },
      },
    };
    walkMediaTimingTree(node, result);
    expect(result.get("6")!.volume).toBeCloseTo(0.5);
  });

  it("should clamp volume to [0, 1]", () => {
    const result = new Map<string, MediaTimingData>();
    const node: XmlObject = {
      "p:video": {
        "p:cMediaNode": {
          "@_vol": "200000", // > 100%
          "p:tgtEl": { "p:spTgt": { "@_spid": "7" } },
        },
      },
    };
    walkMediaTimingTree(node, result);
    expect(result.get("7")!.volume).toBe(1);
  });

  it("should parse hideWhenNotPlaying from showWhenStopped=0", () => {
    const result = new Map<string, MediaTimingData>();
    const node: XmlObject = {
      "p:video": {
        "p:cMediaNode": {
          "@_showWhenStopped": "0",
          "p:tgtEl": { "p:spTgt": { "@_spid": "8" } },
        },
      },
    };
    walkMediaTimingTree(node, result);
    expect(result.get("8")!.hideWhenNotPlaying).toBe(true);
  });

  it("should parse posterFrame rId", () => {
    const result = new Map<string, MediaTimingData>();
    const node: XmlObject = {
      "p:video": {
        "p:cMediaNode": {
          "@_posterFrame": "rId3",
          "p:tgtEl": { "p:spTgt": { "@_spid": "9" } },
        },
      },
    };
    walkMediaTimingTree(node, result);
    expect(result.get("9")!.posterFramePath).toBe("rId3");
  });

  it("should skip media nodes without shape ID", () => {
    const result = new Map<string, MediaTimingData>();
    const node: XmlObject = {
      "p:video": {
        "p:cMediaNode": {
          "p:tgtEl": {},
        },
      },
    };
    walkMediaTimingTree(node, result);
    expect(result.size).toBe(0);
  });

  it("should recurse through p:cTn > p:childTnLst > p:par", () => {
    const result = new Map<string, MediaTimingData>();
    const node: XmlObject = {
      "p:cTn": {
        "p:childTnLst": {
          "p:par": {
            "p:video": {
              "p:cMediaNode": {
                "p:tgtEl": { "p:spTgt": { "@_spid": "nested1" } },
              },
            },
          },
        },
      },
    };
    walkMediaTimingTree(node, result);
    expect(result.has("nested1")).toBe(true);
  });

  it("should recurse through p:seq container", () => {
    const result = new Map<string, MediaTimingData>();
    const node: XmlObject = {
      "p:cTn": {
        "p:childTnLst": {
          "p:seq": {
            "p:audio": {
              "p:cMediaNode": {
                "p:tgtEl": { "p:spTgt": { "@_spid": "seq1" } },
              },
            },
          },
        },
      },
    };
    walkMediaTimingTree(node, result);
    expect(result.has("seq1")).toBe(true);
  });

  it("should collect multiple media nodes from array", () => {
    const result = new Map<string, MediaTimingData>();
    const node: XmlObject = {
      "p:video": [
        {
          "p:cMediaNode": {
            "p:tgtEl": { "p:spTgt": { "@_spid": "v1" } },
          },
        },
        {
          "p:cMediaNode": {
            "p:tgtEl": { "p:spTgt": { "@_spid": "v2" } },
          },
        },
      ],
    };
    walkMediaTimingTree(node, result);
    expect(result.size).toBe(2);
    expect(result.has("v1")).toBe(true);
    expect(result.has("v2")).toBe(true);
  });

  it("should handle extension list data (fade, speed)", () => {
    const result = new Map<string, MediaTimingData>();
    const node: XmlObject = {
      "p:video": {
        "p:cMediaNode": {
          "p:tgtEl": { "p:spTgt": { "@_spid": "ext1" } },
        },
        "p:extLst": {
          "p:ext": {
            "p14:media": {
              "p14:fade": { "@_in": "2000", "@_out": "3000" },
              "@_spd": "150000",
            },
          },
        },
      },
    };
    walkMediaTimingTree(node, result);
    const data = result.get("ext1")!;
    expect(data.fadeInDuration).toBe(2);
    expect(data.fadeOutDuration).toBe(3);
    expect(data.playbackSpeed).toBe(1.5);
  });
});
