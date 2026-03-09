import { describe, it, expect } from "vitest";
import {
  PptxMediaDataParser,
  type PptxMediaDataParserContext,
} from "./PptxMediaDataParser";

function makeContext(
  overrides: Partial<PptxMediaDataParserContext> = {},
): PptxMediaDataParserContext {
  return {
    slideRelsMap: new Map(),
    resolvePath: (base, relative) => {
      // Simple path resolution: join directory of base with relative
      const dir = base.substring(0, base.lastIndexOf("/"));
      return `${dir}/${relative}`;
    },
    getPathExtension: (pathValue) => {
      const dotIdx = pathValue.lastIndexOf(".");
      return dotIdx >= 0 ? pathValue.substring(dotIdx + 1) : undefined;
    },
    ...overrides,
  };
}

function makeSlideRelsMap(
  slidePath: string,
  rels: Record<string, string>,
): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>();
  const slideRels = new Map<string, string>();
  for (const [key, value] of Object.entries(rels)) {
    slideRels.set(key, value);
  }
  map.set(slidePath, slideRels);
  return map;
}

// ---------------------------------------------------------------------------
// Media type detection
// ---------------------------------------------------------------------------

describe("PptxMediaDataParser — media type detection", () => {
  it("detects video element from a:videoFile", () => {
    const slidePath = "ppt/slides/slide1.xml";
    const slideRelsMap = makeSlideRelsMap(slidePath, {
      rId2: "../media/video1.mp4",
    });
    const parser = new PptxMediaDataParser(
      makeContext({ slideRelsMap }),
    );

    const result = parser.parseMediaData(
      {
        "a:videoFile": { "@_r:link": "rId2" },
      },
      slidePath,
    );

    expect(result.mediaType).toBe("video");
  });

  it("detects audio element from a:audioFile", () => {
    const slidePath = "ppt/slides/slide1.xml";
    const slideRelsMap = makeSlideRelsMap(slidePath, {
      rId3: "../media/audio1.mp3",
    });
    const parser = new PptxMediaDataParser(
      makeContext({ slideRelsMap }),
    );

    const result = parser.parseMediaData(
      {
        "a:audioFile": { "@_r:link": "rId3" },
      },
      slidePath,
    );

    expect(result.mediaType).toBe("audio");
  });

  it("returns unknown when neither video nor audio is present", () => {
    const parser = new PptxMediaDataParser(makeContext());

    const result = parser.parseMediaData(
      {
        "a:someOtherElement": {},
      },
      "ppt/slides/slide1.xml",
    );

    expect(result.mediaType).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// Media path resolution
// ---------------------------------------------------------------------------

describe("PptxMediaDataParser — media path resolution", () => {
  it("resolves video media path from r:link relationship", () => {
    const slidePath = "ppt/slides/slide1.xml";
    const slideRelsMap = makeSlideRelsMap(slidePath, {
      rId5: "../media/video1.mp4",
    });
    const parser = new PptxMediaDataParser(
      makeContext({ slideRelsMap }),
    );

    const result = parser.parseMediaData(
      {
        "a:videoFile": { "@_r:link": "rId5" },
      },
      slidePath,
    );

    expect(result.mediaPath).toBe("ppt/slides/../media/video1.mp4");
  });

  it("resolves audio media path from r:embed relationship", () => {
    const slidePath = "ppt/slides/slide1.xml";
    const slideRelsMap = makeSlideRelsMap(slidePath, {
      rId7: "../media/audio1.wav",
    });
    const parser = new PptxMediaDataParser(
      makeContext({ slideRelsMap }),
    );

    const result = parser.parseMediaData(
      {
        "a:audioFile": { "@_r:embed": "rId7" },
      },
      slidePath,
    );

    expect(result.mediaPath).toBe("ppt/slides/../media/audio1.wav");
  });

  it("prefers r:link over r:embed for video", () => {
    const slidePath = "ppt/slides/slide1.xml";
    const slideRelsMap = makeSlideRelsMap(slidePath, {
      rIdLink: "../media/linked_video.mp4",
      rIdEmbed: "../media/embedded_video.mp4",
    });
    const parser = new PptxMediaDataParser(
      makeContext({ slideRelsMap }),
    );

    const result = parser.parseMediaData(
      {
        "a:videoFile": {
          "@_r:link": "rIdLink",
          "@_r:embed": "rIdEmbed",
        },
      },
      slidePath,
    );

    // r:link takes priority
    expect(result.mediaPath).toContain("linked_video.mp4");
  });

  it("returns undefined mediaPath when relationship ID is missing", () => {
    const parser = new PptxMediaDataParser(makeContext());

    const result = parser.parseMediaData(
      {
        "a:videoFile": {},
      },
      "ppt/slides/slide1.xml",
    );

    expect(result.mediaType).toBe("video");
    expect(result.mediaPath).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MIME type detection
// ---------------------------------------------------------------------------

describe("PptxMediaDataParser — MIME type detection", () => {
  it("detects video/mp4 MIME type for .mp4 files", () => {
    const slidePath = "ppt/slides/slide1.xml";
    const slideRelsMap = makeSlideRelsMap(slidePath, {
      rId1: "../media/video1.mp4",
    });
    const parser = new PptxMediaDataParser(
      makeContext({ slideRelsMap }),
    );

    const result = parser.parseMediaData(
      { "a:videoFile": { "@_r:link": "rId1" } },
      slidePath,
    );

    expect(result.mediaMimeType).toBe("video/mp4");
  });

  it("detects audio/mpeg MIME type for .mp3 files", () => {
    const slidePath = "ppt/slides/slide1.xml";
    const slideRelsMap = makeSlideRelsMap(slidePath, {
      rId1: "../media/music.mp3",
    });
    const parser = new PptxMediaDataParser(
      makeContext({ slideRelsMap }),
    );

    const result = parser.parseMediaData(
      { "a:audioFile": { "@_r:link": "rId1" } },
      slidePath,
    );

    expect(result.mediaMimeType).toBe("audio/mpeg");
  });

  it("detects audio/wav MIME type for .wav files", () => {
    const slidePath = "ppt/slides/slide1.xml";
    const slideRelsMap = makeSlideRelsMap(slidePath, {
      rId1: "../media/sound.wav",
    });
    const parser = new PptxMediaDataParser(
      makeContext({ slideRelsMap }),
    );

    const result = parser.parseMediaData(
      { "a:audioFile": { "@_r:link": "rId1" } },
      slidePath,
    );

    expect(result.mediaMimeType).toBe("audio/wav");
  });

  it("detects video/webm MIME type for .webm files", () => {
    const parser = new PptxMediaDataParser(makeContext());
    const mime = parser.getMediaMimeType("ppt/media/clip.webm");
    expect(mime).toBe("video/webm");
  });

  it("detects video/quicktime MIME type for .mov files", () => {
    const parser = new PptxMediaDataParser(makeContext());
    const mime = parser.getMediaMimeType("ppt/media/clip.mov");
    expect(mime).toBe("video/quicktime");
  });

  it("detects audio/mp4 MIME type for .m4a files", () => {
    const parser = new PptxMediaDataParser(makeContext());
    const mime = parser.getMediaMimeType("ppt/media/audio.m4a");
    expect(mime).toBe("audio/mp4");
  });

  it("returns undefined MIME type for unknown extension", () => {
    const parser = new PptxMediaDataParser(makeContext());
    const mime = parser.getMediaMimeType("ppt/media/file.xyz");
    expect(mime).toBeUndefined();
  });

  it("returns undefined MIME type when mediaPath is undefined", () => {
    const parser = new PptxMediaDataParser(makeContext());
    const mime = parser.getMediaMimeType(undefined);
    expect(mime).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveRelationshipTarget
// ---------------------------------------------------------------------------

describe("PptxMediaDataParser — resolveRelationshipTarget", () => {
  it("resolves target path from source path and relationship ID", () => {
    const slidePath = "ppt/slides/slide2.xml";
    const slideRelsMap = makeSlideRelsMap(slidePath, {
      rId10: "../media/video2.mp4",
    });
    const parser = new PptxMediaDataParser(
      makeContext({ slideRelsMap }),
    );

    const result = parser.resolveRelationshipTarget(slidePath, "rId10");
    expect(result).toBe("ppt/slides/../media/video2.mp4");
  });

  it("returns undefined when relationship ID not found", () => {
    const slidePath = "ppt/slides/slide1.xml";
    const slideRelsMap = makeSlideRelsMap(slidePath, {});
    const parser = new PptxMediaDataParser(
      makeContext({ slideRelsMap }),
    );

    const result = parser.resolveRelationshipTarget(slidePath, "rIdMissing");
    expect(result).toBeUndefined();
  });

  it("returns undefined when slide has no relationships", () => {
    const parser = new PptxMediaDataParser(makeContext());

    const result = parser.resolveRelationshipTarget(
      "ppt/slides/slide99.xml",
      "rId1",
    );
    expect(result).toBeUndefined();
  });
});
