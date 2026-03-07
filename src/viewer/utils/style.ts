/**
 * Style utilities for the PowerPoint viewer/editor.
 *
 * Barrel re-export - transition styles extracted to `style-transitions`.
 */
import type { StrokeDashType, PptxElement } from "../../core";
import { clampUnitInterval } from "./color";

export { getPresentationTransitionStyle } from "./style-transitions";

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
 * This provides a better visual approximation than CSS "double" or "ridge"
 * for all compound line types.
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
      // Double line - two equal parallel lines
      const lineWidth = Math.max(1, Math.ceil(width * 0.35));
      const gap = Math.max(1, Math.ceil(width * 0.3));
      const offset = lineWidth + gap;
      // Inset shadow to create inner line, outset shadow for outer line
      return `inset 0 ${offset}px 0 ${-lineWidth}px ${color}, inset 0 ${-offset}px 0 ${-lineWidth}px ${color}`;
    }

    case "thickThin": {
      // Thick line on one side, thin line on the other
      const thickWidth = Math.max(2, Math.ceil(width * 0.55));
      const thinWidth = Math.max(1, Math.ceil(width * 0.25));
      const gap = Math.max(1, Math.ceil(width * 0.2));
      const thickOffset = thickWidth / 2 + gap;
      const thinOffset = thickWidth / 2 + gap + thinWidth;
      return `inset 0 ${thickOffset}px 0 ${-thickWidth}px ${color}, inset 0 ${-thinOffset}px 0 ${-thinWidth}px ${color}`;
    }

    case "thinThick": {
      // Thin line on one side, thick line on the other
      const thinWidth = Math.max(1, Math.ceil(width * 0.25));
      const thickWidth = Math.max(2, Math.ceil(width * 0.55));
      const gap = Math.max(1, Math.ceil(width * 0.2));
      const thinOffset = thickWidth / 2 + gap;
      const thickOffset = thickWidth / 2 + gap + thinWidth;
      return `inset 0 ${thinOffset}px 0 ${-thinWidth}px ${color}, inset 0 ${-thickOffset}px 0 ${-thickWidth}px ${color}`;
    }

    case "tri": {
      // Triple line - three equal parallel lines
      const lineWidth = Math.max(1, Math.ceil(width * 0.25));
      const gap = Math.max(1, Math.ceil(width * 0.15));
      const offset1 = lineWidth + gap;
      const offset2 = (lineWidth + gap) * 2;
      return `inset 0 0 0 ${-lineWidth}px ${color}, inset 0 ${offset1}px 0 ${-lineWidth}px ${color}, inset 0 ${-offset2}px 0 ${-lineWidth}px ${color}`;
    }

    default:
      return undefined;
  }
}

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

export function getElementTransform(element: PptxElement): string | undefined {
  const transforms: string[] = [];
  if (element.flipHorizontal) transforms.push("scaleX(-1)");
  if (element.flipVertical) transforms.push("scaleY(-1)");
  if (element.rotation) transforms.push(`rotate(${element.rotation}deg)`);
  return transforms.length > 0 ? transforms.join(" ") : undefined;
}

export function getTextCompensationTransform(
  element: PptxElement,
): string | undefined {
  const transforms: string[] = [];
  if (element.flipHorizontal) transforms.push("scaleX(-1)");
  if (element.flipVertical) transforms.push("scaleY(-1)");
  return transforms.length > 0 ? transforms.join(" ") : undefined;
}

export function parseDrawingPercent(value: unknown): number | undefined {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return undefined;
  return clampUnitInterval(parsed / 100000);
}
