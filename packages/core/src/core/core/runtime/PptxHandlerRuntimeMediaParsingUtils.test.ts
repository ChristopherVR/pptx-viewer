import { describe, it, expect } from "vitest";
import type { XmlObject } from "../../types";
import {
  getXmlShapeIdFromXml,
  getPathExtensionFromPath,
  getImageMimeTypeFromPath,
  parseCtnMediaTiming,
  parseMediaExtensionData,
} from "./PptxHandlerRuntimeMediaParsingUtils";

// ---------------------------------------------------------------------------
// getXmlShapeIdFromXml
// ---------------------------------------------------------------------------
describe("getXmlShapeIdFromXml", () => {
  it("should return undefined for undefined input", () => {
    expect(getXmlShapeIdFromXml(undefined)).toBeUndefined();
  });

  it("should return undefined for an empty object", () => {
    expect(getXmlShapeIdFromXml({})).toBeUndefined();
  });

  it("should extract id from p:nvSpPr > p:cNvPr", () => {
    const xml: XmlObject = {
      "p:nvSpPr": {
        "p:cNvPr": { "@_id": "42" },
      },
    };
    expect(getXmlShapeIdFromXml(xml)).toBe("42");
  });

  it("should extract id from p:nvPicPr > p:cNvPr", () => {
    const xml: XmlObject = {
      "p:nvPicPr": {
        "p:cNvPr": { "@_id": "7" },
      },
    };
    expect(getXmlShapeIdFromXml(xml)).toBe("7");
  });

  it("should extract id from p:nvGraphicFramePr > p:cNvPr", () => {
    const xml: XmlObject = {
      "p:nvGraphicFramePr": {
        "p:cNvPr": { "@_id": "99" },
      },
    };
    expect(getXmlShapeIdFromXml(xml)).toBe("99");
  });

  it("should extract id from p:nvCxnSpPr > p:cNvPr", () => {
    const xml: XmlObject = {
      "p:nvCxnSpPr": {
        "p:cNvPr": { "@_id": "15" },
      },
    };
    expect(getXmlShapeIdFromXml(xml)).toBe("15");
  });

  it("should convert numeric id to string", () => {
    const xml: XmlObject = {
      "p:nvSpPr": {
        "p:cNvPr": { "@_id": 123 },
      },
    };
    expect(getXmlShapeIdFromXml(xml)).toBe("123");
  });

  it("should return the first matching path (graphicFrame has priority)", () => {
    const xml: XmlObject = {
      "p:nvGraphicFramePr": {
        "p:cNvPr": { "@_id": "10" },
      },
      "p:nvSpPr": {
        "p:cNvPr": { "@_id": "20" },
      },
    };
    expect(getXmlShapeIdFromXml(xml)).toBe("10");
  });
});

// ---------------------------------------------------------------------------
// getPathExtensionFromPath
// ---------------------------------------------------------------------------
describe("getPathExtensionFromPath", () => {
  it("should return undefined for empty string", () => {
    expect(getPathExtensionFromPath("")).toBeUndefined();
  });

  it("should return undefined for whitespace-only string", () => {
    expect(getPathExtensionFromPath("  ")).toBeUndefined();
  });

  it("should extract png extension", () => {
    expect(getPathExtensionFromPath("image.png")).toBe("png");
  });

  it("should extract extension from nested path", () => {
    expect(getPathExtensionFromPath("ppt/media/image1.jpeg")).toBe("jpeg");
  });

  it("should lowercase the extension", () => {
    expect(getPathExtensionFromPath("image.PNG")).toBe("png");
  });

  it("should strip hash fragments", () => {
    expect(getPathExtensionFromPath("file.svg#fragment")).toBe("svg");
  });

  it("should strip query parameters", () => {
    expect(getPathExtensionFromPath("file.mp4?v=123")).toBe("mp4");
  });

  it("should strip both hash and query", () => {
    expect(getPathExtensionFromPath("file.webm?a=1#section")).toBe("webm");
  });

  it("should handle path with multiple dots", () => {
    expect(getPathExtensionFromPath("my.file.name.gif")).toBe("gif");
  });
});

// ---------------------------------------------------------------------------
// getImageMimeTypeFromPath
// ---------------------------------------------------------------------------
describe("getImageMimeTypeFromPath", () => {
  it("should return image/png for .png files", () => {
    expect(getImageMimeTypeFromPath("image.png")).toBe("image/png");
  });

  it("should return image/svg+xml for .svg files", () => {
    expect(getImageMimeTypeFromPath("graphic.svg")).toBe("image/svg+xml");
  });

  it("should return image/x-emf for .emf files", () => {
    expect(getImageMimeTypeFromPath("metafile.emf")).toBe("image/x-emf");
  });

  it("should return image/x-wmf for .wmf files", () => {
    expect(getImageMimeTypeFromPath("metafile.wmf")).toBe("image/x-wmf");
  });

  it("should return image/bmp for .bmp files", () => {
    expect(getImageMimeTypeFromPath("bitmap.bmp")).toBe("image/bmp");
  });

  it("should return image/tiff for .tif files", () => {
    expect(getImageMimeTypeFromPath("scan.tif")).toBe("image/tiff");
  });

  it("should return image/tiff for .tiff files", () => {
    expect(getImageMimeTypeFromPath("scan.tiff")).toBe("image/tiff");
  });

  it("should return image/gif for .gif files", () => {
    expect(getImageMimeTypeFromPath("animation.gif")).toBe("image/gif");
  });

  it("should return image/webp for .webp files", () => {
    expect(getImageMimeTypeFromPath("photo.webp")).toBe("image/webp");
  });

  it("should return video/mp4 for .mp4 files", () => {
    expect(getImageMimeTypeFromPath("clip.mp4")).toBe("video/mp4");
  });

  it("should return video/mp4 for .m4v files", () => {
    expect(getImageMimeTypeFromPath("clip.m4v")).toBe("video/mp4");
  });

  it("should return video/quicktime for .mov files", () => {
    expect(getImageMimeTypeFromPath("movie.mov")).toBe("video/quicktime");
  });

  it("should return audio/mpeg for .mp3 files", () => {
    expect(getImageMimeTypeFromPath("song.mp3")).toBe("audio/mpeg");
  });

  it("should return audio/wav for .wav files", () => {
    expect(getImageMimeTypeFromPath("clip.wav")).toBe("audio/wav");
  });

  it("should return audio/ogg for .ogg files", () => {
    expect(getImageMimeTypeFromPath("clip.ogg")).toBe("audio/ogg");
  });

  it("should return audio/flac for .flac files", () => {
    expect(getImageMimeTypeFromPath("lossless.flac")).toBe("audio/flac");
  });

  it("should default to image/jpeg for unknown extensions", () => {
    expect(getImageMimeTypeFromPath("photo.jpg")).toBe("image/jpeg");
  });

  it("should default to image/jpeg for extensionless paths", () => {
    expect(getImageMimeTypeFromPath("noextension")).toBe("image/jpeg");
  });
});

// ---------------------------------------------------------------------------
// parseCtnMediaTiming
// ---------------------------------------------------------------------------
describe("parseCtnMediaTiming", () => {
  it("should return defaults when cTn is undefined", () => {
    const result = parseCtnMediaTiming(undefined, "p:video");
    expect(result).toEqual({
      trimStartMs: undefined,
      trimEndMs: undefined,
      loop: false,
      autoPlay: false,
      playAcrossSlides: false,
    });
  });

  it("should parse trim start from @_st", () => {
    const cTn: XmlObject = { "@_st": "5000" };
    const result = parseCtnMediaTiming(cTn, "p:video");
    expect(result.trimStartMs).toBe(5000);
  });

  it("should parse trim end from @_end", () => {
    const cTn: XmlObject = { "@_end": "30000" };
    const result = parseCtnMediaTiming(cTn, "p:video");
    expect(result.trimEndMs).toBe(30000);
  });

  it("should detect loop from repeatCount=indefinite", () => {
    const cTn: XmlObject = { "@_repeatCount": "indefinite" };
    const result = parseCtnMediaTiming(cTn, "p:video");
    expect(result.loop).toBe(true);
  });

  it("should not set loop for finite repeatCount", () => {
    const cTn: XmlObject = { "@_repeatCount": "3000" };
    const result = parseCtnMediaTiming(cTn, "p:video");
    expect(result.loop).toBe(false);
  });

  it("should detect autoPlay from nodeType=1 (string)", () => {
    const cTn: XmlObject = { "@_nodeType": "1" };
    const result = parseCtnMediaTiming(cTn, "p:video");
    expect(result.autoPlay).toBe(true);
  });

  it("should detect autoPlay from nodeType=2 (number)", () => {
    const cTn: XmlObject = { "@_nodeType": 2 };
    const result = parseCtnMediaTiming(cTn, "p:video");
    expect(result.autoPlay).toBe(true);
  });

  it("should not set autoPlay for nodeType=0", () => {
    const cTn: XmlObject = { "@_nodeType": "0" };
    const result = parseCtnMediaTiming(cTn, "p:video");
    expect(result.autoPlay).toBe(false);
  });

  it("should detect playAcrossSlides for audio with dur=indefinite", () => {
    const cTn: XmlObject = { "@_dur": "indefinite" };
    const result = parseCtnMediaTiming(cTn, "p:audio");
    expect(result.playAcrossSlides).toBe(true);
  });

  it("should not set playAcrossSlides for video even with dur=indefinite", () => {
    const cTn: XmlObject = { "@_dur": "indefinite" };
    const result = parseCtnMediaTiming(cTn, "p:video");
    expect(result.playAcrossSlides).toBe(false);
  });

  it("should handle all properties simultaneously", () => {
    const cTn: XmlObject = {
      "@_st": "1000",
      "@_end": "60000",
      "@_repeatCount": "indefinite",
      "@_nodeType": "1",
      "@_dur": "indefinite",
    };
    const result = parseCtnMediaTiming(cTn, "p:audio");
    expect(result.trimStartMs).toBe(1000);
    expect(result.trimEndMs).toBe(60000);
    expect(result.loop).toBe(true);
    expect(result.autoPlay).toBe(true);
    expect(result.playAcrossSlides).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseMediaExtensionData
// ---------------------------------------------------------------------------
describe("parseMediaExtensionData", () => {
  const ensureArray = (val: unknown): XmlObject[] => {
    if (!val) return [];
    return Array.isArray(val) ? val : [val as XmlObject];
  };

  it("should return empty defaults when no extension list", () => {
    const result = parseMediaExtensionData({}, {}, "s1", ensureArray);
    expect(result).toEqual({
      trimStartMs: undefined,
      trimEndMs: undefined,
      fadeInDuration: undefined,
      fadeOutDuration: undefined,
      playbackSpeed: undefined,
      bookmarks: [],
    });
  });

  it("should parse trim from p14:trim (microseconds to ms)", () => {
    const mediaNode: XmlObject = {
      "p:extLst": {
        "p:ext": {
          "p14:media": {
            "p14:trim": { "@_st": "5000000", "@_end": "30000000" },
          },
        },
      },
    };
    const result = parseMediaExtensionData(mediaNode, {}, "s1", ensureArray);
    expect(result.trimStartMs).toBe(5000);
    expect(result.trimEndMs).toBe(30000);
  });

  it("should parse fade in/out durations (ms to seconds)", () => {
    const mediaNode: XmlObject = {
      "p:extLst": {
        "p:ext": {
          "p14:media": {
            "p14:fade": { "@_in": "2000", "@_out": "3000" },
          },
        },
      },
    };
    const result = parseMediaExtensionData(mediaNode, {}, "s1", ensureArray);
    expect(result.fadeInDuration).toBe(2);
    expect(result.fadeOutDuration).toBe(3);
  });

  it("should parse playback speed (percentage * 1000 to multiplier)", () => {
    const mediaNode: XmlObject = {
      "p:extLst": {
        "p:ext": {
          "p14:media": { "@_spd": "200000" },
        },
      },
    };
    const result = parseMediaExtensionData(mediaNode, {}, "s1", ensureArray);
    expect(result.playbackSpeed).toBe(2);
  });

  it("should parse normal playback speed (100000 = 1x)", () => {
    const mediaNode: XmlObject = {
      "p:extLst": {
        "p:ext": {
          "p14:media": { "@_spd": "100000" },
        },
      },
    };
    const result = parseMediaExtensionData(mediaNode, {}, "s1", ensureArray);
    expect(result.playbackSpeed).toBe(1);
  });

  it("should parse bookmarks from p14:bmkLst", () => {
    const mediaNode: XmlObject = {
      "p:extLst": {
        "p:ext": {
          "p14:bmkLst": {
            "p14:bmk": [
              { "@_name": "Intro", "@_time": "5000" },
              { "@_name": "Chorus", "@_time": "30000" },
            ],
          },
        },
      },
    };
    const result = parseMediaExtensionData(mediaNode, {}, "shape1", ensureArray);
    expect(result.bookmarks).toHaveLength(2);
    expect(result.bookmarks[0]).toEqual({
      id: "bmk-shape1-5000",
      time: 5,
      label: "Intro",
    });
    expect(result.bookmarks[1]).toEqual({
      id: "bmk-shape1-30000",
      time: 30,
      label: "Chorus",
    });
  });

  it("should fall back to cMediaNode extLst when mediaNode has none", () => {
    const cMediaNode: XmlObject = {
      "p:extLst": {
        "p:ext": {
          "p14:media": {
            "p14:trim": { "@_st": "1000000" },
          },
        },
      },
    };
    const result = parseMediaExtensionData({}, cMediaNode, "s1", ensureArray);
    expect(result.trimStartMs).toBe(1000);
  });

  it("should ignore invalid (non-finite) trim values", () => {
    const mediaNode: XmlObject = {
      "p:extLst": {
        "p:ext": {
          "p14:media": {
            "p14:trim": { "@_st": "abc" },
          },
        },
      },
    };
    const result = parseMediaExtensionData(mediaNode, {}, "s1", ensureArray);
    expect(result.trimStartMs).toBeUndefined();
  });
});
