import type { PptxChartData } from 'pptx-viewer-core';

/**
 * chart-render-kind: pure dispatch table for `ChartRenderer.vue`, extracted so
 * the SFC stays thin. Maps a chart's `chartType` (+ grouping) to the renderer
 * branch that draws it; 'placeholder' covers the remaining deferred types.
 */
export type RenderKind =
	| 'bar'
	| 'stackedBar'
	| 'line'
	| 'area'
	| 'pie'
	| 'radar'
	| 'scatter'
	| 'bubble'
	| 'waterfall'
	| 'funnel'
	| 'treemap'
	| 'sunburst'
	| 'combo'
	| 'stock'
	| 'histogram'
	| 'boxWhisker'
	| 'surface'
	| 'regionMap'
	| 'placeholder';

/** Render kinds projected through the shared view-model engine. */
export const SHARED_VIEW_MODEL_KINDS: ReadonlySet<RenderKind> = new Set<RenderKind>([
	'pie',
	'radar',
	'bar',
	'stackedBar',
	'line',
	'area',
	'scatter',
	'bubble',
]);

/** Which renderer branch to dispatch a chart's data to. */
export function resolveRenderKind(data: PptxChartData | undefined): RenderKind {
	if (!data) {
		return 'placeholder';
	}
	const t = data.chartType ?? 'bar';
	if (t === 'pie' || t === 'doughnut' || t === 'pie3D') {
		return 'pie';
	}
	if (t === 'area' || t === 'area3D') {
		return 'area';
	}
	if (t === 'line' || t === 'line3D') {
		return 'line';
	}
	if (t === 'bar' && (data.grouping === 'stacked' || data.grouping === 'percentStacked')) {
		return 'stackedBar';
	}
	if (t === 'bar' || t === 'bar3D') {
		return 'bar';
	}
	if (t === 'radar') {
		return 'radar';
	}
	if (t === 'scatter') {
		return 'scatter';
	}
	if (t === 'bubble') {
		return 'bubble';
	}
	if (t === 'waterfall') {
		return 'waterfall';
	}
	if (t === 'funnel') {
		return 'funnel';
	}
	if (t === 'treemap') {
		return 'treemap';
	}
	if (t === 'sunburst') {
		return 'sunburst';
	}
	if (t === 'combo') {
		return 'combo';
	}
	if (t === 'stock') {
		return 'stock';
	}
	if (t === 'histogram') {
		return 'histogram';
	}
	if (t === 'boxWhisker') {
		return 'boxWhisker';
	}
	if (t === 'surface') {
		return 'surface';
	}
	if (t === 'regionMap') {
		return 'regionMap';
	}
	return 'placeholder';
}
