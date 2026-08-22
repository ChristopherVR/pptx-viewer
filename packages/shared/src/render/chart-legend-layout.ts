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
import { chartFontPx } from './chart-font';
import type { ChartViewModel } from './chart-view-model';

// Horizontal centre-to-centre spacing between legend swatches in a row, and
// vertical spacing between legend swatches stacked in a side column.
const LEGEND_ITEM_WIDTH = 80,
	LEGEND_ITEM_HEIGHT = 14;

// Legend label defaults, unchanged from the hardcoded values every binding's
// projector used before `c:legendEntry/c:txPr` overrides existed. Only a
// chart that actually authors a legend-entry text override diverges from these.
const DEFAULT_LEGEND_FONT_SIZE = 9,
	DEFAULT_LEGEND_TEXT_COLOR = '#475569';

/** One positioned legend entry: swatch origin + colour + label + resolved text style. */
export interface ChartLegendLayoutItem {
	x: number;
	y: number;
	color: string;
	label: string;
	/** Label font size in slide-px, already crossed the pt -> px boundary (see chart-font.ts). */
	fontSize: number;
	/** Label text colour; `c:legendEntry/c:txPr` colour when set, else the default slate. */
	fill: string;
	fontWeight: 'normal' | 'bold';
	fontStyle: 'normal' | 'italic';
	fontFamily?: string;
}

/**
 * Compute the positioned legend entries for a chart view model.
 *
 * @param vm - The chart view model (`vm.legend` / `vm.legendX` / `vm.legendY`
 *   / `vm.legendAnchor`, as produced by `buildChartViewModel`). Each entry may
 *   carry a `textStyle` applied by `applyLegendEntryOverrides` from that
 *   entry's `c:legendEntry/c:txPr` override.
 */
export function computeChartLegendLayout(vm: ChartViewModel): ChartLegendLayoutItem[] {
	const vertical = vm.legendAnchor === 'start';
	return vm.legend.map((entry, i) => {
		const x = vertical
				? vm.legendX
				: vm.legendX - (vm.legend.length * LEGEND_ITEM_WIDTH) / 2 + i * LEGEND_ITEM_WIDTH,
			y = vertical ? vm.legendY + i * LEGEND_ITEM_HEIGHT : vm.legendY,
			textStyle = entry.textStyle;
		return {
			x,
			y,
			color: entry.color,
			label: entry.label,
			fontSize:
				textStyle?.fontSize !== undefined
					? chartFontPx(textStyle.fontSize)
					: DEFAULT_LEGEND_FONT_SIZE,
			fill: textStyle?.color ?? DEFAULT_LEGEND_TEXT_COLOR,
			fontWeight: textStyle?.bold ? 'bold' : 'normal',
			fontStyle: textStyle?.italic ? 'italic' : 'normal',
			fontFamily: textStyle?.fontFamily,
		};
	});
}
