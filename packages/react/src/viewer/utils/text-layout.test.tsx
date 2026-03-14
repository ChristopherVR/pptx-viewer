import { describe, it, expect } from "vitest";
import { getTextLayoutStyle } from "./text-layout";
import type { PptxElement } from "pptx-viewer-core";

/**
 * Helper to create a minimal text element with given textStyle overrides.
 */
function makeTextElement(
  textStyleOverrides: Record<string, unknown> = {},
  extras: Record<string, unknown> = {},
): PptxElement {
  return {
    id: "el-1",
    type: "text",
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    text: "Hello",
    textStyle: {
      ...textStyleOverrides,
    },
    ...extras,
  } as unknown as PptxElement;
}

describe("getTextLayoutStyle", () => {
  it("returns empty object for non-text elements", () => {
    const el = { id: "img-1", type: "image", x: 0, y: 0, width: 100, height: 50 } as PptxElement;
    expect(getTextLayoutStyle(el)).toEqual({});
  });

  it("returns flex layout by default (no columns)", () => {
    const el = makeTextElement();
    const style = getTextLayoutStyle(el);
    expect(style.display).toBe("flex");
    expect(style.flexDirection).toBe("column");
  });

  // ── Vertical alignment ──────────────────────────────────────
  it("uses flex-start for top alignment (default)", () => {
    const el = makeTextElement({ vAlign: "top" });
    const style = getTextLayoutStyle(el);
    expect(style.justifyContent).toBe("flex-start");
  });

  it("uses center for middle alignment", () => {
    const el = makeTextElement({ vAlign: "middle" });
    const style = getTextLayoutStyle(el);
    expect(style.justifyContent).toBe("center");
  });

  it("uses flex-end for bottom alignment", () => {
    const el = makeTextElement({ vAlign: "bottom" });
    const style = getTextLayoutStyle(el);
    expect(style.justifyContent).toBe("flex-end");
  });

  // ── Multi-column layout ─────────────────────────────────────
  it("switches to block layout with columnCount > 1", () => {
    const el = makeTextElement({ columnCount: 2 });
    const style = getTextLayoutStyle(el);
    expect(style.display).toBe("block");
    expect(style.columnCount).toBe(2);
  });

  it("clamps columnCount to max 16", () => {
    const el = makeTextElement({ columnCount: 30 });
    const style = getTextLayoutStyle(el);
    expect(style.columnCount).toBe(16);
  });

  it("uses columnSpacing as columnGap", () => {
    const el = makeTextElement({ columnCount: 3, columnSpacing: 20 });
    const style = getTextLayoutStyle(el);
    expect(style.columnGap).toBe("20px");
  });

  it("uses default columnGap when no columnSpacing", () => {
    const el = makeTextElement({ columnCount: 2 });
    const style = getTextLayoutStyle(el);
    expect(style.columnGap).toBe("0.75em");
  });

  // ── Writing mode ────────────────────────────────────────────
  it("sets writingMode for vertical text direction", () => {
    const el = makeTextElement({ textDirection: "vertical" });
    const style = getTextLayoutStyle(el);
    expect(style.writingMode).toBe("vertical-rl");
  });

  it("sets writingMode for vertical270 text direction", () => {
    const el = makeTextElement({ textDirection: "vertical270" });
    const style = getTextLayoutStyle(el);
    expect(style.writingMode).toBe("vertical-lr");
  });

  it("does not set writingMode for horizontal text", () => {
    const el = makeTextElement({ textDirection: undefined });
    const style = getTextLayoutStyle(el);
    expect(style.writingMode).toBeUndefined();
  });

  // ── Tab size ────────────────────────────────────────────────
  it("computes tab size from a single tab stop", () => {
    const el = makeTextElement({
      tabStops: [{ position: 96, align: "l" }],
    });
    const style = getTextLayoutStyle(el);
    expect(style.tabSize).toBe("96px");
  });

  it("computes tab size as average gap of multiple tab stops", () => {
    const el = makeTextElement({
      tabStops: [
        { position: 100, align: "l" },
        { position: 200, align: "l" },
        { position: 300, align: "l" },
      ],
    });
    const style = getTextLayoutStyle(el);
    // Average gap = (200-100 + 300-200) / 2 = 100
    expect(style.tabSize).toBe("100px");
  });

  it("does not set tabSize when no tab stops", () => {
    const el = makeTextElement({});
    const style = getTextLayoutStyle(el);
    expect(style.tabSize).toBeUndefined();
  });

  // ── Text wrap ───────────────────────────────────────────────
  it('sets whiteSpace nowrap when textWrap is "none"', () => {
    const el = makeTextElement({ textWrap: "none" });
    const style = getTextLayoutStyle(el);
    expect(style.whiteSpace).toBe("nowrap");
    expect(style.overflow).toBe("visible");
  });

  it("does not set whiteSpace for default text wrap", () => {
    const el = makeTextElement({});
    const style = getTextLayoutStyle(el);
    expect(style.whiteSpace).toBeUndefined();
  });

  // ── Paragraph spacing ──────────────────────────────────────
  it("includes paragraph spacing in padding", () => {
    const el = makeTextElement({
      paragraphSpacingBefore: 10,
      paragraphSpacingAfter: 15,
    });
    const style = getTextLayoutStyle(el);
    // paddingTop should be bodyInsetTop + paragraphSpacingBefore
    expect(typeof style.paddingTop).toBe("number");
    expect(typeof style.paddingBottom).toBe("number");
    expect(style.paddingTop as number).toBeGreaterThan(0);
    expect(style.paddingBottom as number).toBeGreaterThan(0);
  });

  // ── Paragraph indentation ──────────────────────────────────
  it("applies paragraphMarginLeft when no per-paragraph indents", () => {
    const el = makeTextElement({ paragraphMarginLeft: 20 });
    const style = getTextLayoutStyle(el);
    expect(style.marginLeft).toBe(20);
  });

  it("applies paragraphIndent when no per-paragraph indents", () => {
    const el = makeTextElement({ paragraphIndent: -18 });
    const style = getTextLayoutStyle(el);
    expect(style.textIndent).toBe(-18);
  });

  it("does not apply global indent when paragraphIndents exist", () => {
    const el = makeTextElement(
      { paragraphMarginLeft: 20, paragraphIndent: -10 },
      {
        paragraphIndents: [{ level: 0, marginLeft: 30, indent: -15 }],
      },
    );
    const style = getTextLayoutStyle(el);
    expect(style.marginLeft).toBeUndefined();
    expect(style.textIndent).toBeUndefined();
  });

  // ── Shape element with text ─────────────────────────────────
  it("works for shape elements with text properties", () => {
    const el = {
      id: "sh-1",
      type: "shape",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      text: "Shape text",
      textStyle: { vAlign: "middle" },
    } as unknown as PptxElement;
    const style = getTextLayoutStyle(el);
    expect(style.display).toBe("flex");
    expect(style.justifyContent).toBe("center");
  });

  // ── Kinsoku line-breaking (CJK) ─────────────────────────────
  it("applies lineBreak=normal and wordBreak=break-all when eaLineBreak is true", () => {
    const el = makeTextElement({ eaLineBreak: true });
    const style = getTextLayoutStyle(el);
    expect(style.lineBreak).toBe("normal");
    expect(style.wordBreak).toBe("break-all");
    expect(style.overflowWrap).toBe("break-word");
  });

  it("applies lineBreak=strict when eaLineBreak is false", () => {
    const el = makeTextElement({ eaLineBreak: false });
    const style = getTextLayoutStyle(el);
    expect(style.lineBreak).toBe("strict");
    expect(style.overflowWrap).toBe("break-word");
  });

  it("applies hangingPunctuation=last when hangingPunctuation is true", () => {
    const el = makeTextElement({ hangingPunctuation: true });
    const style = getTextLayoutStyle(el);
    expect(style.hangingPunctuation).toBe("last");
  });

  it("does not set kinsoku styles when no flags are present", () => {
    const el = makeTextElement({});
    const style = getTextLayoutStyle(el);
    expect(style.lineBreak).toBeUndefined();
    expect(style.wordBreak).toBeUndefined();
    expect(style.overflowWrap).toBeUndefined();
    expect(style.hangingPunctuation).toBeUndefined();
  });

  it("applies kinsoku styles in multi-column layout", () => {
    const el = makeTextElement({ columnCount: 2, eaLineBreak: true, hangingPunctuation: true });
    const style = getTextLayoutStyle(el);
    expect(style.display).toBe("block");
    expect(style.lineBreak).toBe("normal");
    expect(style.wordBreak).toBe("break-all");
    expect(style.hangingPunctuation).toBe("last");
  });
});
