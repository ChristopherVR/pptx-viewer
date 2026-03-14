import { describe, it, expect } from "vitest";
import { renderPictureBullet } from "./text-segment-helpers";
import type { BulletInfo } from "pptx-viewer-core";

describe("renderPictureBullet", () => {
  const elementId = "el-1";
  const segmentIndex = 0;
  const baseFontSize = 16;

  it("should render an <img> when imageDataUrl is provided", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,iVBOR",
      imageRelId: "rId5",
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result).toBeTruthy();
    expect(result.type).toBe("img");
    expect(result.props.src).toBe("data:image/png;base64,iVBOR");
    expect(result.props.alt).toBe("Bullet");
    expect(result.props.style.width).toBe(baseFontSize);
    expect(result.props.style.height).toBe(baseFontSize);
    expect(result.props.style.objectFit).toBe("contain");
  });

  it("should fall back to a character bullet when imageDataUrl is missing", () => {
    const bulletInfo: BulletInfo = {
      imageRelId: "rId5",
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result).toBeTruthy();
    expect(result.type).toBe("span");
    // Should contain the bullet character
    expect(result.props.children).toContain("\u2022");
    expect(result.props["aria-label"]).toBe("Bullet");
    expect(result.props.style.fontSize).toBe(baseFontSize);
  });

  it("should size the image bullet using sizePts when provided", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,abc",
      sizePts: 24,
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result.type).toBe("img");
    expect(result.props.style.width).toBe(24);
    expect(result.props.style.height).toBe(24);
  });

  it("should size the image bullet using sizePercent when provided", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,abc",
      sizePercent: 150,
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result.type).toBe("img");
    // 16 * (150 / 100) = 24
    expect(result.props.style.width).toBe(24);
    expect(result.props.style.height).toBe(24);
  });

  it("should default sizing to baseFontSize when no sizing info is provided", () => {
    const bulletInfo: BulletInfo = {
      imageDataUrl: "data:image/png;base64,abc",
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result.type).toBe("img");
    expect(result.props.style.width).toBe(baseFontSize);
    expect(result.props.style.height).toBe(baseFontSize);
  });

  it("should apply bullet color to the fallback character bullet", () => {
    const bulletInfo: BulletInfo = {
      imageRelId: "rId5",
      color: "#FF0000",
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result.type).toBe("span");
    expect(result.props.style.color).toBe("#FF0000");
  });

  it("should apply bullet fontFamily to the fallback character bullet", () => {
    const bulletInfo: BulletInfo = {
      imageRelId: "rId5",
      fontFamily: "Arial",
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result.type).toBe("span");
    expect(result.props.style.fontFamily).toBe("Arial");
  });

  it("should use sizePts for fallback character bullet sizing", () => {
    const bulletInfo: BulletInfo = {
      imageRelId: "rId5",
      sizePts: 20,
    };

    const result = renderPictureBullet(
      elementId,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    ) as React.ReactElement;

    expect(result.type).toBe("span");
    expect(result.props.style.fontSize).toBe(20);
  });
});
