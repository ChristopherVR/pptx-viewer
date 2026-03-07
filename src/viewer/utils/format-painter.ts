/**
 * Format Painter — copies shape style properties from one element and
 * applies them to another.
 */
import type {
  PptxElement,
  ShapeStyle,
  TextStyle,
} from "../../core";
import {
  hasShapeProperties,
  hasTextProperties,
} from "../../core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopiedFormat {
  shapeStyle?: Partial<ShapeStyle>;
  textStyle?: Partial<TextStyle>;
}

// ---------------------------------------------------------------------------
// Copy format from an element
// ---------------------------------------------------------------------------

export function copyFormatFromElement(element: PptxElement): CopiedFormat {
  const result: CopiedFormat = {};

  if (hasShapeProperties(element) && element.shapeStyle) {
    const s = element.shapeStyle;
    result.shapeStyle = {
      fillColor: s.fillColor,
      fillMode: s.fillMode,
      fillGradient: s.fillGradient,
      fillGradientStops: s.fillGradientStops
        ? [...s.fillGradientStops]
        : undefined,
      fillGradientAngle: s.fillGradientAngle,
      fillGradientType: s.fillGradientType,
      fillOpacity: s.fillOpacity,
      fillPatternPreset: s.fillPatternPreset,
      fillPatternBackgroundColor: s.fillPatternBackgroundColor,
      strokeColor: s.strokeColor,
      strokeWidth: s.strokeWidth,
      strokeOpacity: s.strokeOpacity,
      strokeDash: s.strokeDash,
      lineJoin: s.lineJoin,
      lineCap: s.lineCap,
      shadowColor: s.shadowColor,
      shadowBlur: s.shadowBlur,
      shadowOffsetX: s.shadowOffsetX,
      shadowOffsetY: s.shadowOffsetY,
      shadowOpacity: s.shadowOpacity,
      glowColor: s.glowColor,
      glowRadius: s.glowRadius,
      glowOpacity: s.glowOpacity,
      softEdgeRadius: s.softEdgeRadius,
    };
  }

  if (hasTextProperties(element) && element.textStyle) {
    const t = element.textStyle;
    result.textStyle = {
      fontFamily: t.fontFamily,
      fontSize: t.fontSize,
      bold: t.bold,
      italic: t.italic,
      underline: t.underline,
      underlineStyle: t.underlineStyle,
      strikethrough: t.strikethrough,
      color: t.color,
      align: t.align,
      lineSpacing: t.lineSpacing,
      paragraphSpacingBefore: t.paragraphSpacingBefore,
      paragraphSpacingAfter: t.paragraphSpacingAfter,
      textCaps: t.textCaps,
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Apply copied format to an element
// ---------------------------------------------------------------------------

export function applyFormatToElement(
  element: PptxElement,
  format: CopiedFormat,
): PptxElement {
  let updated = { ...element };

  if (format.shapeStyle && hasShapeProperties(updated)) {
    updated = {
      ...updated,
      shapeStyle: {
        ...updated.shapeStyle,
        ...format.shapeStyle,
      },
    } as PptxElement;
  }

  if (format.textStyle && hasTextProperties(updated)) {
    updated = {
      ...updated,
      textStyle: {
        ...updated.textStyle,
        ...format.textStyle,
      },
    } as PptxElement;
  }

  return updated;
}
