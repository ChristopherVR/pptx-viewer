/**
 * chart-interaction-radar.ts: drag-to-value math for a radar/spider vertex.
 *
 * A radar chart has no straight value axis either: each category is its own
 * spoke radiating from the plot centre. Dragging a vertex is a RADIAL drag
 * along its fixed spoke direction (`radarAngle`), so the pointer's component
 * along that spoke, scaled by the ring radius/max-value ratio
 * `buildRadarViewModel` already draws with, is the new value.
 *
 * @module chart-interaction-radar
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { roundDragValue } from './chart-interaction';
import { computePlotLayout, radarAngle } from './chart-view-model';
import type { ValueRange } from './chart-view-model';

/** Geometry a radar vertex drag needs, resolved once at drag start. */
export interface RadarDragGeometry {
	cx: number;
	cy: number;
	/** Outer ring radius (view-box units). */
	radius: number;
	/** Largest absolute value across every series, the outer ring's value. */
	maxVal: number;
	/** This vertex's fixed spoke angle (radians). */
	angle: number;
}

/**
 * Resolve the drag geometry for `pointIndex`'s vertex, or `null` when
 * `chartData` is not a radar chart or the index is out of range. Mirrors
 * `buildRadarViewModel`'s own cx/cy/radius/maxVal derivation exactly
 * (chart-view-model-radar.ts) so the drag target never drifts from what is
 * actually drawn.
 */
export function buildRadarDragGeometry(
	element: { width: number; height: number },
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	pointIndex: number,
): RadarDragGeometry | null {
	if (chartData.chartType !== 'radar') {
		return null;
	}
	const catCount = Math.max(categoryLabels.length, 1);
	if (pointIndex < 0 || pointIndex >= catCount) {
		return null;
	}
	const layout = computePlotLayout(element.width, element.height, chartData, false),
		cx = layout.plotLeft + layout.plotWidth / 2,
		cy = layout.plotTop + layout.plotHeight / 2,
		radius = Math.max(Math.min(layout.plotWidth, layout.plotHeight) / 2 - 4, 1),
		maxVal = Math.max(1, ...chartData.series.flatMap((s) => s.values.map((v) => Math.abs(v)))),
		angle = radarAngle(pointIndex, catCount);
	return { cx, cy, radius, maxVal, angle };
}

/**
 * New value for the dragged vertex given the pointer's (view-box) position:
 * the pointer vector from the centre is projected onto the spoke direction
 * (perpendicular drift is ignored, matching "radial drag along the category
 * spoke"), clamped to non-negative, then scaled back from ring radius to
 * value via the same `radius / maxVal` ratio the renderer draws with.
 */
export function resolveRadarDragValue(
	geometry: RadarDragGeometry,
	pointerX: number,
	pointerY: number,
): number {
	const { cx, cy, radius, maxVal, angle } = geometry,
		dx = pointerX - cx,
		dy = pointerY - cy,
		radial = Math.max(dx * Math.cos(angle) + dy * Math.sin(angle), 0),
		value = (radial / radius) * maxVal,
		range: ValueRange = {
			min: 0,
			max: Math.max(maxVal, value, 1),
			span: Math.max(maxVal, value, 1),
		};
	return roundDragValue(value, range);
}
