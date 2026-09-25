/**
 * smartart-drawing.ts: Drawing-shape view-model helpers for the SmartArt
 * renderer, shared across the React, Vue, and Angular bindings.
 *
 * These back the **pre-computed drawing-shapes** path
 * (`smartArtData.drawingShapes`), which the core engine extracts from
 * `ppt/diagrams/drawing*.xml`. That path is preferred when present and is
 * independent of the SVG-fallback layout engine (`computeSmartArtLayout` in
 * `smartart-layout`), which only runs when no drawing shapes exist.
 *
 * Pure TypeScript (no framework imports). Style helpers (`styleStroke`,
 * `styleShadow`) are reused from `smartart-layout-helpers`.
 */

import { getShapeType, getSubstituteFontFamily } from 'pptx-viewer-core';
import type {
	PptxSmartArtChrome,
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	SmartArtColorScheme,
	SmartArtStyle,
} from 'pptx-viewer-core';

import type { CssStyleMap } from './element-style-transform';
import { resolveDrawingShapeGradient } from './smartart-drawing-gradient';
import type { RenderedGradient } from './smartart-drawing-gradient';
import { drawingShapeFillOpacity, drawingShapeLabelColor } from './smartart-drawing-label-color';
import type { DrawingViewBox } from './smartart-drawing-viewbox';
import { styleShadow, styleStroke } from './smartart-layout-helpers';
import { getPresetShapeVectorGeometry } from './stroke-outline';
import type { SvgTextLine } from './svg-text-lines';
import { centeredSvgTextLines } from './svg-text-lines';

/** Built-in named colour palettes (mirrors the Vue/React `PALETTES`). */
export const PALETTES: Record<SmartArtColorScheme, string[]> = {
	colorful1: ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7', '#ec4899'],
	colorful2: ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
	colorful3: ['#0ea5e9', '#84cc16', '#f43e5e', '#a855f7', '#f97316', '#10b981'],
	monochromatic1: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb', '#1d4ed8'],
	monochromatic2: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#4f46e5', '#4338ca'],
};

export { drawingShapeFillOpacity, drawingShapeLabelColor };
export { computeDrawingViewBox } from './smartart-drawing-viewbox';
export type { DrawingViewBox } from './smartart-drawing-viewbox';
export type { RenderedGradient, RenderedGradientStop } from './smartart-drawing-gradient';

export const DEFAULT_PALETTE: string[] = PALETTES.colorful1;

/** Pick a colour from `palette`, wrapping `index` around its length. */
export function paletteColour(index: number, palette: string[]): string {
	return palette[index % palette.length];
}

/**
 * Resolve the active colour palette for a SmartArt diagram.
 *
 * Priority: colorTransform fill colours → named scheme → default (colorful1).
 */
export function resolvePalette(data: PptxSmartArtData | undefined): string[] {
	if (!data) {
		return DEFAULT_PALETTE;
	}
	const ctFills = data.colorTransform?.fillColors;
	if (ctFills && ctFills.length > 0) {
		return ctFills;
	}
	return PALETTES[data.colorScheme ?? 'colorful1'] ?? DEFAULT_PALETTE;
}

/**
 * CSS style map for the chrome wrapper `<div>`. Applies background colour
 * and/or outline border when `chrome` is present.
 */
export function buildChromeStyle(chrome: PptxSmartArtChrome | undefined): CssStyleMap {
	const s: CssStyleMap = {
		width: '100%',
		height: '100%',
		'box-sizing': 'border-box',
		overflow: 'hidden',
	};
	if (!chrome) {
		return s;
	}
	if (chrome.backgroundColor) {
		s['background-color'] = chrome.backgroundColor;
	}
	if (chrome.outlineColor) {
		s['border'] = `${chrome.outlineWidth ?? 1}px solid ${chrome.outlineColor}`;
	}
	return s;
}

/**
 * Which SVG primitive paints a cached shape's body. One discriminant rather than
 * a set of booleans, so a binding's template is a single switch and adding a
 * primitive cannot leave four bindings behind.
 */
export type RenderedShapeKind = 'image' | 'ellipse' | 'path' | 'rect';

/** Projected view-model for a single pre-computed drawing shape. */
export interface RenderedShape {
	key: string;
	/** Which primitive paints the body; see {@link RenderedShapeKind}. */
	kind: RenderedShapeKind;
	/** Preset path and placement transform, set when `kind === 'path'`. */
	pathData?: string;
	pathTransform?: string;
	/**
	 * Gradient to emit in `<defs>` and reference from {@link fill}, when the
	 * cached shape carries `a:gradFill`.
	 */
	gradient?: RenderedGradient;
	x: number;
	y: number;
	width: number;
	height: number;
	rx: number;
	cx: number;
	cy: number;
	/** Paint for the body, or `'none'` when the shape declares `a:noFill`. */
	fill: string;
	/**
	 * Opacity (0..1) to paint a solid {@link fill} at, from the cached colour's
	 * `a:alpha`; absent when opaque. Maps onto SVG `fill-opacity`.
	 */
	fillOpacity?: number;
	stroke: string;
	strokeWidth: number;
	transform: string | undefined;
	/**
	 * Picture fill to draw in place of the body, when the cached shape carries a
	 * resolved `a:blipFill`. SmartArt icon layouts are built from these, and a
	 * renderer that only paints `fill` turns each icon into a coloured box.
	 */
	imageUrl: string | undefined;
	/**
	 * The shape's authored text, wrapped to its own width and vertically centred
	 * on {@link textY}. Cached SmartArt text is real sentence content, so it is
	 * wrapped rather than cut: dropping the tail of a sentence loses information
	 * the deck was written to carry. Each entry is ready to place as one
	 * `<tspan>` at `textX` / its own `y`.
	 */
	textLines: SvgTextLine[];
	textX: number;
	textY: number;
	textWidth: number;
	textHeight: number;
	fontColor: string;
	fontSize: number;
	fontFamily?: string;
	fontWeight?: number;
	fontStyle?: 'normal' | 'italic';
}

/**
 * Fraction of a shape's width its label may occupy. DiagramML shapes carry the
 * usual text insets, and wrapping to the full box would let text sit on the
 * outline.
 */
const TEXT_WIDTH_FRACTION = 0.82;
const CJK_SMARTART_TEXT_RE =
	/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const CJK_SMARTART_LINE_HEIGHT_RATIO = 1.33;
const DEFAULT_SMARTART_LINE_HEIGHT_RATIO = 1.2;

function drawingTextBaseLineHeightRatio(text: string | undefined): number {
	return CJK_SMARTART_TEXT_RE.test(text ?? '')
		? CJK_SMARTART_LINE_HEIGHT_RATIO
		: DEFAULT_SMARTART_LINE_HEIGHT_RATIO;
}

/** Which primitive paints this shape's body, from its preset type. */
function resolveShapeKind(shape: PptxSmartArtDrawingShape, hasImage: boolean): RenderedShapeKind {
	if (hasImage) {
		return 'image';
	}
	const normalized = (shape.shapeType ?? '').trim().toLowerCase();
	if (normalized === 'ellipse' || normalized === 'oval') {
		return 'ellipse';
	}
	const identityPresets = new Set(['rect', 'flowchartprocess', 'roundrect']);
	return identityPresets.has(normalized) || normalized.length === 0 ? 'rect' : 'path';
}

function drawingShapeTransform(
	shape: PptxSmartArtDrawingShape,
	cx: number,
	cy: number,
): string | undefined {
	const transforms: string[] = [];
	if (shape.rotation) {
		transforms.push(`rotate(${shape.rotation} ${cx} ${cy})`);
	}
	if (shape.flipHorizontal || shape.flipVertical) {
		transforms.push(
			`translate(${cx} ${cy}) scale(${shape.flipHorizontal ? -1 : 1} ${shape.flipVertical ? -1 : 1}) translate(${-cx} ${-cy})`,
		);
	}
	return transforms.length > 0 ? transforms.join(' ') : undefined;
}

/**
 * Project raw `PptxSmartArtDrawingShape`s into `RenderedShape` view-models,
 * rebasing positions relative to the viewBox origin.
 */
export function projectDrawingShapes(
	elementId: string,
	shapes: PptxSmartArtDrawingShape[],
	viewBox: DrawingViewBox,
	palette: string[],
	style: SmartArtStyle,
): RenderedShape[] {
	const { minX, minY } = viewBox;
	const sw = styleStroke(style);

	return shapes.map((shape, i): RenderedShape => {
		const gradient = shape.fillNone
			? undefined
			: resolveDrawingShapeGradient(shape, `${elementId}-dspgrad-${shape.id}-${i}`);
		// Precedence: authored transparency, then gradient, then a pattern's
		// foreground (the closest flat stand-in for one), then solid, then palette.
		const fill = shape.fillNone
			? 'none'
			: gradient
				? `url(#${gradient.id})`
				: (shape.fillPatternForegroundColor ?? shape.fillColor ?? paletteColour(i, palette));
		const fillOpacity = gradient ? undefined : drawingShapeFillOpacity(shape);
		const relX = shape.x - minX;
		const relY = shape.y - minY;
		const kind = resolveShapeKind(shape, Boolean(shape.fillImageUrl));
		const rx =
			getShapeType(shape.shapeType) === 'roundRect' ? Math.min(shape.width, shape.height) * 0.1 : 0;
		const cx = relX + shape.width / 2;
		const cy = relY + shape.height / 2;
		const stroke = shape.strokeColor ?? (sw > 0 ? 'rgba(255,255,255,0.3)' : 'none');
		const transform = drawingShapeTransform(shape, cx, cy);
		const presetGeometry =
			kind === 'path'
				? getPresetShapeVectorGeometry(
						shape.shapeType,
						shape.width,
						shape.height,
						shape.shapeAdjustments,
					)
				: undefined;
		const fontSize = shape.fontSize ?? Math.max(8, Math.min(14, shape.height * 0.2));
		const hasTextFrame =
			Number.isFinite(shape.textFrameX) &&
			Number.isFinite(shape.textFrameY) &&
			Number.isFinite(shape.textFrameWidth) &&
			Number.isFinite(shape.textFrameHeight) &&
			(shape.textFrameWidth ?? 0) > 0 &&
			(shape.textFrameHeight ?? 0) > 0;
		const textFrameX = (hasTextFrame ? shape.textFrameX! : shape.x) - minX;
		const textFrameY = (hasTextFrame ? shape.textFrameY! : shape.y) - minY;
		const textFrameWidth = hasTextFrame ? shape.textFrameWidth! : shape.width;
		const textFrameHeight = hasTextFrame ? shape.textFrameHeight! : shape.height;
		const textInsetLeft = shape.textInsetLeft ?? 0;
		const textInsetRight = shape.textInsetRight ?? 0;
		const textInsetTop = shape.textInsetTop ?? 0;
		const textInsetBottom = shape.textInsetBottom ?? 0;
		const textContentWidth = Math.max(1, textFrameWidth - textInsetLeft - textInsetRight);
		const textContentHeight = Math.max(1, textFrameHeight - textInsetTop - textInsetBottom);
		const textCenterX = textFrameX + textInsetLeft + textContentWidth / 2;
		const textCenterY = textFrameY + textInsetTop + textContentHeight / 2;
		const textWrapWidth = hasTextFrame ? textContentWidth : shape.width * TEXT_WIDTH_FRACTION;
		const authoredLineHeightRatio = shape.lineHeightRatio ?? 1;
		const lineHeightRatio =
			drawingTextBaseLineHeightRatio(shape.text) * authoredLineHeightRatio +
			(shape.lineSpacingAfterRatio ?? 0);
		const lineHeight =
			shape.lineHeight !== undefined || shape.lineSpacingAfter !== undefined
				? (shape.lineHeight ??
						fontSize * drawingTextBaseLineHeightRatio(shape.text) * authoredLineHeightRatio) +
					(shape.lineSpacingAfter ?? 0)
				: undefined;

		return {
			key: `${elementId}-dsp-${shape.id}-${i}`,
			kind,
			...(presetGeometry
				? {
						pathData: presetGeometry.d,
						pathTransform: [transform, `translate(${relX} ${relY})`].filter(Boolean).join(' '),
					}
				: {}),
			...(gradient ? { gradient } : {}),
			x: relX,
			y: relY,
			width: shape.width,
			height: shape.height,
			rx,
			cx,
			cy,
			fill,
			...(fillOpacity !== undefined ? { fillOpacity } : {}),
			stroke,
			strokeWidth: shape.strokeWidth ?? sw,
			transform,
			imageUrl: shape.fillImageUrl,
			textLines: shape.text
				? centeredSvgTextLines(shape.text, fontSize, {
						maxWidth: textWrapWidth,
						centerY: textCenterY,
						lineHeight,
						lineHeightRatio,
					})
				: [],
			textX: textCenterX,
			textY: textCenterY,
			textWidth: textContentWidth,
			textHeight: textContentHeight,
			fontColor: shape.fontColor ?? drawingShapeLabelColor(shape, shapes, i, fill),
			fontSize,
			fontFamily: shape.fontFamily ? getSubstituteFontFamily(shape.fontFamily) : undefined,
			fontWeight: shape.fontWeight,
			fontStyle: shape.fontStyle,
		};
	});
}

/** Drop-shadow filter string for the given style intensity. */
export function styleShadowFilter(style: SmartArtStyle): string | undefined {
	return styleShadow(style);
}
