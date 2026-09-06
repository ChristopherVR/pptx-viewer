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
import { buildPictureFillPatternDef } from './chart-picture-pattern-def';
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
 *
 * This rect IS the front face of a `bar3D` chart's oblique-projection bar (the
 * side/end extrusion polygons are separate `SvgPolygon` primitives, patterned
 * by `chart-3d-depth.ts`), so a `bar3D` chart resolves the fill with
 * `face: 'front'`: `c:applyToFront=0` then correctly leaves this rect on its
 * plain solid/derived fill instead of always painting the picture regardless
 * of the flag. Every other chart kind (a flat 2-D bar, a pie slice, ...) has
 * only one face and is resolved with no face argument, unconditionally
 * painting the picture once resolved (unchanged pre-face-targeting behaviour).
 */
export function applyDataPointPictureFills(
	chartData: PptxChartData,
	elementId: string,
	primitives: readonly SvgPrimitive[],
): { primitives: SvgPrimitive[]; defs: ChartSvgDef[] } {
	const face = chartData.chartType === 'bar3D' ? 'front' : undefined;
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
			face,
		);
		if (!resolved) {
			return primitive;
		}
		const patternId = `${elementId}-${resolved.patternId}`;
		defs.push(
			buildPictureFillPatternDef(
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
