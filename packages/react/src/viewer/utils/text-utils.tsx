import React from "react";

import {
  PptxElement,
  TextSegment,
  TextStyle,
  hasTextProperties,
} from "pptx-viewer-core";
import {
  DEFAULT_TEXT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  HYPERLINK_COLOR,
  DEFAULT_BODY_INSET_LR_PX,
  DEFAULT_BODY_INSET_TB_PX,
} from "../constants";
import { cloneTextStyle } from "./clone";
import { normalizeHexColor } from "./color";

export type ListMode = "none" | "bullet" | "number";

export function createUniformTextSegments(
  text: string,
  style: TextStyle | undefined,
): TextSegment[] {
  return [
    {
      text,
      style: cloneTextStyle(style) || {},
    },
  ];
}

export function getElementTextContent(element: PptxElement): string {
  if (!hasTextProperties(element)) return "";
  if (typeof element.text === "string") return element.text;
  if (!element.textSegments || element.textSegments.length === 0) return "";
  return element.textSegments
    .map((segment: TextSegment) => String(segment.text || ""))
    .join("");
}

export function stripListPrefix(line: string): string {
  return line.replace(/^\s*(?:[-*•◦▪]\s+|\d+[\.\)]\s+)/, "");
}

export function detectListMode(text: string): ListMode {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return "none";
  const allBullets = lines.every((line) => /^[-*•◦▪]\s+/.test(line));
  if (allBullets) return "bullet";
  const allNumbers = lines.every((line) => /^\d+[\.\)]\s+/.test(line));
  if (allNumbers) return "number";
  return "none";
}

export function formatTextAsList(text: string, mode: ListMode): string {
  const lines = text.split("\n");
  if (mode === "none") {
    return lines.map((line) => stripListPrefix(line)).join("\n");
  }
  if (mode === "bullet") {
    return lines
      .map((line) => {
        if (line.trim().length === 0) return line;
        return `• ${stripListPrefix(line)}`;
      })
      .join("\n");
  }
  let visibleIndex = 0;
  return lines
    .map((line) => {
      if (line.trim().length === 0) return line;
      visibleIndex += 1;
      return `${visibleIndex}. ${stripListPrefix(line)}`;
    })
    .join("\n");
}

export function createEditorId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function getTextStyleForElement(
  element: PptxElement,
  fallbackColor: string,
): React.CSSProperties {
  if (!hasTextProperties(element)) return { color: fallbackColor };
  const textDecorationTokens: string[] = [];
  if (element.textStyle?.underline || element.textStyle?.hyperlink) {
    textDecorationTokens.push("underline");
  }
  if (element.textStyle?.strikethrough) {
    textDecorationTokens.push("line-through");
  }
  const isDoubleStrike =
    element.textStyle?.strikethrough &&
    element.textStyle?.strikeType === "dblStrike";
  const textDecorationStyle: React.CSSProperties["textDecorationStyle"] =
    isDoubleStrike ? "double" : undefined;
  const hasItalicRuns =
    element.textStyle?.italic ||
    Boolean(
      element.textSegments?.some(
        (segment: TextSegment) => segment.style?.italic,
      ),
    );
  const isRtl = element.textStyle?.rtl === true;
  const resolvedTextColor = element.textStyle?.hyperlink
    ? normalizeHexColor(element.textStyle?.color, HYPERLINK_COLOR)
    : normalizeHexColor(element.textStyle?.color, fallbackColor);
  const bodyTop = element.textStyle?.bodyInsetTop ?? DEFAULT_BODY_INSET_TB_PX;
  const bodyBottom =
    element.textStyle?.bodyInsetBottom ?? DEFAULT_BODY_INSET_TB_PX;
  const bodyLeft = element.textStyle?.bodyInsetLeft ?? DEFAULT_BODY_INSET_LR_PX;
  const bodyRight =
    element.textStyle?.bodyInsetRight ?? DEFAULT_BODY_INSET_LR_PX;

  // Vertical text direction
  const writingMode = toCssWritingMode(element.textStyle?.textDirection);
  const textOrientation = toCssTextOrientation(
    element.textStyle?.textDirection,
  );

  return {
    color: resolvedTextColor,
    textAlign: ((): React.CSSProperties["textAlign"] => {
      const a = element.textStyle?.align;
      if (a === "justLow" || a === "dist" || a === "thaiDist") return "justify";
      return a || (isRtl ? "right" : "left");
    })(),
    direction: isRtl ? "rtl" : "ltr",
    unicodeBidi: isRtl ? "plaintext" : undefined,
    fontSize: element.textStyle?.fontSize || DEFAULT_TEXT_FONT_SIZE,
    fontWeight: element.textStyle?.bold ? 700 : 400,
    fontStyle: element.textStyle?.italic ? "italic" : "normal",
    textDecorationLine:
      textDecorationTokens.length > 0 ? textDecorationTokens.join(" ") : "none",
    textDecorationStyle,
    fontFamily: element.textStyle?.fontFamily || DEFAULT_FONT_FAMILY,
    lineHeight: resolveLineHeight(element.textStyle, hasItalicRuns),
    paddingTop: bodyTop + (hasItalicRuns ? 1 : 0),
    paddingBottom: bodyBottom + (hasItalicRuns ? 1 : 0),
    paddingLeft: bodyLeft + (element.textStyle?.paragraphMarginLeft || 0),
    paddingRight: bodyRight + (element.textStyle?.paragraphMarginRight || 0),
    textIndent: element.textStyle?.paragraphIndent || 0,
    overflow: element.textStyle?.autoFit ? "hidden" : undefined,
    writingMode,
    textOrientation,
    ...(element.textStyle?.textWrap === "none"
      ? { whiteSpace: "nowrap" as const, overflow: "visible" as const }
      : {}),
    // Auto-fit: use OOXML-provided fontScale/lnSpcReduction when available,
    // otherwise fall back to heuristic estimation.
    ...(element.textStyle?.autoFit && hasTextProperties(element)
      ? (() => {
          const baseFontSize =
            element.textStyle?.fontSize || DEFAULT_TEXT_FONT_SIZE;
          const result: React.CSSProperties = {};

          // normAutofit with explicit fontScale — use the exact percentage
          if (
            element.textStyle?.autoFitFontScale !== undefined &&
            element.textStyle.autoFitFontScale > 0 &&
            element.textStyle.autoFitFontScale < 1
          ) {
            result.fontSize = Math.max(
              6,
              Math.round(baseFontSize * element.textStyle.autoFitFontScale),
            );
          } else if (element.textStyle?.autoFitMode !== "normal") {
            // spAutoFit (shrink) — heuristic estimation
            const textLength = (element.text ?? "").length;
            const lineHeight = element.textStyle?.lineSpacingExactPt
              ? element.textStyle.lineSpacingExactPt / baseFontSize
              : element.textStyle?.lineSpacing || (hasItalicRuns ? 1.35 : 1.25);
            const approxCharsPerLine = Math.max(
              1,
              Math.floor(element.width / (baseFontSize * 0.6)),
            );
            const estimatedLines = Math.max(
              1,
              Math.ceil(textLength / approxCharsPerLine),
            );
            const requiredHeight = estimatedLines * baseFontSize * lineHeight;
            const availableHeight = element.height - (bodyTop + bodyBottom);
            if (requiredHeight > availableHeight && availableHeight > 0) {
              const scale = Math.max(0.5, availableHeight / requiredHeight);
              result.fontSize = Math.max(6, Math.round(baseFontSize * scale));
            }
          }

          // normAutofit with lnSpcReduction — reduce line height
          if (
            element.textStyle?.autoFitLineSpacingReduction !== undefined &&
            element.textStyle.autoFitLineSpacingReduction > 0
          ) {
            const baseLineHeight =
              typeof element.textStyle?.lineSpacing === "number"
                ? element.textStyle.lineSpacing
                : hasItalicRuns
                  ? 1.35
                  : 1.25;
            result.lineHeight =
              baseLineHeight *
              (1 - element.textStyle.autoFitLineSpacingReduction);
          }

          return result;
        })()
      : {}),
  };
}

export function toCssWritingMode(
  textDirection: TextStyle["textDirection"] | undefined,
): React.CSSProperties["writingMode"] | undefined {
  if (textDirection === "vertical") return "vertical-rl";
  if (textDirection === "vertical270") return "vertical-lr";
  return undefined;
}

/**
 * Resolve CSS `text-orientation` for vertical writing modes.
 *
 * - `"vertical"` (East Asian vertical text): uses `"mixed"` so CJK glyphs
 *   stay upright while Latin glyphs are rotated.
 * - `"vertical270"` (Western text rotated 270 degrees): uses `"sideways"` so
 *   all glyphs are uniformly rotated sideways.
 * - Horizontal text: returns `undefined` (no text-orientation override needed).
 */
export function toCssTextOrientation(
  textDirection: TextStyle["textDirection"] | undefined,
): React.CSSProperties["textOrientation"] | undefined {
  if (textDirection === "vertical") return "mixed";
  if (textDirection === "vertical270") return "sideways";
  return undefined;
}

/**
 * Resolve CSS `line-height` from TextStyle.
 * If `lineSpacingExactPt` is set (exact point mode from spcPts), return a fixed `Xpt` string.
 * If `lineSpacing` is set (proportional mode from spcPct), return the multiplier.
 * Otherwise use a sensible default.
 */
function resolveLineHeight(
  textStyle: TextStyle | undefined,
  hasItalicRuns: boolean,
): string | number {
  if (
    typeof textStyle?.lineSpacingExactPt === "number" &&
    textStyle.lineSpacingExactPt > 0
  ) {
    return `${textStyle.lineSpacingExactPt}pt`;
  }
  return textStyle?.lineSpacing || (hasItalicRuns ? 1.35 : 1.25);
}
