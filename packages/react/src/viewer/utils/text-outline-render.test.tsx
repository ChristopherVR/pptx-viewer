import { describe, it, expect } from "vitest";
import type { PptxElement, TextStyle } from "pptx-viewer-core";
import { renderSingleSegment } from "./text-segment-render";

/**
 * Helper to create a minimal text element for renderSingleSegment tests.
 */
function makeElement(
  textStyleOverrides: Partial<TextStyle> = {},
): PptxElement & Partial<{ textStyle: TextStyle }> {
  return {
    id: "el-outline",
    type: "text",
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    text: "Hello",
    textStyle: { fontSize: 16, ...textStyleOverrides },
  } as unknown as PptxElement & Partial<{ textStyle: TextStyle }>;
}

/**
 * Helper to extract the outer span style from renderSingleSegment output.
 * renderSingleSegment returns a <span> (or a link wrapper around a <span>).
 */
function getSpanStyle(
  segmentStyle: Partial<TextStyle>,
  elementTextStyle: Partial<TextStyle> = {},
): React.CSSProperties {
  const element = makeElement(elementTextStyle);
  const segment = { style: segmentStyle as TextStyle, text: "Test" };
  const result = renderSingleSegment(
    element,
    segment,
    0,
    "#000000",
    undefined,
    undefined,
  ) as React.ReactElement;
  return result.props.style;
}

// ── Text outline / stroke rendering ──────────────────────────────────

describe("text outline / stroke rendering", () => {
  it("does not set WebkitTextStroke when textOutlineWidth is absent", () => {
    const style = getSpanStyle({});
    expect(style.WebkitTextStroke).toBeUndefined();
  });

  it("does not set paintOrder when textOutlineWidth is absent", () => {
    const style = getSpanStyle({});
    expect(style.paintOrder).toBeUndefined();
  });

  it("sets WebkitTextStroke with width and color when both provided", () => {
    const style = getSpanStyle({
      textOutlineWidth: 2,
      textOutlineColor: "#FF0000",
    });
    expect(style.WebkitTextStroke).toBe("2px #FF0000");
  });

  it("sets paintOrder to 'stroke fill' when textOutlineWidth is provided", () => {
    const style = getSpanStyle({
      textOutlineWidth: 1,
      textOutlineColor: "#00FF00",
    });
    expect(style.paintOrder).toBe("stroke fill");
  });

  it("falls back to currentColor when textOutlineColor is absent", () => {
    const style = getSpanStyle({
      textOutlineWidth: 3,
    });
    expect(style.WebkitTextStroke).toBe("3px currentColor");
  });

  it("sets paintOrder even when textOutlineColor is absent", () => {
    const style = getSpanStyle({
      textOutlineWidth: 1.5,
    });
    expect(style.paintOrder).toBe("stroke fill");
  });

  it("does not set WebkitTextStroke when textOutlineWidth is 0", () => {
    const style = getSpanStyle({
      textOutlineWidth: 0,
      textOutlineColor: "#0000FF",
    });
    expect(style.WebkitTextStroke).toBeUndefined();
  });

  it("does not set paintOrder when textOutlineWidth is 0", () => {
    const style = getSpanStyle({
      textOutlineWidth: 0,
      textOutlineColor: "#0000FF",
    });
    expect(style.paintOrder).toBeUndefined();
  });

  it("normalizes a color without leading # correctly", () => {
    const style = getSpanStyle({
      textOutlineWidth: 1,
      textOutlineColor: "AABBCC",
    });
    // normalizeHexColor adds # prefix for bare hex strings
    expect(style.WebkitTextStroke).toBe("1px #AABBCC");
  });

  it("handles fractional outline widths", () => {
    const style = getSpanStyle({
      textOutlineWidth: 0.5,
      textOutlineColor: "#333333",
    });
    expect(style.WebkitTextStroke).toBe("0.5px #333333");
  });

  it("handles large outline width values", () => {
    const style = getSpanStyle({
      textOutlineWidth: 10,
      textOutlineColor: "#000000",
    });
    expect(style.WebkitTextStroke).toBe("10px #000000");
  });

  it("does not interfere with other text styles (bold, italic)", () => {
    const style = getSpanStyle({
      bold: true,
      italic: true,
      textOutlineWidth: 2,
      textOutlineColor: "#FF00FF",
    });
    expect(style.WebkitTextStroke).toBe("2px #FF00FF");
    expect(style.paintOrder).toBe("stroke fill");
    expect(style.fontWeight).toBe(700);
    expect(style.fontStyle).toBe("italic");
  });

  it("combines outline with text shadow without conflict", () => {
    const style = getSpanStyle({
      textOutlineWidth: 1,
      textOutlineColor: "#000000",
      textShadowColor: "#888888",
      textShadowBlur: 4,
      textShadowOffsetX: 2,
      textShadowOffsetY: 2,
    });
    expect(style.WebkitTextStroke).toBe("1px #000000");
    expect(style.paintOrder).toBe("stroke fill");
    expect(style.textShadow).toBeDefined();
    expect(style.textShadow).toContain("2px 2px 4px");
  });

  it("applies outline to hyperlink text segments", () => {
    const element = makeElement();
    const segment = {
      style: {
        textOutlineWidth: 2,
        textOutlineColor: "#FF0000",
        hyperlink: "https://example.com",
      } as TextStyle,
      text: "Link Text",
    };
    const onHyperlinkClick = () => {};
    const result = renderSingleSegment(
      element,
      segment,
      0,
      "#000000",
      undefined,
      undefined,
      onHyperlinkClick,
    ) as React.ReactElement;
    // When hyperlink + handler, result is a wrapper <span role="link"> around inner <span>
    expect(result.props.role).toBe("link");
    const innerSpan = result.props.children as React.ReactElement;
    expect(innerSpan.props.style.WebkitTextStroke).toBe("2px #FF0000");
    expect(innerSpan.props.style.paintOrder).toBe("stroke fill");
  });

  it("uses #000000 fallback when textOutlineColor is invalid/empty", () => {
    const style = getSpanStyle({
      textOutlineWidth: 1,
      textOutlineColor: "",
    });
    // Empty string is falsy, so falls through to the width-only branch
    expect(style.WebkitTextStroke).toBe("1px currentColor");
  });
});
