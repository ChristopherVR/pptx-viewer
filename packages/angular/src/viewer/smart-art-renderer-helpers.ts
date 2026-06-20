/**
 * Pure, framework-agnostic helpers for SmartArt rendering.
 *
 * Ported from the Vue component
 *   packages/vue/src/viewer/components/SmartArtRenderer.vue
 * (viewer-first subset: drawing-shapes path + stacked-block fallback).
 *
 * No Angular imports: all exports are plain TypeScript functions / types so
 * they can be unit-tested with vitest without TestBed or the Angular compiler.
 */
import type {
	PptxSmartArtChrome,
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
	SmartArtColorScheme,
	SmartArtStyle,
} from 'pptx-viewer-core';

import type { StyleMap } from './element-style';

// ==========================================================================
// Palette helpers
// ==========================================================================

/** Built-in named colour palettes (mirrors Vue's `PALETTES`). */
export const PALETTES: Record<SmartArtColorScheme, string[]> = {
	colorful1: ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7', '#ec4899'],
	colorful2: ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
	colorful3: ['#0ea5e9', '#84cc16', '#f43e5e', '#a855f7', '#f97316', '#10b981'],
	monochromatic1: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb', '#1d4ed8'],
	monochromatic2: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#4f46e5', '#4338ca'],
};

export const DEFAULT_PALETTE: string[] = PALETTES.colorful1;

/**
 * Pick a colour from `palette` by wrapping `index` around the length.
 */
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

// ==========================================================================
// Style helpers
// ==========================================================================

/**
 * CSS `drop-shadow` filter string for the given style intensity, or
 * `undefined` when no shadow is applied (flat style).
 */
export function styleShadowFilter(style: SmartArtStyle): string | undefined {
	if (style === 'intense') {
		return 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))';
	}
	if (style === 'moderate') {
		return 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))';
	}
	return undefined;
}

/**
 * Default stroke width (points) for the given style intensity.
 * Returns `0` for flat (no stroke), `1.5` for moderate, `2` for intense.
 */
export function styleStrokeWidth(style: SmartArtStyle): number {
	if (style === 'intense') {
		return 2;
	}
	if (style === 'moderate') {
		return 1.5;
	}
	return 0;
}

/**
 * Truncate `text` to at most `max` characters, appending `…` when cut.
 */
export function truncate(text: string, max: number): string {
	if (text.length <= max) {
		return text;
	}
	return `${text.slice(0, max - 1)}…`;
}

// ==========================================================================
// Chrome style
// ==========================================================================

/**
 * `[ngStyle]`-compatible map for the chrome wrapper `<div>`.
 *
 * Applies background colour and/or outline border when `chrome` is present.
 * Always sets `width`/`height` to `100%` and `box-sizing: border-box`.
 */
export function buildChromeStyle(chrome: PptxSmartArtChrome | undefined): StyleMap {
	const s: StyleMap = {
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

// ==========================================================================
// Drawing-shape view-model
// ==========================================================================

/**
 * Projected view-model for a single pre-computed drawing shape, ready for
 * direct use in an SVG `<g>` block.
 */
export interface RenderedShape {
	/** Stable React-style key. */
	key: string;
	/** True → render `<ellipse>`, false → render `<rect>`. */
	isEllipse: boolean;
	/** Rect top-left (relative to the viewBox origin). */
	x: number;
	y: number;
	width: number;
	height: number;
	/** Border-radius for `<rect rx>` (roundRect shapes). */
	rx: number;
	/** Ellipse centre x. */
	cx: number;
	/** Ellipse centre y. */
	cy: number;
	fill: string;
	stroke: string;
	strokeWidth: number;
	/** SVG `transform` attribute, e.g. `rotate(30 50 40)`. */
	transform: string | undefined;
	/** Truncated text label (≤30 chars), or `undefined` when absent. */
	text: string | undefined;
	/** Text anchor x (centre of shape). */
	textX: number;
	/** Text anchor y (centre of shape). */
	textY: number;
	fontColor: string;
	fontSize: number;
}

/**
 * SVG `viewBox` bounding-box derived from all drawing shapes.
 *
 * Returns the minimal bounding box plus `minX`/`minY` offsets used to
 * rebase each shape's position to (0, 0).
 */
export interface DrawingViewBox {
	minX: number;
	minY: number;
	width: number;
	height: number;
}

/**
 * Compute the SVG viewBox that fits all drawing shapes, rebasing to (0, 0).
 *
 * When the array is empty the function returns a 1×1 unit box at the origin.
 */
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
 * Project an array of `PptxSmartArtDrawingShape`s into `RenderedShape` view
 * models, rebasing positions relative to the viewBox origin.
 *
 * @param elementId  - The parent element's ID (used to build stable keys).
 * @param shapes     - Raw drawing shapes from `PptxSmartArtData.drawingShapes`.
 * @param viewBox    - Pre-computed viewBox (from `computeDrawingViewBox`).
 * @param palette    - Active colour palette for fill fallback.
 * @param style      - Visual style intensity affecting stroke width.
 */
export function projectDrawingShapes(
	elementId: string,
	shapes: PptxSmartArtDrawingShape[],
	viewBox: DrawingViewBox,
	palette: string[],
	style: SmartArtStyle,
): RenderedShape[] {
	const { minX, minY } = viewBox;
	const sw = styleStrokeWidth(style);

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

// ==========================================================================
// Fallback block view-model
// ==========================================================================

/**
 * A single coloured block in the stacked fallback list.
 */
export interface FallbackBlock {
	/** Stable key for `@for` tracking. */
	key: string;
	text: string;
	fill: string;
}

/**
 * Depth-first flatten of the node forest (children may be nested).
 *
 * Mirrors Vue's `flattenNodes` helper.
 */
export function flattenNodes(roots: PptxSmartArtNode[]): PptxSmartArtNode[] {
	const out: PptxSmartArtNode[] = [];
	const walk = (n: PptxSmartArtNode): void => {
		out.push(n);
		for (const c of n.children ?? []) {
			walk(c);
		}
	};
	for (const r of roots) {
		walk(r);
	}
	return out;
}

/**
 * Project node text into coloured `FallbackBlock`s for the simple stacked list.
 *
 * @param elementId  - The parent element's ID (used to build stable keys).
 * @param nodes      - Root nodes from `PptxSmartArtData.nodes`.
 * @param palette    - Active colour palette.
 */
export function buildFallbackBlocks(
	elementId: string,
	nodes: PptxSmartArtNode[],
	palette: string[],
): FallbackBlock[] {
	const flat = flattenNodes(nodes);
	return flat.map(
		(n, i): FallbackBlock => ({
			key: `${elementId}-node-${n.id}-${i}`,
			text: n.text,
			fill: paletteColour(i, palette),
		}),
	);
}
