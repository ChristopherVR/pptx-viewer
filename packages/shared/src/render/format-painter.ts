/**
 * Format Painter — copies shape/text style properties from one element and
 * applies them to another. Pure, framework-agnostic logic shared by every
 * binding (React / Vue / Angular).
 */
import type { PptxElement, ShapeStyle, TextStyle } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';

export interface CopiedFormat {
	shapeStyle?: Partial<ShapeStyle>;
	textStyle?: Partial<TextStyle>;
}

/** Copy the paintable shape + text style off an element. */
export function copyFormatFromElement(element: PptxElement): CopiedFormat {
	const result: CopiedFormat = {};

	if (hasShapeProperties(element) && element.shapeStyle) {
		const s = element.shapeStyle;
		result.shapeStyle = {
			fillColor: s.fillColor,
			fillMode: s.fillMode,
			fillGradient: s.fillGradient,
			fillGradientStops: s.fillGradientStops ? [...s.fillGradientStops] : undefined,
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

function definedEntries<T extends object>(obj: T): Partial<T> {
	const out: Partial<T> = {};
	for (const key in obj) {
		if (obj[key] !== undefined) {
			out[key] = obj[key];
		}
	}
	return out;
}

/** Merge a copied format onto a target element (only defined fields win). */
export function applyFormatToElement(element: PptxElement, format: CopiedFormat): PptxElement {
	let updated = { ...element };

	if (format.shapeStyle && hasShapeProperties(updated)) {
		updated = {
			...updated,
			shapeStyle: {
				...updated.shapeStyle,
				...definedEntries(format.shapeStyle),
			},
		} as PptxElement;
	}

	if (format.textStyle && hasTextProperties(updated)) {
		updated = {
			...updated,
			textStyle: {
				...updated.textStyle,
				...definedEntries(format.textStyle),
			},
		} as PptxElement;
	}

	return updated;
}

/** True when an element exposes formatting fields the painter can copy. */
export function hasCopyableFormat(element: PptxElement | null | undefined): boolean {
	if (!element) {
		return false;
	}
	return hasShapeProperties(element) || hasTextProperties(element);
}
