import React from "react";

import {
  type PptxElement,
  type TextStyle,
  type BulletInfo,
  hasTextProperties,
} from "pptx-viewer-core";
import type { ElementAnimationState } from "./animation-timeline";
import type { FieldSubstitutionContext } from "./text-field-substitution";
import type { ElementFindHighlights } from "./text-segment-helpers";
import { renderSingleSegment } from "./text-segment-render";
import {
  type ParagraphEntry,
  wrapWithTextBuildAnimation,
} from "./text-animation";
import { getKinsokuLineBreakStyles } from "./kinsoku-styles";

/**
 * Resolve per-paragraph RTL direction from segment styles.
 * Returns `true` for RTL, `false` for explicit LTR, or `undefined` when
 * no explicit direction is set (inherits element-level default).
 */
export function resolveParagraphRtl(
  paraSegments: ReadonlyArray<ParagraphEntry>,
  elementRtl: boolean | undefined,
): boolean | undefined {
  for (const entry of paraSegments) {
    const segRtl = entry.segment.style?.rtl;
    if (segRtl !== undefined) {
      return segRtl;
    }
  }
  return elementRtl;
}

/**
 * Resolve per-paragraph explicit text alignment from segment styles.
 * Returns the OOXML alignment value if any segment carries an explicit `align`
 * property, or `undefined` when no explicit alignment is set.
 */
export function resolveParagraphAlign(
  paraSegments: ReadonlyArray<ParagraphEntry>,
  elementAlign: TextStyle["align"] | undefined,
): TextStyle["align"] | undefined {
  for (const entry of paraSegments) {
    const segAlign = entry.segment.style?.align;
    if (segAlign !== undefined) {
      return segAlign;
    }
  }
  return elementAlign;
}

/**
 * Map OOXML alignment + RTL direction to a CSS `textAlign` value.
 *
 * When no explicit alignment is set and the paragraph is RTL, defaults to
 * `"right"`. For LTR, defaults to `"left"`. Special OOXML alignment values
 * (`justLow`, `dist`, `thaiDist`) map to CSS `"justify"`.
 */
export function resolveCssTextAlign(
  align: TextStyle["align"] | undefined,
  isRtl: boolean,
): React.CSSProperties["textAlign"] | undefined {
  if (align === "justLow" || align === "dist" || align === "thaiDist") {
    return "justify";
  }
  if (align) return align as React.CSSProperties["textAlign"];
  // Default: RTL paragraphs align right, LTR paragraphs align left
  return isRtl ? "right" : undefined;
}

function groupSegmentsIntoParagraphs(
  segments: ReadonlyArray<{
    text: string;
    style: TextStyle;
    bulletInfo?: BulletInfo;
    fieldType?: string;
    equationXml?: Record<string, unknown>;
    equationNumber?: string;
    rubyText?: string;
    rubyAlignment?: string;
    rubyFontSize?: number;
    rubyStyle?: TextStyle;
  }>,
): Array<Array<ParagraphEntry>> {
  const paragraphs: Array<Array<ParagraphEntry>> = [];
  let current: Array<ParagraphEntry> = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.text === "\n") {
      paragraphs.push(current);
      current = [];
    } else {
      current.push({ segment: seg, globalIndex: i });
    }
  }
  if (current.length > 0 || paragraphs.length === 0) {
    paragraphs.push(current);
  }

  return paragraphs;
}

export function renderTextSegments(
  element: PptxElement,
  fallbackColor: string,
  emptyFallback?: string,
  findHighlights?: ElementFindHighlights,
  onHyperlinkClick?: (url: string) => void,
  fieldContext?: FieldSubstitutionContext,
  /** Per-sub-element animation states for text build animations. */
  subElementAnimStates?: ReadonlyMap<string, ElementAnimationState>,
  /** When provided, these segments replace element.textSegments for rendering (used by linked text box overflow). */
  segmentOverrides?: ReadonlyArray<{ text: string; style: TextStyle; bulletInfo?: BulletInfo; fieldType?: string; equationXml?: Record<string, unknown>; equationNumber?: string; isParagraphBreak?: boolean; rubyText?: string; rubyAlignment?: string; rubyFontSize?: number; rubyStyle?: TextStyle }>,
): React.ReactNode {
  if (!hasTextProperties(element)) return emptyFallback || null;

  const effectiveSegments = segmentOverrides ?? element.textSegments;

  if (!effectiveSegments || effectiveSegments.length === 0) {
    if (!element.text && element.promptText) {
      return (
        <span
          style={{
            opacity: 0.5,
            color: "#888888",
            pointerEvents: "none",
          }}
        >
          {element.promptText}
        </span>
      );
    }
    return element.text || emptyFallback || "";
  }

  const paragraphs = groupSegmentsIntoParagraphs(effectiveSegments);
  const paragraphIndents = hasTextProperties(element)
    ? element.paragraphIndents
    : undefined;
  const elementRtl = hasTextProperties(element)
    ? element.textStyle?.rtl
    : undefined;

  const elementAlign = hasTextProperties(element)
    ? element.textStyle?.align
    : undefined;

  return paragraphs.map((paraSegments, paraIndex) => {
    const paraIndent = paragraphIndents?.[paraIndex];
    const rawMarginLeft =
      typeof paraIndent?.marginLeft === "number" && paraIndent.marginLeft !== 0
        ? paraIndent.marginLeft
        : undefined;
    const rawTextIndent =
      typeof paraIndent?.indent === "number" && paraIndent.indent !== 0
        ? paraIndent.indent
        : undefined;

    const firstSeg = paraSegments[0];
    const bulletInfo = firstSeg?.segment.bulletInfo;
    const hasBullet = bulletInfo && !bulletInfo.none;
    const paraRtl = resolveParagraphRtl(paraSegments, elementRtl);
    const isRtlParagraph = paraRtl === true;

    // Resolve explicit paragraph alignment from segment styles
    const paraAlign = resolveParagraphAlign(paraSegments, elementAlign);
    const cssTextAlign = resolveCssTextAlign(paraAlign, isRtlParagraph);

    // For RTL paragraphs, swap marginLeft/textIndent to marginRight
    // so bullets and indentation appear on the correct (right) side.
    const paraMarginLeft = isRtlParagraph ? undefined : rawMarginLeft;
    const paraMarginRight = isRtlParagraph ? rawMarginLeft : undefined;
    const paraTextIndent = rawTextIndent;

    // Per-paragraph kinsoku line-breaking styles from the first segment's style.
    // Paragraph-level properties (eaLineBreak, hangingPunctuation, latinLineBreak)
    // are stored on the TextStyle of paragraph segments.
    const paraKinsokuStyle = getKinsokuLineBreakStyles(firstSeg?.segment.style);
    const hasParaKinsoku = Object.keys(paraKinsokuStyle).length > 0;

    const paraStyle: React.CSSProperties = {
      ...paraKinsokuStyle,
    };
    if (paraMarginLeft !== undefined) {
      paraStyle.marginLeft = paraMarginLeft;
    }
    if (paraMarginRight !== undefined) {
      paraStyle.marginRight = paraMarginRight;
    }
    if (paraTextIndent !== undefined) {
      paraStyle.textIndent = paraTextIndent;
    }
    if (paraRtl !== undefined) {
      paraStyle.direction = paraRtl ? "rtl" : "ltr";
      // Use 'embed' so the paragraph establishes a BiDi embedding level.
      // This ensures numbers within RTL text render LTR naturally per the
      // Unicode Bidi Algorithm, while 'plaintext' is used as a fallback
      // only at the element/body level.
      paraStyle.unicodeBidi = "embed";
    }
    if (cssTextAlign !== undefined) {
      paraStyle.textAlign = cssTextAlign;
    }

    const needsWrapper =
      paraMarginLeft !== undefined ||
      paraMarginRight !== undefined ||
      paraTextIndent !== undefined ||
      hasBullet ||
      paraRtl !== undefined ||
      cssTextAlign !== undefined ||
      hasParaKinsoku;

    const renderedSegments = paraSegments.map(({ segment, globalIndex }) =>
      renderSingleSegment(
        element,
        segment,
        globalIndex,
        fallbackColor,
        findHighlights,
        hasBullet && globalIndex === firstSeg.globalIndex
          ? bulletInfo
          : undefined,
        onHyperlinkClick,
        fieldContext,
        paraRtl,
      ),
    );

    const wrappedContent = wrapWithTextBuildAnimation(
      element.id,
      paraIndex,
      renderedSegments,
      paraSegments,
      subElementAnimStates,
    );

    if (!needsWrapper) {
      return (
        <React.Fragment key={`${element.id}-para-${paraIndex}`}>
          {wrappedContent}
          {paraIndex < paragraphs.length - 1 ? <br /> : null}
        </React.Fragment>
      );
    }

    return (
      <div key={`${element.id}-para-${paraIndex}`} style={paraStyle}>
        {wrappedContent}
      </div>
    );
  });
}
