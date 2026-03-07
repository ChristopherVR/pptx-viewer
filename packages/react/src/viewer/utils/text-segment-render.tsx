import React from "react";

import {
  type PptxElement,
  type TextStyle,
  type BulletInfo,
} from "pptx-viewer-core";
import {
  DEFAULT_TEXT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  HYPERLINK_COLOR,
} from "../constants";
import { normalizeHexColor } from "./color";
import { hasDistinctScriptFonts } from "./unicode-script-detection";
import {
  substituteFieldText,
  type FieldSubstitutionContext,
} from "./text-field-substitution";
import {
  buildTextFillCss,
  buildTextShadowCss,
  buildTextGlowFilter,
  buildTextReflectionCss,
  buildTextInnerShadowCss,
  buildTextBlurFilter,
  buildTextHslFilter,
  getTextAlphaOpacity,
} from "./text-effects";
import {
  type ElementFindHighlights,
  renderSegmentContent,
  renderEquationSegment,
  renderPictureBullet,
  resolveUnderlineDecorationStyle,
} from "./text-segment-helpers";

/** Combine all text run CSS filter effects into a single chain. */
function buildTextRunFilterChain(style: TextStyle): string | undefined {
  const parts: string[] = [];
  const glow = buildTextGlowFilter(style);
  if (glow) parts.push(glow);
  const innerShdw = buildTextInnerShadowCss(style);
  if (innerShdw) parts.push(innerShdw);
  const blur = buildTextBlurFilter(style);
  if (blur) parts.push(blur);
  const hsl = buildTextHslFilter(style);
  if (hsl) parts.push(hsl);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * Render a single text segment as a styled `<span>`.
 * When `bulletInfo` is provided, the bullet character/number is rendered with
 * its own font family, size, and colour.
 */
export function renderSingleSegment(
  element: PptxElement & Partial<{ textStyle: TextStyle }>,
  segment: {
    style?: TextStyle;
    text?: string;
    hyperlink?: string;
    bulletInfo?: BulletInfo;
    fieldType?: string;
    equationXml?: Record<string, unknown>;
  },
  segmentIndex: number,
  fallbackColor: string,
  findHighlights: ElementFindHighlights | undefined,
  bulletInfo: BulletInfo | undefined,
  onHyperlinkClick?: (url: string) => void,
  fieldContext?: FieldSubstitutionContext,
  /** Resolved paragraph-level RTL direction for BiDi isolation. */
  paragraphRtl?: boolean,
): React.ReactNode {
  // ── Equation segments: render inline MathML ──
  if (segment.equationXml) {
    return renderEquationSegment(element.id, segmentIndex, segment.equationXml);
  }

  const segmentStyle = segment.style || {};
  const textValue = substituteFieldText(
    segment.text || "",
    segment.fieldType,
    fieldContext,
  );
  const lines = textValue.split("\n");
  const textDecorationTokens: string[] = [];
  if (segmentStyle.underline || segmentStyle.hyperlink) {
    textDecorationTokens.push("underline");
  }
  if (segmentStyle.strikethrough) {
    textDecorationTokens.push("line-through");
  }

  // Double strikethrough needs a different text-decoration-style
  const isDoubleStrike =
    segmentStyle.strikethrough && segmentStyle.strikeType === "dblStrike";
  const resolvedSegmentColor = segmentStyle.hyperlink
    ? normalizeHexColor(
        segmentStyle.color || element.textStyle?.color,
        HYPERLINK_COLOR,
      )
    : normalizeHexColor(
        segmentStyle.color || element.textStyle?.color,
        fallbackColor,
      );

  // Underline style variants → CSS text-decoration-style
  const textDecorationStyle = resolveUnderlineDecorationStyle(
    !!isDoubleStrike,
    segmentStyle.underlineStyle,
  );

  // Superscript / subscript via baseline shift
  const baselineShift =
    typeof segmentStyle.baseline === "number" && segmentStyle.baseline !== 0
      ? segmentStyle.baseline > 0
        ? "super"
        : "sub"
      : undefined;
  const baselineFontScale =
    typeof segmentStyle.baseline === "number" && segmentStyle.baseline !== 0
      ? 0.65
      : 1;

  // Character spacing → CSS letter-spacing (hundredths of a point → px)
  const letterSpacing =
    typeof segmentStyle.characterSpacing === "number" &&
    segmentStyle.characterSpacing !== 0
      ? `${(segmentStyle.characterSpacing / 100) * (96 / 72)}px`
      : undefined;

  // Kerning → CSS font-kerning
  const fontKerning: React.CSSProperties["fontKerning"] =
    typeof segmentStyle.kerning === "number"
      ? segmentStyle.kerning === 0
        ? "none"
        : "normal"
      : undefined;

  // Text fill: gradient or pattern → CSS background-clip:text technique
  const textFillStyles = buildTextFillCss(segmentStyle);

  // Build the base text style
  const rawFontSize = (segmentStyle.fontSize ||
    element.textStyle?.fontSize ||
    DEFAULT_TEXT_FONT_SIZE) as number;
  // Apply normAutofit fontScale when present (e.g. 0.9 = 90%)
  const autoFitScale =
    element.textStyle?.autoFitFontScale !== undefined &&
    element.textStyle.autoFitFontScale > 0 &&
    element.textStyle.autoFitFontScale < 1
      ? element.textStyle.autoFitFontScale
      : 1;
  const baseFontSize = rawFontSize * autoFitScale;
  const baseFontFamily =
    segmentStyle.fontFamily ||
    element.textStyle?.fontFamily ||
    DEFAULT_FONT_FAMILY;

  // Per-script font info for Unicode font fallback
  const scriptFonts = {
    latin: baseFontFamily,
    eastAsia:
      segmentStyle.eastAsiaFont ||
      element.textStyle?.eastAsiaFont ||
      baseFontFamily,
    complexScript:
      segmentStyle.complexScriptFont ||
      element.textStyle?.complexScriptFont ||
      baseFontFamily,
    symbol:
      segmentStyle.symbolFont ||
      element.textStyle?.symbolFont ||
      baseFontFamily,
  };
  const needsScriptFonts = hasDistinctScriptFonts(scriptFonts);

  const spanStyle: React.CSSProperties = {
    color: resolvedSegmentColor,
    fontSize: baseFontSize * baselineFontScale,
    fontWeight: segmentStyle.bold ? 700 : 400,
    fontStyle: segmentStyle.italic ? "italic" : "normal",
    textDecorationLine:
      textDecorationTokens.length > 0 ? textDecorationTokens.join(" ") : "none",
    textDecorationStyle,
    fontFamily: baseFontFamily,
    verticalAlign: baselineShift,
    letterSpacing,
    fontKerning,
    backgroundColor: textFillStyles
      ? undefined
      : segmentStyle.highlightColor
        ? normalizeHexColor(segmentStyle.highlightColor, "transparent")
        : undefined,
    ...textFillStyles,
    textDecorationColor: segmentStyle.underlineColor
      ? normalizeHexColor(segmentStyle.underlineColor, undefined)
      : undefined,
    WebkitTextStroke:
      segmentStyle.textOutlineWidth && segmentStyle.textOutlineColor
        ? `${segmentStyle.textOutlineWidth}px ${normalizeHexColor(segmentStyle.textOutlineColor, "#000000")}`
        : segmentStyle.textOutlineWidth
          ? `${segmentStyle.textOutlineWidth}px currentColor`
          : undefined,
    paintOrder: segmentStyle.textOutlineWidth ? "stroke fill" : undefined,
    textShadow: buildTextShadowCss(segmentStyle),
    filter: buildTextRunFilterChain(segmentStyle),
    opacity: getTextAlphaOpacity(segmentStyle),
    WebkitBoxReflect: buildTextReflectionCss(segmentStyle),
  };

  // Per-run BiDi isolation
  const runRtl = segmentStyle.rtl;
  if (runRtl !== undefined && runRtl !== paragraphRtl) {
    spanStyle.direction = runRtl ? "rtl" : "ltr";
    spanStyle.unicodeBidi = "isolate";
  }

  // Apply bullet-specific styling overrides
  if (bulletInfo) {
    if (bulletInfo.fontFamily) {
      spanStyle.fontFamily = bulletInfo.fontFamily;
    }
    if (typeof bulletInfo.sizePts === "number") {
      spanStyle.fontSize = bulletInfo.sizePts * baselineFontScale;
    } else if (typeof bulletInfo.sizePercent === "number") {
      spanStyle.fontSize =
        baseFontSize * (bulletInfo.sizePercent / 100) * baselineFontScale;
    }
    if (bulletInfo.color) {
      spanStyle.color = normalizeHexColor(
        bulletInfo.color,
        resolvedSegmentColor,
      );
    }
  }

  // Picture bullet: render as <img> instead of text
  if (bulletInfo?.imageDataUrl || bulletInfo?.imageRelId) {
    return renderPictureBullet(
      element.id,
      segmentIndex,
      bulletInfo,
      baseFontSize,
    );
  }

  // Resolve the hyperlink URL
  const hyperlinkUrl = segmentStyle.hyperlink || segment.hyperlink;

  const spanNode = (
    <span key={`${element.id}-seg-${segmentIndex}`} style={spanStyle}>
      {renderSegmentContent(
        element.id,
        segmentIndex,
        textValue,
        lines,
        needsScriptFonts,
        scriptFonts,
        baseFontFamily,
        findHighlights,
      )}
    </span>
  );

  // Wrap hyperlinked text in a clickable element when a handler is available
  if (hyperlinkUrl && onHyperlinkClick) {
    return (
      <span
        key={`${element.id}-seg-${segmentIndex}-link`}
        role="link"
        tabIndex={0}
        style={{ cursor: "pointer", pointerEvents: "auto" }}
        onClick={(e) => {
          e.stopPropagation();
          onHyperlinkClick(hyperlinkUrl);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onHyperlinkClick(hyperlinkUrl);
          }
        }}
      >
        {spanNode}
      </span>
    );
  }

  return spanNode;
}
