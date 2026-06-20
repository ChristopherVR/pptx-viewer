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
 * Pure TypeScript (no framework imports). Style helpers (`truncate`,
 * `styleStroke`, `styleShadow`) are reused from `smartart-layout-helpers`.
 */

import type {
	PptxSmartArtChrome,
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	SmartArtColorScheme,
	SmartArtStyle,
} from 'pptx-viewer-core';

import type { CssStyleMap } from './element-style-transform';
import { styleShadow, styleStroke, truncate } from './smartart-layout-helpers';

/** Built-in named colour palettes (mirrors the Vue/React `PALETTES`). */
export const PALETTES: Record<SmartArtColorScheme, string[]> = {
	colorful1: ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7', '#ec4899'],
	colorful2: ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
	colorful3: ['#0ea5e9', '#84cc16', '#f43e5e', '#a855f7', '#f97316', '#10b981'],
	monochromatic1: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb', '#1d4ed8'],
	monochromatic2: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#4f46e5', '#4338ca'],
};

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

/** Projected view-model for a single pre-computed drawing shape. */
export interface RenderedShape {
	key: string;
	/** True → render `<ellipse>`, false → render `<rect>`. */
	isEllipse: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
	rx: number;
	cx: number;
	cy: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
	transform: string | undefined;
	text: string | undefined;
	textX: number;
	textY: number;
	fontColor: string;
	fontSize: number;
}

/** SVG `viewBox` bounding-box derived from all drawing shapes. */
export interface DrawingViewBox {
	minX: number;
	minY: number;
	width: number;
	height: number;
}

/** Compute the SVG viewBox that fits all drawing shapes, rebasing to (0, 0). */
export function computeDrawingViewBox(shapes: PptxSmartArtDrawingShape[]): DrawingViewBox {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const s of shapes) {
		if (s.x < minX) {
			minX = s.x;
		}
		if (s.y < minY) {
			minY = s.y;
		}
		if (s.x + s.width > maxX) {
			maxX = s.x + s.width;
		}
		if (s.y + s.height > maxY) {
			maxY = s.y + s.height;
		}
	}
	if (!Number.isFinite(minX)) {
		return { minX: 0, minY: 0, width: 1, height: 1 };
	}
	return {
		minX,
		minY,
		width: maxX - minX || 1,
		height: maxY - minY || 1,
	};
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
		const fill = shape.fillColor ?? paletteColour(i, palette);
		const relX = shape.x - minX;
		const relY = shape.y - minY;
		const isEllipse = shape.shapeType === 'ellipse';
		const rx = shape.shapeType === 'roundRect' ? Math.min(shape.width, shape.height) * 0.1 : 0;
		const cx = relX + shape.width / 2;
		const cy = relY + shape.height / 2;
		const stroke = shape.strokeColor ?? (sw > 0 ? 'rgba(255,255,255,0.3)' : 'none');
		const transform =
			shape.rotation !== undefined ? `rotate(${shape.rotation} ${cx} ${cy})` : undefined;

		return {
			key: `${elementId}-dsp-${shape.id}-${i}`,
			isEllipse,
			x: relX,
			y: relY,
			width: shape.width,
			height: shape.height,
			rx,
			cx,
			cy,
			fill,
			stroke,
			strokeWidth: shape.strokeWidth ?? sw,
			transform,
			text: shape.text ? truncate(shape.text, 30) : undefined,
			textX: cx,
			textY: cy,
			fontColor: shape.fontColor ?? 'white',
			fontSize: shape.fontSize ?? Math.max(8, Math.min(14, shape.height * 0.2)),
		};
	});
}

/** Drop-shadow filter string for the given style intensity. */
export function styleShadowFilter(style: SmartArtStyle): string | undefined {
	return styleShadow(style);
}
