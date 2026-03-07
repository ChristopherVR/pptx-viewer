import React from "react";

import { type PptxElement, hasTextProperties } from "pptx-viewer-core";
import { DEFAULT_BODY_INSET_TB_PX } from "../constants";
import { toCssWritingMode, toCssTextOrientation } from "./text-utils";

// ── Tab-size helper ──────────────────────────────────────────────────────

/**
 * Compute a CSS `tab-size` value from parsed tab stops.
 * If a single tab stop exists, use its position.
 * If multiple tab stops exist, use the average distance between consecutive stops.
 */
function computeTabSize(
  tabStops:
    | Array<{ position: number; align: "l" | "ctr" | "r" | "dec" }>
    | undefined,
): string | undefined {
  if (!tabStops || tabStops.length === 0) return undefined;

  if (tabStops.length === 1) {
    const pos = tabStops[0].position;
    return typeof pos === "number" && pos > 0
      ? `${Math.round(pos)}px`
      : undefined;
  }

  // Sort positions ascending, then compute average gap
  const positions = tabStops
    .map((t) => t.position)
    .filter((p) => typeof p === "number" && p > 0)
    .sort((a, b) => a - b);

  if (positions.length < 2) {
    return positions.length === 1 ? `${Math.round(positions[0])}px` : undefined;
  }

  let totalGap = 0;
  for (let i = 1; i < positions.length; i++) {
    totalGap += positions[i] - positions[i - 1];
  }
  const avgGap = totalGap / (positions.length - 1);
  return avgGap > 0 ? `${Math.round(avgGap)}px` : undefined;
}

export function getTextLayoutStyle(element: PptxElement): React.CSSProperties {
  if (!hasTextProperties(element)) return {};
  const verticalAlign = element.textStyle?.vAlign || "top";
  const writingMode = toCssWritingMode(element.textStyle?.textDirection);
  const textOrientation = toCssTextOrientation(
    element.textStyle?.textDirection,
  );
  const parsedColumnCount = Number(element.textStyle?.columnCount);
  const columnCount = Number.isFinite(parsedColumnCount)
    ? Math.max(1, Math.min(16, Math.round(parsedColumnCount)))
    : 1;
  const hasColumns = columnCount > 1;
  const justifyContent =
    verticalAlign === "middle"
      ? "center"
      : verticalAlign === "bottom"
        ? "flex-end"
        : "flex-start";

  // Tab-size: if multiple tab stops, use average distance; else first position.
  const tabStops = element.textStyle?.tabStops;
  const tabSize = computeTabSize(tabStops);

  // Text wrapping mode
  const textWrapNone = element.textStyle?.textWrap === "none";

  // Paragraph indentation — applied at global level only when no per-paragraph
  // indents are available (backward compat / single-level text).
  const hasParagraphIndents =
    hasTextProperties(element) &&
    element.paragraphIndents &&
    element.paragraphIndents.length > 0;
  const paragraphMarginLeft = element.textStyle?.paragraphMarginLeft;
  const paragraphIndent = element.textStyle?.paragraphIndent;
  const marginLeft =
    !hasParagraphIndents &&
    typeof paragraphMarginLeft === "number" &&
    paragraphMarginLeft !== 0
      ? paragraphMarginLeft
      : undefined;
  const textIndent =
    !hasParagraphIndents &&
    typeof paragraphIndent === "number" &&
    paragraphIndent !== 0
      ? paragraphIndent
      : undefined;

  const bodyTop = element.textStyle?.bodyInsetTop ?? DEFAULT_BODY_INSET_TB_PX;
  const bodyBottom =
    element.textStyle?.bodyInsetBottom ?? DEFAULT_BODY_INSET_TB_PX;

  const parsedColumnSpacing = Number(element.textStyle?.columnSpacing);
  const columnGap =
    Number.isFinite(parsedColumnSpacing) && parsedColumnSpacing > 0
      ? `${parsedColumnSpacing}px`
      : "0.75em";

  if (hasColumns) {
    return {
      display: "block",
      columnCount,
      columnGap,
      paddingTop: bodyTop + (element.textStyle?.paragraphSpacingBefore || 0),
      paddingBottom:
        bodyBottom + (element.textStyle?.paragraphSpacingAfter || 0),
      writingMode,
      textOrientation,
      tabSize: tabSize as string | undefined,
      marginLeft,
      textIndent,
      ...(textWrapNone
        ? {
            whiteSpace: "nowrap" as const,
            overflow: "visible" as const,
          }
        : {}),
    };
  }
  return {
    display: "flex",
    flexDirection: "column",
    justifyContent,
    paddingTop: bodyTop + (element.textStyle?.paragraphSpacingBefore || 0),
    paddingBottom: bodyBottom + (element.textStyle?.paragraphSpacingAfter || 0),
    writingMode,
    textOrientation,
    tabSize: tabSize as string | undefined,
    marginLeft,
    textIndent,
    ...(textWrapNone
      ? {
          whiteSpace: "nowrap" as const,
          overflow: "visible" as const,
        }
      : {}),
  };
}
