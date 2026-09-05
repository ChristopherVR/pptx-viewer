/**
 * chart-datapoint-picture-fills.ts: wires {@link resolveDataPointPictureFill}'s
 * pure pattern descriptor onto an already-built primitive list (C2-G9 render
 * half).
 *
 * `resolveDataPointPictureFill` (`chart-datapoint-style.ts`) resolves WHAT
 * picture, in WHAT format, a data point wants; it has no geometry, so it
 * cannot size the `<pattern>` it describes. This module is the one place that
 * has both: it walks the finished `SvgRect` primitives every bar/column
 * builder already tags with a `part: { role: 'dataPoint', ... }` ref, resolves
 * each one's picture fill against the point's actual rect, and rewrites that
 * rect's `fill` to `url(#...)`. Every bar/column builder therefore gets
 * picture fills for free, with no per-builder change and no risk of the
 * lookup and the paint drifting apart (see `upsertDataPoint`'s doc comment for
 * why keying by index alone is the historical failure mode here).
 *
 * @module chart-datapoint-picture-fills
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { resolveDataPointPictureFill } from './chart-datapoint-style';
import type { ChartSvgDef, SvgPrimitive, SvgRect } from './chart-view-model-types';

/**
 * Apply every resolvable `c:dPt/c:pictureOptions` picture fill found among
 * `primitives`'s data-point rects, returning the (possibly) rewritten
 * primitive list plus the `<pattern>` defs a binding must render into the
 * chart's `<defs>` for the `url(#...)` fills to resolve.
 *
 * `elementId` prefixes every pattern id so two chart instances on the same
 * slide (sharing one HTML document's id namespace) never collide; the pure
 * resolver's own `patternId` is scoped only to series/point index.
 */
export function applyDataPointPictureFills(
	chartData: PptxChartData,
	elementId: string,
	primitives: readonly SvgPrimitive[],
): { primitives: SvgPrimitive[]; defs: ChartSvgDef[] } {
	const defs: ChartSvgDef[] = [];
	const next = primitives.map((primitive): SvgPrimitive => {
		if (
			primitive.kind !== 'rect' ||
			!primitive.part ||
			primitive.part.role !== 'dataPoint' ||
			primitive.part.pointIndex === undefined
		) {
			return primitive;
		}
		const series = chartData.series[primitive.part.seriesIndex];
		if (!series) {
			return primitive;
		}
		const resolved = resolveDataPointPictureFill(
			series,
			primitive.part.pointIndex,
			primitive.part.seriesIndex,
		);
		if (!resolved) {
			return primitive;
		}
		const patternId = `${elementId}-${resolved.patternId}`;
		defs.push(
			pictureFillDef(
				patternId,
				resolved.imageUrl,
				resolved.format,
				primitive,
				resolved.tileHeightPx,
			),
		);
		return { ...primitive, fill: `url(#${patternId})` } satisfies SvgRect;
	});
	return { primitives: next, defs };
}

/**
 * Build the `<pattern>` def for one picture-filled rect. `stretch` covers the
 * whole rect with one non-uniformly scaled copy, matching PowerPoint's
 * "Stretch" option; `stack`/`stackScale` repeat the image at
 * {@link tileHeightPx} (falling back to the rect's own height, i.e. one tile,
 * when the point set no `c:pictureStackUnit`), cropped to the tile like
 * PowerPoint's "Stack" fill.
 */
function pictureFillDef(
	id: string,
	href: string,
	format: 'stretch' | 'stack' | 'stackScale',
	rect: SvgRect,
	tileHeightPx: number | undefined,
): ChartSvgDef {
	const stretch = format === 'stretch';
	return {
		kind: 'pattern',
		id,
		href,
		patternUnits: 'userSpaceOnUse',
		x: rect.x,
		y: rect.y,
		width: rect.w,
		height: stretch ? rect.h : (tileHeightPx ?? rect.h),
		preserveAspectRatio: stretch ? 'none' : 'xMidYMid slice',
	};
}
