/**
 * SVG gradient paint servers for cached SmartArt drawing shapes (`a:gradFill`).
 * Split out of `smartart-drawing.ts`.
 *
 * @module render/smartart-drawing-gradient
 */
import type { PptxSmartArtDrawingShape } from 'pptx-viewer-core';

/** One stop of a cached shape's gradient fill, ready to place as an SVG `<stop>`. */
export interface RenderedGradientStop {
	/** Percentage offset, e.g. `"37%"`. */
	offset: string;
	color: string;
	opacity?: number;
}

/**
 * A gradient paint server for a cached shape, in SVG terms.
 *
 * The OOXML angle is already converted to the axis endpoints here, because a
 * gradient is not expressible as a plain `fill` string: the binding has to emit
 * a `<defs>` entry and reference it. Keeping the geometry on this side means the
 * conversion happens once instead of once per binding.
 */
export interface RenderedGradient {
	/** Element id to emit and reference; unique within the diagram. */
	id: string;
	kind: 'linear' | 'radial';
	/** Axis endpoints as percentages (`kind === 'linear'`). */
	x1?: string;
	y1?: string;
	x2?: string;
	y2?: string;
	/** Centre and radius as percentages (`kind === 'radial'`). */
	cx?: string;
	cy?: string;
	r?: string;
	stops: RenderedGradientStop[];
}

/**
 * Build the SVG gradient for a cached shape's `a:gradFill`, or `undefined` when
 * it has none.
 *
 * The OOXML angle is clockwise from +x with y pointing down, which is also the
 * SVG convention, so sin/cos map straight onto the axis endpoints.
 */
export function resolveDrawingShapeGradient(
	shape: PptxSmartArtDrawingShape,
	id: string,
): RenderedGradient | undefined {
	const stops = shape.fillGradientStops;
	if (!stops || stops.length === 0) {
		return undefined;
	}
	const mapped: RenderedGradientStop[] = stops.map((stop) => ({
		offset: `${Math.max(0, Math.min(100, stop.position))}%`,
		color: stop.color,
		...(stop.opacity !== undefined ? { opacity: stop.opacity } : {}),
	}));
	if (shape.fillGradientType === 'radial') {
		return { id, kind: 'radial', cx: '50%', cy: '50%', r: '50%', stops: mapped };
	}
	const radians = ((shape.fillGradientAngle ?? 0) * Math.PI) / 180;
	const dx = Math.cos(radians) / 2;
	const dy = Math.sin(radians) / 2;
	return {
		id,
		kind: 'linear',
		x1: `${(0.5 - dx) * 100}%`,
		y1: `${(0.5 - dy) * 100}%`,
		x2: `${(0.5 + dx) * 100}%`,
		y2: `${(0.5 + dy) * 100}%`,
		stops: mapped,
	};
}
