/**
 * Per-sub-path custom-geometry and stroke-only preset SVG rendering.
 *
 * Split out of `vector-shape-renderer.tsx` so that file stays small. The pure
 * paint-decision logic lives in `vector-subpath-paint.ts`; this module only
 * emits the `<path>` elements.
 *
 * The legacy renderer concatenated every custom-geometry sub-path into one
 * `<path>` with a single element-level fill, so a stroke-only sub-path inside a
 * filled shape (or a lightened contour) could not be honoured. These helpers
 * emit one `<path>` per sub-path instead. Open presets such as `arc` are
 * handled the same way: `evaluatePresetShape` reports `fillNone`, and we paint a
 * stroked outline rather than flood-filling the wedge.
 */
import { customGeometryPathsToSvgSubpaths } from 'pptx-viewer-core';
import type { CustomGeometryPath, PresetSubpathResult, ShapeStyle } from 'pptx-viewer-core';
import { svgLineCap } from 'pptx-viewer-shared';
import React from 'react';

import { colorWithOpacity } from './color';
import { getCompoundLineOffsets, getCompoundLineWidths } from './connector-path';
import { buildCustomSubpathPaints } from './vector-subpath-paint';

/** Line-join / miter styling derived from a shape's `a:ln` join settings. */
function joinStyle(shapeStyle: ShapeStyle | undefined): {
	lineJoin: 'round' | 'bevel' | 'miter';
	miterLimit: number | undefined;
} {
	const lineJoin: 'round' | 'bevel' | 'miter' =
		shapeStyle?.lineJoin === 'bevel'
			? 'bevel'
			: shapeStyle?.lineJoin === 'miter'
				? 'miter'
				: 'round';
	// a:miter/@lim is stored in 1000ths of a percent (800000 = 8.0); SVG's
	// stroke-miterlimit is a plain ratio >= 1.
	const miterLimit =
		lineJoin === 'miter' && typeof shapeStyle?.miterLimit === 'number'
			? Math.max(shapeStyle.miterLimit / 100000, 1)
			: undefined;
	return { lineJoin, miterLimit };
}

/** Shared stroke-path styling context used when emitting stroked sub-paths. */
interface StrokeStyleContext {
	strokePaint: string;
	strokeWidth: number;
	dashArray: string | undefined;
	lineCap: 'butt' | 'round' | 'square';
	lineJoin: 'round' | 'bevel' | 'miter';
	miterLimit: number | undefined;
	offsets: number[];
	widths: number[];
}

/** Build the stroke context (incl. compound-line strands) for a shape. */
function strokeContext(
	shapeStyle: ShapeStyle | undefined,
	strokePaint: string,
	strokeWidth: number,
	dashArray: string | undefined,
): StrokeStyleContext {
	const { lineJoin, miterLimit } = joinStyle(shapeStyle);
	return {
		strokePaint,
		strokeWidth,
		dashArray,
		lineCap: svgLineCap(shapeStyle?.lineCap),
		lineJoin,
		miterLimit,
		offsets: getCompoundLineOffsets(shapeStyle?.compoundLine, strokeWidth),
		widths: getCompoundLineWidths(shapeStyle?.compoundLine, strokeWidth),
	};
}

/** Emit the compound (single or parallel) stroke `<path>` strands for one `d`. */
function strokeStrands(d: string, keyBase: string, ctx: StrokeStyleContext): React.ReactNode[] {
	return ctx.offsets.map((offset, idx) => (
		<path
			key={`${keyBase}-s${idx}`}
			d={d}
			fill='none'
			stroke={ctx.strokePaint}
			strokeWidth={Math.max(ctx.widths[idx] ?? ctx.strokeWidth, 1)}
			strokeDasharray={ctx.dashArray}
			strokeLinecap={ctx.lineCap}
			strokeLinejoin={ctx.lineJoin}
			strokeMiterlimit={ctx.miterLimit}
			vectorEffect='non-scaling-stroke'
			style={offset !== 0 ? { transform: `translate(0, ${offset}px)` } : undefined}
		/>
	));
}

/**
 * Render a custom-geometry element as an SVG. When structured sub-paths are
 * present each is painted individually (per-`@fill`/`@stroke`); otherwise the
 * aggregate `pathData` is painted with a single fill plus compound strokes,
 * preserving the legacy behaviour for geometry without structured sub-paths.
 */
export function renderCustomGeometryVector(
	pathData: string,
	pathWidth: number,
	pathHeight: number,
	structuredPaths: CustomGeometryPath[] | undefined,
	shapeStyle: ShapeStyle | undefined,
	hasFill: boolean,
	fillColor: string,
	fillOpacity: number | undefined,
	strokePaint: string,
	strokeWidth: number,
	dashArray: string | undefined,
	// When an active `p:animClr` targets the shape fill, paint every fill path
	// with `fill: inherit` so the wrapper's `fill` colour keyframe cascades in.
	// The stroke is already routed through `strokePaint` (set to `inherit` by
	// the caller when the stroke is animated), so no separate stroke flag.
	animatesFill = false,
): React.ReactNode {
	const ctx = strokeContext(shapeStyle, strokePaint, strokeWidth, dashArray);
	const subpaths =
		structuredPaths && structuredPaths.length > 0
			? customGeometryPathsToSvgSubpaths(structuredPaths, pathWidth, pathHeight)
			: undefined;

	// Per-sub-path rendering reconstructs each sub-path's `d` from the structured
	// geometry, which can diverge from the authoritative aggregate `pathData` for
	// curved shapes (e.g. preset `heart`/`cloud` carried as geometry). Only take
	// that branch when a sub-path genuinely needs independent handling: a
	// non-`norm` fill mode (`lighten`/`darken`/`none`) or an explicit stroke-off.
	// Otherwise paint the proven aggregate `pathData`, matching the legacy
	// renderer exactly so normal filled shapes are pixel-identical.
	const needsPerSubpath =
		subpaths !== undefined &&
		subpaths.some((sp) => (sp.fillMode && sp.fillMode !== 'norm') || sp.stroke === false);

	const nodes: React.ReactNode[] = [];
	if (subpaths && needsPerSubpath) {
		const paints = buildCustomSubpathPaints(subpaths, hasFill, fillColor, fillOpacity);
		paints.forEach((paint, idx) => {
			if (paint.fill !== 'none') {
				nodes.push(
					<path
						key={`f${idx}`}
						d={paint.d}
						fill={animatesFill ? 'inherit' : paint.fill}
						stroke='none'
						vectorEffect='non-scaling-stroke'
					/>,
				);
			}
			if (paint.stroked && strokeWidth > 0) {
				nodes.push(...strokeStrands(paint.d, `p${idx}`, ctx));
			}
		});
	} else {
		if (hasFill) {
			nodes.push(
				<path
					key='fill'
					d={pathData}
					fill={animatesFill ? 'inherit' : colorWithOpacity(fillColor, fillOpacity)}
					stroke='none'
					vectorEffect='non-scaling-stroke'
				/>,
			);
		}
		if (strokeWidth > 0) {
			nodes.push(...strokeStrands(pathData, 'agg', ctx));
		}
	}

	return (
		<svg
			viewBox={`0 0 ${pathWidth} ${pathHeight}`}
			className='w-full h-full pointer-events-none'
			preserveAspectRatio='none'
		>
			{nodes}
		</svg>
	);
}

/**
 * Render a stroke-only preset (e.g. `arc`) as an outlined SVG. Each evaluated
 * sub-path is stroked (honouring its own `@stroke` flag and compound-line
 * strands); no fill is emitted.
 */
export function renderStrokeOnlyPreset(
	presetPaths: PresetSubpathResult[],
	width: number,
	height: number,
	shapeStyle: ShapeStyle | undefined,
	strokePaint: string,
	strokeWidth: number,
	dashArray: string | undefined,
): React.ReactNode {
	const ctx = strokeContext(shapeStyle, strokePaint, Math.max(strokeWidth, 1), dashArray);
	const nodes: React.ReactNode[] = [];
	presetPaths.forEach((path, idx) => {
		if (path.stroke === false) {
			return;
		}
		nodes.push(...strokeStrands(path.d, `pre${idx}`, ctx));
	});
	return (
		<svg
			viewBox={`0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`}
			className='w-full h-full pointer-events-none'
			preserveAspectRatio='none'
		>
			{nodes}
		</svg>
	);
}
