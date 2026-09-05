import { hasTextProperties, resolveThemeColorRef } from 'pptx-viewer-core';
import type {
	ImagePptxElement,
	PptxElement,
	PptxElementWithText,
	PptxThemeColorRef,
	ShapeStyle,
} from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

// ── updateElementStyle ────────────────────────────────────────────────────────

export interface UpdateElementStyleParams {
	slideIndex: number;
	elementId: string;
	// fill
	fillColor?: string;
	/**
	 * A theme colour for the fill (`{ scheme: 'accent1', lumMod: 0.8 }`).
	 * Wins on save: the shape is written as `<a:schemeClr>` instead of a
	 * canonical `<a:srgbClr>`, so it keeps following the theme after a later
	 * theme change. Also resolves `fillColor` immediately (against the
	 * deck's `themeColorMap`) when `fillColor` was not explicitly given.
	 * Passing `fillColor` alone (no `fillThemeColor`) clears any previously
	 * set fill theme colour, matching a user typing a custom hex.
	 */
	fillThemeColor?: PptxThemeColorRef;
	fillMode?: ShapeStyle['fillMode'];
	fillGradientStops?: Array<{ color: string; position: number; opacity?: number }>;
	fillGradientAngle?: number;
	fillGradientType?: 'linear' | 'radial';
	fillOpacity?: number;
	// stroke
	strokeColor?: string;
	/** A theme colour for the outline; see {@link fillThemeColor}. */
	strokeThemeColor?: PptxThemeColorRef;
	strokeWidth?: number;
	strokeDash?: ShapeStyle['strokeDash'];
	strokeOpacity?: number;
	// shadow
	shadowColor?: string;
	shadowBlur?: number;
	shadowOffsetX?: number;
	shadowOffsetY?: number;
	shadowOpacity?: number;
	// glow
	glowColor?: string;
	glowRadius?: number;
	glowOpacity?: number;
	softEdgeRadius?: number;
	// image-specific
	cropLeft?: number;
	cropTop?: number;
	cropRight?: number;
	cropBottom?: number;
	brightness?: number;
	contrast?: number;
	grayscale?: boolean;
	/**
	 * Accessibility description (`p:cNvPr/@descr`). Accepted for pictures,
	 * every graphic frame kind (table, chart, smartArt, ole, media), and a
	 * plain shape / text box / connector: the core writer serialises all
	 * eight kinds, so the tool must not stop at images.
	 */
	altText?: string;
	/**
	 * Accessibility title (`p:cNvPr/@title`). Accepted for every kind that
	 * models it: table, chart, smartArt, ole, media, text, shape and
	 * connector (a picture has no separate title field, only `altText`).
	 */
	title?: string;
}

/** Element kinds whose core type models `altText` and whose writer persists it. */
export const ALT_TEXT_ELEMENT_TYPES: ReadonlySet<PptxElement['type']> = new Set<
	PptxElement['type']
>(['image', 'picture', 'table', 'chart', 'smartArt', 'ole', 'media', 'text', 'shape', 'connector']);

/** Element kinds whose core type models `title` and whose writer persists it. */
export const TITLE_ELEMENT_TYPES: ReadonlySet<PptxElement['type']> = new Set<PptxElement['type']>([
	'table',
	'chart',
	'smartArt',
	'ole',
	'media',
	'text',
	'shape',
	'connector',
]);

/**
 * Write `altText` onto `el`, or throw when the element kind has nowhere to
 * persist it.
 */
export function applyElementAltText(el: PptxElement, altText: string): void {
	if (!ALT_TEXT_ELEMENT_TYPES.has(el.type)) {
		throw new Error(
			`Element '${el.id}' (${el.type}) does not support altText; ` +
				`only ${[...ALT_TEXT_ELEMENT_TYPES].join(', ')} elements do.`,
		);
	}
	(el as { altText?: string }).altText = altText;
}

/**
 * Write `title` onto `el`, or throw when the element kind has nowhere to
 * persist it (a picture's `p:cNvPr` only ever carries `@descr`, not `@title`).
 */
export function applyElementTitle(el: PptxElement, title: string): void {
	if (!TITLE_ELEMENT_TYPES.has(el.type)) {
		throw new Error(
			`Element '${el.id}' (${el.type}) does not support title; ` +
				`only ${[...TITLE_ELEMENT_TYPES].join(', ')} elements do.`,
		);
	}
	(el as { title?: string }).title = title;
}

export function updateElementStyle(
	ctx: ToolContext,
	params: UpdateElementStyleParams,
): ToolResult<{ elementId: string }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const el = slide.elements.find((e) => e.id === params.elementId);
	if (!el) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}

	// Apply shape style fields
	if ('shapeStyle' in el) {
		if (!el.shapeStyle) {
			(el as { shapeStyle: ShapeStyle }).shapeStyle = {};
		}
		const ss = el.shapeStyle as ShapeStyle;

		if (params.fillThemeColor !== undefined) {
			ss.fillColorRef = params.fillThemeColor;
			// Resolve immediately so renderers reading the plain hex field see the
			// theme colour right away; an explicit `fillColor` still wins when the
			// caller supplied both.
			const resolved = resolveThemeColorRef(params.fillThemeColor, ctx.pptxData.themeColorMap);
			if (params.fillColor !== undefined) {
				ss.fillColor = params.fillColor;
			} else if (resolved) {
				ss.fillColor = resolved;
			}
		} else if (params.fillColor !== undefined) {
			// A plain hex edit with no theme colour clears any ref this shape
			// previously carried (matches a user typing a custom colour).
			ss.fillColor = params.fillColor;
			ss.fillColorRef = undefined;
		}
		if (params.fillMode !== undefined) {
			ss.fillMode = params.fillMode;
		}
		if (params.fillGradientStops !== undefined) {
			ss.fillGradientStops = params.fillGradientStops;
		}
		if (params.fillGradientAngle !== undefined) {
			ss.fillGradientAngle = params.fillGradientAngle;
		}
		if (params.fillGradientType !== undefined) {
			ss.fillGradientType = params.fillGradientType;
		}
		if (params.fillOpacity !== undefined) {
			ss.fillOpacity = params.fillOpacity;
		}
		if (params.strokeThemeColor !== undefined) {
			ss.strokeColorRef = params.strokeThemeColor;
			const resolved = resolveThemeColorRef(params.strokeThemeColor, ctx.pptxData.themeColorMap);
			if (params.strokeColor !== undefined) {
				ss.strokeColor = params.strokeColor;
			} else if (resolved) {
				ss.strokeColor = resolved;
			}
		} else if (params.strokeColor !== undefined) {
			ss.strokeColor = params.strokeColor;
			ss.strokeColorRef = undefined;
		}
		if (params.strokeWidth !== undefined) {
			ss.strokeWidth = params.strokeWidth;
		}
		if (params.strokeDash !== undefined) {
			ss.strokeDash = params.strokeDash;
		}
		if (params.strokeOpacity !== undefined) {
			ss.strokeOpacity = params.strokeOpacity;
		}
		if (params.shadowColor !== undefined) {
			ss.shadowColor = params.shadowColor;
		}
		if (params.shadowBlur !== undefined) {
			ss.shadowBlur = params.shadowBlur;
		}
		if (params.shadowOffsetX !== undefined) {
			ss.shadowOffsetX = params.shadowOffsetX;
		}
		if (params.shadowOffsetY !== undefined) {
			ss.shadowOffsetY = params.shadowOffsetY;
		}
		if (params.shadowOpacity !== undefined) {
			ss.shadowOpacity = params.shadowOpacity;
		}
		if (params.glowColor !== undefined) {
			ss.glowColor = params.glowColor;
		}
		if (params.glowRadius !== undefined) {
			ss.glowRadius = params.glowRadius;
		}
		if (params.glowOpacity !== undefined) {
			ss.glowOpacity = params.glowOpacity;
		}
		if (params.softEdgeRadius !== undefined) {
			ss.softEdgeRadius = params.softEdgeRadius;
		}
	}

	// Alt text: pictures, every graphic-frame kind, and shapes/text/connectors
	// carry it.
	if (params.altText !== undefined) {
		applyElementAltText(el, params.altText);
	}
	// Title: every altText kind except pictures also models a title.
	if (params.title !== undefined) {
		applyElementTitle(el, params.title);
	}

	// Apply image-specific fields
	if (el.type === 'image' || el.type === 'picture') {
		const img = el as ImagePptxElement;
		if (params.cropLeft !== undefined) {
			img.cropLeft = params.cropLeft;
		}
		if (params.cropTop !== undefined) {
			img.cropTop = params.cropTop;
		}
		if (params.cropRight !== undefined) {
			img.cropRight = params.cropRight;
		}
		if (params.cropBottom !== undefined) {
			img.cropBottom = params.cropBottom;
		}
		if (
			params.brightness !== undefined ||
			params.contrast !== undefined ||
			params.grayscale !== undefined
		) {
			if (!img.imageEffects) {
				img.imageEffects = {};
			}
			if (params.brightness !== undefined) {
				img.imageEffects.brightness = params.brightness;
			}
			if (params.contrast !== undefined) {
				img.imageEffects.contrast = params.contrast;
			}
			if (params.grayscale !== undefined) {
				img.imageEffects.grayscale = params.grayscale;
			}
		}
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { elementId: params.elementId },
	};
}

// ── runAccessibilityCheck ─────────────────────────────────────────────────────

export interface AccessibilityIssue {
	slideIndex: number;
	elementId?: string;
	severity: 'error' | 'warning' | 'info';
	message: string;
}

export interface AccessibilityCheckResult {
	slideCount: number;
	totalIssues: number;
	errorCount: number;
	warningCount: number;
	infoCount: number;
	issues: AccessibilityIssue[];
}

export function runAccessibilityCheck(ctx: ToolContext): ToolResult<AccessibilityCheckResult> {
	const issues: AccessibilityIssue[] = [];

	for (let si = 0; si < ctx.pptxData.slides.length; si++) {
		const slide = ctx.pptxData.slides[si];
		let slideHasText = false;

		for (const el of slide.elements) {
			// Images without alt text
			if (el.type === 'image' || el.type === 'picture') {
				const img = el as ImagePptxElement;
				if (!img.altText) {
					issues.push({
						slideIndex: si,
						elementId: el.id,
						severity: 'error',
						message: `Image element '${el.id}' has no alt text.`,
					});
				}
			}

			if (hasTextProperties(el)) {
				const textEl = el as PptxElementWithText;
				slideHasText = true;

				// Empty text elements
				if (!textEl.text || textEl.text.trim() === '') {
					issues.push({
						slideIndex: si,
						elementId: el.id,
						severity: 'info',
						message: `Text element '${el.id}' is empty.`,
					});
				}

				// Small font size
				const fs = textEl.textStyle?.fontSize;
				if (fs !== undefined && fs < 10) {
					issues.push({
						slideIndex: si,
						elementId: el.id,
						severity: 'warning',
						message: `Text element '${el.id}' has very small font size (${fs}pt < 10pt).`,
					});
				}

				// Text color matching background (basic check: both white or both black)
				const textColor = textEl.textStyle?.color?.toLowerCase();
				const bgColor = slide.backgroundColor?.toLowerCase();
				if (textColor && bgColor && textColor === bgColor) {
					issues.push({
						slideIndex: si,
						elementId: el.id,
						severity: 'error',
						message: `Text element '${el.id}' has same color as slide background (${textColor}).`,
					});
				}
			}
		}

		if (!slideHasText) {
			issues.push({
				slideIndex: si,
				severity: 'warning',
				message: `Slide ${si + 1} contains no text elements.`,
			});
		}
	}

	const errorCount = issues.filter((i) => i.severity === 'error').length;
	const warningCount = issues.filter((i) => i.severity === 'warning').length;
	const infoCount = issues.filter((i) => i.severity === 'info').length;

	return {
		pptxData: ctx.pptxData,
		dirty: false,
		result: {
			slideCount: ctx.pptxData.slides.length,
			totalIssues: issues.length,
			errorCount,
			warningCount,
			infoCount,
			issues,
		},
	};
}
