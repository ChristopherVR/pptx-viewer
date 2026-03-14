import { describe, it, expect } from "vitest";
import { collectMediaAssets, generatePackageReadme } from "./export-package";

// ==========================================================================
// collectMediaAssets
// ==========================================================================

describe("collectMediaAssets", () => {
  it("returns empty array for empty slides array", () => {
    expect(collectMediaAssets([])).toEqual([]);
  });

  it("returns empty array for slides with no elements", () => {
    expect(collectMediaAssets([{}, {}])).toEqual([]);
  });

  it("returns empty array for slides with elements but no media sources", () => {
    const slides = [{ elements: [{ type: "shape" }] }];
    expect(collectMediaAssets(slides)).toEqual([]);
  });

  it("collects imageSrc from image elements", () => {
    const slides = [
      {
        elements: [{ type: "image", imageSrc: "/path/to/image1.png" }],
      },
    ];
    const result = collectMediaAssets(slides);
    expect(result).toHaveLength(1);
    expect(result[0].sourcePath).toBe("/path/to/image1.png");
    expect(result[0].filename).toBe("image1.png");
  });

  it("collects mediaSrc from media elements", () => {
    const slides = [
      {
        elements: [{ type: "media", mediaSrc: "/path/to/video.mp4" }],
      },
    ];
    const result = collectMediaAssets(slides);
    expect(result).toHaveLength(1);
    expect(result[0].sourcePath).toBe("/path/to/video.mp4");
    expect(result[0].filename).toBe("video.mp4");
  });

  it("collects src as fallback when imageSrc and mediaSrc are absent", () => {
    const slides = [
      {
        elements: [{ type: "image", src: "/path/to/photo.jpg" }],
      },
    ];
    const result = collectMediaAssets(slides);
    expect(result).toHaveLength(1);
    expect(result[0].sourcePath).toBe("/path/to/photo.jpg");
    expect(result[0].filename).toBe("photo.jpg");
  });

  it("prefers imageSrc over mediaSrc and src", () => {
    const slides = [
      {
        elements: [
          {
            type: "image",
            imageSrc: "/imageSrc.png",
            mediaSrc: "/mediaSrc.mp4",
            src: "/src.jpg",
          },
        ],
      },
    ];
    const result = collectMediaAssets(slides);
    expect(result[0].sourcePath).toBe("/imageSrc.png");
  });

  it("skips data URLs", () => {
    const slides = [
      {
        elements: [
          { type: "image", imageSrc: "data:image/png;base64,abc123" },
        ],
      },
    ];
    expect(collectMediaAssets(slides)).toEqual([]);
  });

  it("skips blob URLs", () => {
    const slides = [
      {
        elements: [
          { type: "image", imageSrc: "blob:http://localhost/abc" },
        ],
      },
    ];
    expect(collectMediaAssets(slides)).toEqual([]);
  });

  it("deduplicates assets with the same source path", () => {
    const slides = [
      {
        elements: [
          { type: "image", imageSrc: "/same/image.png" },
          { type: "image", imageSrc: "/same/image.png" },
        ],
      },
    ];
    const result = collectMediaAssets(slides);
    expect(result).toHaveLength(1);
  });

  it("collects assets from multiple slides", () => {
    const slides = [
      { elements: [{ type: "image", imageSrc: "/slide1/image.png" }] },
      { elements: [{ type: "media", mediaSrc: "/slide2/video.mp4" }] },
    ];
    const result = collectMediaAssets(slides);
    expect(result).toHaveLength(2);
  });

  it("handles Windows-style backslash paths when extracting filename", () => {
    const slides = [
      {
        elements: [
          { type: "image", imageSrc: "C:\\Users\\data\\image.png" },
        ],
      },
    ];
    const result = collectMediaAssets(slides);
    expect(result[0].filename).toBe("image.png");
  });

  it("generates fallback filename for paths ending with /", () => {
    const slides = [
      {
        elements: [{ type: "image", imageSrc: "/some/path/" }],
      },
    ];
    const result = collectMediaAssets(slides);
    expect(result[0].filename).toBe("media-0");
  });
});

// ==========================================================================
// generatePackageReadme
// ==========================================================================

describe("generatePackageReadme", () => {
  it("includes the presentation filename", () => {
    const readme = generatePackageReadme("my-presentation.pptx");
    expect(readme).toContain("my-presentation.pptx");
  });

  it("includes the header", () => {
    const readme = generatePackageReadme("test.pptx");
    expect(readme).toContain("Presentation Package");
    expect(readme).toContain("====================");
  });

  it("includes instructions", () => {
    const readme = generatePackageReadme("test.pptx");
    expect(readme).toContain("To view this presentation:");
    expect(readme).toContain(".pptx file");
  });

  it("includes mention of /media folder", () => {
    const readme = generatePackageReadme("test.pptx");
    expect(readme).toContain("/media");
  });

  it("includes packaging date", () => {
    const readme = generatePackageReadme("test.pptx");
    expect(readme).toContain("Packaged on");
  });

  it("returns a non-empty string", () => {
    const readme = generatePackageReadme("a.pptx");
    expect(readme.length).toBeGreaterThan(0);
  });
});
