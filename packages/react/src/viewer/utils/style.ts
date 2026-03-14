/**
 * Style utilities for the PowerPoint viewer/editor.
 *
 * Provides stroke dash normalization, compound-line box-shadow generation,
 * SVG dasharray computation, element transform strings, and drawing-unit parsing.
 * Transition styles are re-exported from `style-transitions`.
 */
import type { StrokeDashType, PptxElement } from "pptx-viewer-core";
import { clampUnitInterval } from "./color";

export { getPresentationTransitionStyle } from "./style-transitions";

/**
 * Normalizes a raw stroke dash type string to a valid `StrokeDashType` enum value.
 * Performs case-insensitive matching against all OOXML dash types.
 * @param value - Raw dash type string (e.g. "lgDash", "SysDot").
 * @returns The canonical `StrokeDashType`, or `undefined` if unrecognized.
 */
export function normalizeStrokeDashType(
  value: StrokeDashType | string | undefined,
): StrokeDashType | undefined {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return undefined;

  const dashMap: Record<string, StrokeDashType> = {
    solid: "solid",
    dot: "dot",
    dash: "dash",
    lgdash: "lgDash",
    dashdot: "dashDot",
    lgdashdot: "lgDashDot",
    lgdashdotdot: "lgDashDotDot",
    sysdot: "sysDot",
    sysdash: "sysDash",
    sysdashdot: "sysDashDot",
    sysdashdotdot: "sysDashDotDot",
    custom: "custom",
  };
  return dashMap[normalized];
}

/**
 * Maps an OOXML stroke dash type to a CSS `border-style` value.
 * For compound lines (dbl, thickThin, etc.) returns "solid" because the
 * compound effect is rendered via box-shadow instead.
 * @param dashType - The normalized dash type.
 * @param compoundLine - Optional compound line type (e.g. "dbl", "tri").
 * @returns A CSS border-style value ("solid", "dotted", "dashed"), or `undefined`.
 */
export function getCssBorderDashStyle(
  dashType: StrokeDashType | undefined,
  compoundLine?: string,
): React.CSSProperties["borderStyle"] | undefined {
  // For compound lines, we use box-shadow instead of border-style for better rendering
  // So return solid to keep the base border intact for box-shadow to work with
  if (
    compoundLine === "dbl" ||
    compoundLine === "thickThin" ||
    compoundLine === "thinThick" ||
    compoundLine === "tri"
  ) {
    return "solid";
  }
  if (!dashType || dashType === "solid") return "solid";
  if (dashType === "dot" || dashType === "sysDot") return "dotted";
  return "dashed";
}

/**
 * Generate box-shadow approximation for compound line types.
 * Returns a box-shadow string that can be combined with other shadows.
 *
 * Uses concentric inset box-shadows with spread to create parallel border
 * lines on all four sides of the shape. The element's CSS border is set to
 * the outermost line, and inner lines are rendered as inset box-shadows.
 */
export function getCompoundLineBoxShadow(
  compoundLine: string | undefined,
  strokeWidth: number,
  strokeColor: string,
): string | undefined {
  if (!compoundLine || compoundLine === "sng" || strokeWidth <= 0) {
    return undefined;
  }

  const color = strokeColor || "#000000";
  const width = Math.max(1, strokeWidth);

  switch (compoundLine) {
    case "dbl": {
      // Double line: outer line is the CSS border, inner line via inset box-shadow.
      // Outer border width = ~35% of total, gap = ~30%, inner = ~35%
      const outerW = Math.max(1, Math.round(width * 0.35));
      const gap = Math.max(1, Math.round(width * 0.3));
      const innerW = Math.max(1, Math.round(width * 0.35));
      // Inset shadow: offset inward past outer border + gap, spread = inner line width
      const inset = outerW + gap;
      return `inset 0 0 0 ${inset}px transparent, inset 0 0 0 ${inset + innerW}px ${color}`;
    }

    case "thickThin": {
      // Outer thick + inner thin with gap
      const outerW = Math.max(2, Math.round(width * 0.5));
      const gap = Math.max(1, Math.round(width * 0.25));
      const innerW = Math.max(1, Math.round(width * 0.25));
      const inset = outerW + gap;
      return `inset 0 0 0 ${inset}px transparent, inset 0 0 0 ${inset + innerW}px ${color}`;
    }

    case "thinThick": {
      // Outer thin + inner thick with gap
      const outerW = Math.max(1, Math.round(width * 0.25));
      const gap = Math.max(1, Math.round(width * 0.25));
      const innerW = Math.max(2, Math.round(width * 0.5));
      const inset = outerW + gap;
      return `inset 0 0 0 ${inset}px transparent, inset 0 0 0 ${inset + innerW}px ${color}`;
    }

    case "tri": {
      // Three parallel lines: outer border, middle inset, inner inset
      const lineW = Math.max(1, Math.round(width * 0.22));
      const gap = Math.max(1, Math.round(width * 0.17));
      const inset1 = lineW + gap;
      const inset2 = inset1 + lineW + gap;
      return [
        `inset 0 0 0 ${inset1}px transparent`,
        `inset 0 0 0 ${inset1 + lineW}px ${color}`,
        `inset 0 0 0 ${inset2}px transparent`,
        `inset 0 0 0 ${inset2 + lineW}px ${color}`,
      ].join(", ");
    }

    default:
      return undefined;
  }
}

/**
 * Computes the CSS border width for the outermost line of a compound line style.
 *
 * For compound types the CSS border renders the outer line, while inner lines
 * are rendered via `getCompoundLineBoxShadow`. This function returns the
 * correct outer border width for each compound type.
 *
 * @param compoundLine - The compound line type (e.g. "dbl", "tri").
 * @param strokeWidth - Total stroke width in pixels.
 * @returns The outer border width in pixels, or the original strokeWidth for "sng"/undefined.
 */
export function getCompoundLineBorderWidth(
  compoundLine: string | undefined,
  strokeWidth: number,
): number {
  if (!compoundLine || compoundLine === "sng" || strokeWidth <= 0) {
    return strokeWidth;
  }

  const width = Math.max(1, strokeWidth);

  switch (compoundLine) {
    case "dbl":
      return Math.max(1, Math.round(width * 0.35));
    case "thickThin":
      return Math.max(2, Math.round(width * 0.5));
    case "thinThick":
      return Math.max(1, Math.round(width * 0.25));
    case "tri":
      return Math.max(1, Math.round(width * 0.22));
    default:
      return strokeWidth;
  }
}

/**
 * Computes a complete set of CSS properties for rendering compound line borders.
 *
 * For single or undefined compound types, returns standard border properties.
 * For double, thickThin, thinThick, and triple types, returns border properties
 * for the outer line plus box-shadow for inner parallel lines.
 *
 * @param compoundLine - The compound line type from `a:ln/@cmpd`.
 * @param strokeColor - Resolved stroke colour (with opacity applied).
 * @param strokeWidth - Total stroke width in pixels.
 * @returns CSS properties to apply to the shape container element.
 */
export function getCompoundLineStyle(
  compoundLine: string | undefined,
  strokeColor: string,
  strokeWidth: number,
): React.CSSProperties {
  if (!compoundLine || compoundLine === "sng" || strokeWidth <= 0) {
    return {};
  }

  const borderWidth = getCompoundLineBorderWidth(compoundLine, strokeWidth);
  const boxShadow = getCompoundLineBoxShadow(compoundLine, strokeWidth, strokeColor);

  return {
    borderWidth,
    borderColor: strokeColor,
    borderStyle: "solid",
    ...(boxShadow ? { boxShadow } : {}),
  };
}

/**
 * Computes an SVG `stroke-dasharray` value for a given dash type and stroke width.
 * For custom dash types with parsed segments, segment values are expressed in
 * 1/1000 of the line width (per OOXML spec) and converted to pixel multiples.
 * @param dashType - The OOXML dash type.
 * @param strokeWidth - Stroke width in pixels (minimum 1).
 * @param customDashSegments - Optional array of `{dash, space}` segments for custom dashes.
 * @returns A space-separated dasharray string, or `undefined` for solid strokes.
 */
export function getSvgStrokeDasharray(
  dashType: StrokeDashType | undefined,
  strokeWidth: number,
  customDashSegments?: Array<{ dash: number; space: number }>,
): string | undefined {
  if (!dashType || dashType === "solid") return undefined;
  const stroke = Math.max(strokeWidth, 1);

  // If custom dash with parsed segments, build dasharray from actual data.
  // Segment values are in 1/1000 of the line width, so divide by 1000
  // to get multiples of stroke-width.
  if (
    dashType === "custom" &&
    customDashSegments &&
    customDashSegments.length > 0
  ) {
    return customDashSegments
      .flatMap((seg) => [
        (seg.dash / 1000) * stroke,
        (seg.space / 1000) * stroke,
      ])
      .join(" ");
  }

  switch (dashType) {
    case "dot":
    case "sysDot":
      return `${stroke} ${stroke * 2}`;
    case "dash":
    case "sysDash":
      return `${stroke * 4} ${stroke * 2}`;
    case "lgDash":
      return `${stroke * 7} ${stroke * 2.5}`;
    case "dashDot":
    case "sysDashDot":
      return `${stroke * 4} ${stroke * 2} ${stroke} ${stroke * 2}`;
    case "lgDashDot":
      return `${stroke * 7} ${stroke * 2.5} ${stroke} ${stroke * 2.5}`;
    case "lgDashDotDot":
    case "sysDashDotDot":
      return `${stroke * 7} ${stroke * 2.5} ${stroke} ${stroke * 2} ${stroke} ${stroke * 2}`;
    case "custom":
      return `${stroke * 3} ${stroke * 2}`;
    default:
      return undefined;
  }
}

/**
 * Builds a CSS `transform` string combining flip and rotation transforms for an element.
 * Flips are expressed as `scaleX(-1)` / `scaleY(-1)`, rotation as `rotate(Ndeg)`.
 * @param element - The element whose transforms are read.
 * @returns A CSS transform string, or `undefined` if no transforms apply.
 */
export function getElementTransform(element: PptxElement): string | undefined {
  const transforms: string[] = [];
  if (element.flipHorizontal) transforms.push("scaleX(-1)");
  if (element.flipVertical) transforms.push("scaleY(-1)");
  if (element.rotation) transforms.push(`rotate(${element.rotation}deg)`);
  return transforms.length > 0 ? transforms.join(" ") : undefined;
}

/**
 * Builds a CSS transform that compensates for element flips so that text
 * inside a flipped shape renders in its natural reading direction.
 * Only includes `scaleX(-1)` / `scaleY(-1)`; rotation is not compensated.
 * @param element - The element whose flips are checked.
 * @returns A CSS transform string, or `undefined` if no flips are active.
 */
export function getTextCompensationTransform(
  element: PptxElement,
): string | undefined {
  const transforms: string[] = [];
  if (element.flipHorizontal) transforms.push("scaleX(-1)");
  if (element.flipVertical) transforms.push("scaleY(-1)");
  return transforms.length > 0 ? transforms.join(" ") : undefined;
}

/**
 * Parses an OOXML "drawing percent" value (expressed as hundredths-of-a-percent,
 * i.e. 100000 = 100%) into a 0-1 unit interval.
 * @param value - Raw value from OOXML (e.g. 50000 for 50%).
 * @returns A number between 0 and 1, or `undefined` if the value is not finite.
 */
export function parseDrawingPercent(value: unknown): number | undefined {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return undefined;
  return clampUnitInterval(parsed / 100000);
}
