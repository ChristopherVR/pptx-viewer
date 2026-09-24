/**
 * Axis labels for the right-angle-axes 3D bar chart
 * (`chart-3d-oblique-layout.ts`), placed where PowerPoint puts them: off the
 * FRONT edges of the box, not off the back wall.
 *
 * - Value labels: along the front edge of the wall that carries the value
 *   gridlines (left edge for columns, bottom edge for a horizontal chart).
 * - Category labels: centred on each category along the other front edge.
 * - `standard` grouping: one series label per depth row, off the right end of
 *   the floor (columns only; PowerPoint's horizontal standard bar has no row
 *   axis labels in its default layout).
 *
 * @module chart-3d-oblique-labels
 */
import type { ObliqueChartLayout } from './chart-3d-oblique-layout';
import { axisTickValues } from './chart-view-model-chrome';

/** Points to chart px (96 dpi). */
const PT = 4 / 3;
/** Gap between a value label and the box edge it labels. */
export const OBLIQUE_VALUE_LABEL_GAP = 13.5 * PT;
/** Gap between a category or series label and the box edge it labels. */
export const OBLIQUE_CATEGORY_LABEL_GAP = 14 * PT;
const VALUE_GAP = OBLIQUE_VALUE_LABEL_GAP;
const CATEGORY_GAP = OBLIQUE_CATEGORY_LABEL_GAP;

/** One label, in chart px. */
export interface ObliqueLabel {
	role: 'value' | 'category' | 'series';
	text: string;
	x: number;
	y: number;
	anchor: 'start' | 'middle' | 'end';
	/** `central` centres the text on `y`. */
	baseline: 'central' | 'hanging';
	fontSize: number;
}

export interface ObliqueLabelInput {
	fontSize: number;
	categories: readonly string[];
	seriesNames: readonly string[];
	valueText: (value: number) => string;
}

type LayoutCore = Pick<
	ObliqueChartLayout,
	'horizontal' | 'grouping' | 'origin' | 'shear' | 'box' | 'range' | 'valueScale'
>;

function screen(layout: LayoutCore, x: number, y: number, z: number): { x: number; y: number } {
	return {
		x: layout.origin.x + x + z * layout.shear.x,
		y: layout.origin.y - y + z * layout.shear.y,
	};
}

/** Every axis label for a laid-out oblique bar chart. */
export function buildObliqueLabels(layout: LayoutCore, input: ObliqueLabelInput): ObliqueLabel[] {
	const labels: ObliqueLabel[] = [];
	const { w, h, d } = layout.box;
	const span = layout.range.max - layout.range.min;
	const fontSize = input.fontSize;
	for (const v of axisTickValues({ ...layout.range, span })) {
		const p = (v - layout.range.min) * layout.valueScale;
		if (layout.horizontal) {
			const at = screen(layout, p, 0, 0);
			labels.push({
				role: 'value',
				text: input.valueText(v),
				x: at.x,
				y: at.y + CATEGORY_GAP,
				anchor: 'middle',
				baseline: 'central',
				fontSize,
			});
		} else {
			const at = screen(layout, 0, p, 0);
			labels.push({
				role: 'value',
				text: input.valueText(v),
				x: at.x - VALUE_GAP,
				y: at.y,
				anchor: 'end',
				baseline: 'central',
				fontSize,
			});
		}
	}
	const nCat = input.categories.length;
	const catExtent = layout.horizontal ? h : w;
	input.categories.forEach((text, c) => {
		const mid = ((c + 0.5) / nCat) * catExtent;
		if (layout.horizontal) {
			const at = screen(layout, 0, mid, 0);
			labels.push({
				role: 'category',
				text,
				x: at.x - CATEGORY_GAP,
				y: at.y,
				anchor: 'end',
				baseline: 'central',
				fontSize,
			});
		} else {
			const at = screen(layout, mid, 0, 0);
			labels.push({
				role: 'category',
				text,
				x: at.x,
				y: at.y + CATEGORY_GAP,
				anchor: 'middle',
				baseline: 'central',
				fontSize,
			});
		}
	});
	if (layout.grouping === 'standard' && !layout.horizontal) {
		const rows = input.seriesNames.length;
		input.seriesNames.forEach((text, s) => {
			const at = screen(layout, w, 0, ((s + 0.5) / rows) * d);
			labels.push({
				role: 'series',
				text,
				x: at.x + CATEGORY_GAP,
				y: at.y,
				anchor: 'start',
				baseline: 'central',
				fontSize,
			});
		});
	}
	return labels;
}
