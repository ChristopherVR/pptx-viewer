import React from "react";

import {
  type PptxElement,
  type TextStyle,
  type BulletInfo,
  hasTextProperties,
} from "../../core";
import type { ElementAnimationState } from "./animation-timeline";
import type { FieldSubstitutionContext } from "./text-field-substitution";
import type { ElementFindHighlights } from "./text-segment-helpers";
import { renderSingleSegment } from "./text-segment-render";
import {
  type ParagraphEntry,
  wrapWithTextBuildAnimation,
} from "./text-animation";

/**
 * Resolve per-paragraph RTL direction from segment styles.
 * Returns `true` for RTL, `false` for explicit LTR, or `undefined` when
 * no explicit direction is set (inherits element-level default).
 */
function resolveParagraphRtl(
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

function groupSegmentsIntoParagraphs(
  segments: ReadonlyArray<{
    text: string;
    style: TextStyle;
    bulletInfo?: BulletInfo;
    fieldType?: string;
    equationXml?: Record<string, unknown>;
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
): React.ReactNode {
  if (!hasTextProperties(element)) return emptyFallback || null;
  if (!element.textSegments || element.textSegments.length === 0) {
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

  const paragraphs = groupSegmentsIntoParagraphs(element.textSegments);
  const paragraphIndents = hasTextProperties(element)
    ? element.paragraphIndents
    : undefined;
  const elementRtl = hasTextProperties(element)
    ? element.textStyle?.rtl
    : undefined;

  return paragraphs.map((paraSegments, paraIndex) => {
    const paraIndent = paragraphIndents?.[paraIndex];
    const paraMarginLeft =
      typeof paraIndent?.marginLeft === "number" && paraIndent.marginLeft !== 0
        ? paraIndent.marginLeft
        : undefined;
    const paraTextIndent =
      typeof paraIndent?.indent === "number" && paraIndent.indent !== 0
        ? paraIndent.indent
        : undefined;

    const firstSeg = paraSegments[0];
    const bulletInfo = firstSeg?.segment.bulletInfo;
    const hasBullet = bulletInfo && !bulletInfo.none;
    const paraRtl = resolveParagraphRtl(paraSegments, elementRtl);

    const paraStyle: React.CSSProperties = {};
    if (paraMarginLeft !== undefined) {
      paraStyle.marginLeft = paraMarginLeft;
    }
    if (paraTextIndent !== undefined) {
      paraStyle.textIndent = paraTextIndent;
    }
    if (paraRtl !== undefined) {
      paraStyle.direction = paraRtl ? "rtl" : "ltr";
      paraStyle.unicodeBidi = "plaintext";
    }

    const needsWrapper =
      paraMarginLeft !== undefined ||
      paraTextIndent !== undefined ||
      hasBullet ||
      paraRtl !== undefined;

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
