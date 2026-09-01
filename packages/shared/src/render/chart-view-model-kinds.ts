/**
 * chart-view-model-kinds.ts: the supported chart kinds, their preserveAspectRatio
 * and the chart-type to kind resolver. Split out of `chart-view-model.ts`,
 * which re-exports everything here.
 *
 * @module chart-view-model-kinds
 */

// ─────────────────────────────────────────────────────────────────────────────
// Supported chart kinds
// ─────────────────────────────────────────────────────────────────────────────

export type SupportedChartKind =
	| 'bar'
	| 'line'
	| 'area'
	| 'pie'
	| 'doughnut'
	| 'scatter'
	| 'bubble'
	| 'radar'
	| 'combo'
	| 'stock'
	| 'surface'
	| 'treemap'
	| 'waterfall'
	| 'regionMap'
	| 'funnel'
	| 'sunburst'
	| 'histogram'
	| 'boxWhisker';

/**
 * The `preserveAspectRatio` a chart kind's `<svg>` must carry.
 *
 * Cartesian charts stretch to fill the element box (`none`); the kinds whose
 * geometry is round or laid out on a fixed-ratio canvas (pie, doughnut, radar,
 * and the region map's 1000x500 world outline) keep their proportions instead.
 *
 * A pure decision function because all five bindings need the same answer and
 * four of them had written their own copy of the `kind === 'pie' || ...` chain;
 * one of the copies (React's) disagreed with the rest.
 */
export function chartPreserveAspectRatio(
	kind: SupportedChartKind | 'unsupported',
): 'none' | 'xMidYMid meet' {
	return kind === 'pie' || kind === 'doughnut' || kind === 'radar' || kind === 'regionMap'
		? 'xMidYMid meet'
		: 'none';
}

export function resolveChartKind(chartType: string): SupportedChartKind | 'unsupported' {
	switch (chartType) {
		case 'bar':
		case 'bar3D':
			return 'bar';
		case 'line':
		case 'line3D':
			return 'line';
		case 'area':
		case 'area3D':
			return 'area';
		case 'pie':
		case 'pie3D':
		case 'ofPie':
			return 'pie';
		case 'doughnut':
			return 'doughnut';
		case 'scatter':
			return 'scatter';
		case 'bubble':
			return 'bubble';
		case 'radar':
		case 'radar3D':
			return 'radar';
		case 'combo':
			return 'combo';
		case 'stock':
			return 'stock';
		case 'surface':
		case 'surface3D':
			return 'surface';
		case 'treemap':
			return 'treemap';
		case 'waterfall':
			return 'waterfall';
		case 'regionMap':
			return 'regionMap';
		case 'funnel':
			return 'funnel';
		case 'sunburst':
			return 'sunburst';
		case 'histogram':
			return 'histogram';
		case 'boxWhisker':
			return 'boxWhisker';
		default:
			return 'unsupported';
	}
}
