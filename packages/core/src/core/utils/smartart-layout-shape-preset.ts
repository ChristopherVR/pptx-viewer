/**
 * Map a layoutNode's `dgm:shape` preset geometry
 * (`PptxSmartArtLayoutNodeShape.presetGeometry`) to the coarse render kind
 * (rect/circle/polygon) an arranger's per-point item builder should use,
 * instead of the arranger hardcoding one shape for its whole family.
 *
 * Scope: this is a coarse mapping onto the interpreter's three existing
 * `RenderedNode` kinds, not a full DrawingML preset-geometry renderer.
 * Preset names outside the recognised sets fall back to the arranger's own
 * default, so an unmapped preset degrades to the pre-existing behaviour
 * rather than rendering something wrong.
 *
 * @module smartart-layout-shape-preset
 */

import type { PptxSmartArtLayoutNodeShape } from '../types';
import { chevronPoints } from './smartart-layout-style-helpers';

export type PresetRenderKind = 'rect' | 'circle' | 'polygon';

const CIRCLE_PRESETS = new Set(['ellipse', 'circle', 'donut', 'pie', 'blockArc']);

const POLYGON_PRESETS = new Set([
	'chevron',
	'homePlate',
	'triangle',
	'diamond',
	'trapezoid',
	'nonIsoscelesTrapezoid',
	'hexagon',
	'pentagon',
	'parallelogram',
	'octagon',
]);

/** `roundRect`-family presets: still a rect, but with an adj-driven corner radius. */
const ROUND_RECT_PRESETS = new Set([
	'roundRect',
	'round1Rect',
	'round2SameRect',
	'round2DiagRect',
	'snip1Rect',
	'snip2SameRect',
	'snip2DiagRect',
	'snipRoundRect',
]);

/**
 * Resolve which coarse kind a layoutNode's own `dgm:shape` override should
 * render as. Returns `fallback` (the arranger's hardcoded family default)
 * when the node carries no shape override, or an unrecognised preset name.
 */
export function resolvePresetRenderKind(
	shape: PptxSmartArtLayoutNodeShape | undefined,
	fallback: PresetRenderKind,
): PresetRenderKind {
	const preset = shape?.presetGeometry;
	if (!preset) {
		return fallback;
	}
	if (CIRCLE_PRESETS.has(preset)) {
		return 'circle';
	}
	if (POLYGON_PRESETS.has(preset)) {
		return 'polygon';
	}
	if (ROUND_RECT_PRESETS.has(preset) || preset === 'rect') {
		return 'rect';
	}
	return fallback;
}

/**
 * Resolve a `roundRect`-family preset's corner-radius fraction (0..1 of the
 * shorter side) from its first (`idx=1`) `dgm:adjLst` value, PowerPoint's own
 * default (0.15, matching `rectNode`'s pre-existing hardcoded rx heuristic)
 * when the preset is round-rect-family but carries no adjustment, or
 * `undefined` for a plain `rect`/other preset (no override).
 */
export function presetCornerRadiusFraction(
	shape: PptxSmartArtLayoutNodeShape | undefined,
): number | undefined {
	const preset = shape?.presetGeometry;
	if (!preset || !ROUND_RECT_PRESETS.has(preset)) {
		return undefined;
	}
	const raw = shape?.adjustments?.find((adjustment) => adjustment.index === 1)?.value;
	if (raw === undefined) {
		return 0.15;
	}
	// DrawingML adj values are conventionally 0..1 already in this codebase's
	// typed model (see `smartart-layout-node-shape.ts`), but tolerate a raw
	// 0..100000 guide-unit value some producers still emit for `a:gd`-style
	// adjustments reused verbatim.
	return raw > 1 ? raw / 100000 : raw;
}

/**
 * Build SVG polygon `points` for a preset geometry inscribed in the box
 * `[x, y, w, h]`. Falls back to a plain rectangle outline (4 corners) for an
 * unrecognised polygon preset, so the item still renders something
 * reasonable rather than nothing.
 */
export function presetPolygonPoints(
	preset: string | undefined,
	x: number,
	y: number,
	w: number,
	h: number,
): string {
	switch (preset) {
		case 'chevron':
		case 'homePlate':
			return chevronPoints(x, y, w, h);
		case 'triangle':
			return `${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`;
		case 'diamond':
			return `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`;
		case 'trapezoid': {
			const inset = w * 0.15;
			return `${x + inset},${y} ${x + w - inset},${y} ${x + w},${y + h} ${x},${y + h}`;
		}
		case 'nonIsoscelesTrapezoid': {
			const inset = w * 0.2;
			return `${x + inset},${y} ${x + w},${y} ${x + w - inset * 0.5},${y + h} ${x},${y + h}`;
		}
		case 'hexagon': {
			const inset = Math.min(w * 0.25, h * 0.5);
			return (
				`${x + inset},${y} ${x + w - inset},${y} ${x + w},${y + h / 2} ` +
				`${x + w - inset},${y + h} ${x + inset},${y + h} ${x},${y + h / 2}`
			);
		}
		case 'pentagon':
			return (
				`${x + w / 2},${y} ${x + w},${y + h * 0.38} ${x + w * 0.82},${y + h} ` +
				`${x + w * 0.18},${y + h} ${x},${y + h * 0.38}`
			);
		case 'parallelogram': {
			const shift = w * 0.2;
			return `${x + shift},${y} ${x + w},${y} ${x + w - shift},${y + h} ${x},${y + h}`;
		}
		case 'octagon': {
			const inset = Math.min(w, h) * 0.25;
			return (
				`${x + inset},${y} ${x + w - inset},${y} ${x + w},${y + inset} ` +
				`${x + w},${y + h - inset} ${x + w - inset},${y + h} ${x + inset},${y + h} ` +
				`${x},${y + h - inset} ${x},${y + inset}`
			);
		}
		default:
			return `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`;
	}
}
