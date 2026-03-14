/**
 * Tests for pure utility functions in export-package.ts.
 */
import { describe, it, expect } from "vitest";

import { collectMediaAssets, generatePackageReadme } from "./export-package";

// ---------------------------------------------------------------------------
// collectMediaAssets
// ---------------------------------------------------------------------------

describe("collectMediaAssets", () => {
  it("should return empty array for slides with no elements", () => {
    const result = collectMediaAssets([{ elements: [] }, {}]);
    expect(result).toEqual([]);
  });

  it("should collect imageSrc from image elements", () => {
    const result = collectMediaAssets([
      {
        elements: [
          { type: "image", imageSrc: "/path/to/photo.png" },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].sourcePath).toBe("/path/to/photo.png");
    expect(result[0].filename).toBe("photo.png");
  });

  it("should collect mediaSrc from media elements", () => {
    const result = collectMediaAssets([
      {
        elements: [
          { type: "media", mediaSrc: "/videos/clip.mp4" },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].sourcePath).toBe("/videos/clip.mp4");
    expect(result[0].filename).toBe("clip.mp4");
  });

  it("should collect src as fallback", () => {
    const result = collectMediaAssets([
      {
        elements: [
          { type: "audio", src: "/audio/song.mp3" },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("song.mp3");
  });

  it("should skip data: URLs", () => {
    const result = collectMediaAssets([
      {
        elements: [
          { type: "image", imageSrc: "data:image/png;base64,abc" },
        ],
      },
    ]);
    expect(result).toEqual([]);
  });

  it("should skip blob: URLs", () => {
    const result = collectMediaAssets([
      {
        elements: [
          { type: "image", imageSrc: "blob:http://localhost/abc" },
        ],
      },
    ]);
    expect(result).toEqual([]);
  });

  it("should deduplicate identical source paths", () => {
    const result = collectMediaAssets([
      {
        elements: [
          { type: "image", imageSrc: "/img/a.png" },
          { type: "image", imageSrc: "/img/a.png" },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
  });

  it("should handle backslash paths (Windows)", () => {
    const result = collectMediaAssets([
      {
        elements: [
          { type: "image", imageSrc: "C:\\Users\\me\\photo.jpg" },
        ],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("photo.jpg");
  });

  it("should collect assets across multiple slides", () => {
    const result = collectMediaAssets([
      { elements: [{ type: "image", imageSrc: "/a.png" }] },
      { elements: [{ type: "image", imageSrc: "/b.png" }] },
    ]);
    expect(result).toHaveLength(2);
  });

  it("should skip elements without any src property", () => {
    const result = collectMediaAssets([
      { elements: [{ type: "shape" }] },
    ]);
    expect(result).toEqual([]);
  });

  it("should prefer imageSrc over mediaSrc over src", () => {
    const result = collectMediaAssets([
      {
        elements: [
          {
            type: "image",
            imageSrc: "/preferred.png",
            mediaSrc: "/not-this.mp4",
            src: "/not-this-either.jpg",
          },
        ],
      },
    ]);
    expect(result[0].sourcePath).toBe("/preferred.png");
  });
});

// ---------------------------------------------------------------------------
// generatePackageReadme
// ---------------------------------------------------------------------------

describe("generatePackageReadme", () => {
  it("should include the presentation filename", () => {
    const readme = generatePackageReadme("my-slides.pptx");
    expect(readme).toContain('"my-slides.pptx"');
  });

  it("should contain the package title", () => {
    const readme = generatePackageReadme("test.pptx");
    expect(readme).toContain("Presentation Package");
  });

  it("should mention the media folder", () => {
    const readme = generatePackageReadme("test.pptx");
    expect(readme).toContain("/media");
  });

  it("should return a non-empty string", () => {
    const readme = generatePackageReadme("x.pptx");
    expect(readme.length).toBeGreaterThan(0);
  });
});
