/**
 * Chart legend swatch layout: positions each `ChartViewModel` legend entry
 * (colour swatch + label) for the two anchor modes the shared chart engine
 * produces:
 *
 * - horizontal row (`legendAnchor !== 'start'`, i.e. bottom/top legends):
 *   entries are centred on `vm.legendX` across a fixed-width row.
 * - vertical stack (`legendAnchor === 'start'`, i.e. left/right legends):
 *   entries stack downward from `vm.legendY` at a fixed line height.
 *
 * Every binding's chart projector (React/Vue/Angular/Svelte/Vanilla) declared
 * this same `LEGEND_ITEM_WIDTH = 80` constant and placement formula
 * independently; this module is the single source of truth so a layout tweak
 * lands once for all five.
 *
 * @module chart-legend-layout
 */
import type { ChartViewModel } from './chart-view-model';

// Horizontal centre-to-centre spacing between legend swatches in a row, and
// vertical spacing between legend swatches stacked in a side column.
const LEGEND_ITEM_WIDTH = 80,
	LEGEND_ITEM_HEIGHT = 14;

/** One positioned legend entry: swatch origin + colour + label. */
export interface ChartLegendLayoutItem {
	x: number;
	y: number;
	color: string;
	label: string;
}

/**
 * Compute the positioned legend entries for a chart view model.
 *
 * @param vm - The chart view model (`vm.legend` / `vm.legendX` / `vm.legendY`
 *   / `vm.legendAnchor`, as produced by `buildChartViewModel`).
 */
export function computeChartLegendLayout(vm: ChartViewModel): ChartLegendLayoutItem[] {
	const vertical = vm.legendAnchor === 'start';
	return vm.legend.map((entry, i) => {
		const x = vertical
				? vm.legendX
				: vm.legendX - (vm.legend.length * LEGEND_ITEM_WIDTH) / 2 + i * LEGEND_ITEM_WIDTH,
			y = vertical ? vm.legendY + i * LEGEND_ITEM_HEIGHT : vm.legendY;
		return { x, y, color: entry.color, label: entry.label };
	});
}
