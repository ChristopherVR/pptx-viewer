/**
 * Axis labels for the perspective 3D chart layout (`chart-3d-persp-layout.ts`),
 * placed where PowerPoint puts them (offsets measured on `gt/chart-10,11`):
 *
 * - Value labels: right-aligned 8pt left of the box's front-left edge.
 * - Category labels: centred below the front floor edge, 9pt left and 17pt
 *   down from their point on it.
 * - A horizontal bar box (values along x) swaps the first two: value labels
 *   under the front floor edge, category labels left of the front-left edge.
 * - Series (depth-row) labels: left-aligned off the right floor edge, 9pt right
 *   and 4pt up from their row's centre on it.
 *
 * @module chart-3d-persp-labels
 */
import type { PptxChartAxisFormatting } from 'pptx-viewer-core';

import type { PerspChartLayout } from './chart-3d-persp-layout';
import { perspToScreen } from './chart-3d-persp-view';
import { formatAxisValueWithUnits } from './chart-axis';
import { axisTickValues } from './chart-view-model-chrome';

/** Points to chart px (96 dpi). */
const PT = 4 / 3;
const VALUE_GAP = 8 * PT;
const CATEGORY_DX = -9 * PT;
const CATEGORY_DY = 17 * PT;
const SERIES_DX = 9 * PT;
const SERIES_DY = -4 * PT;

/** One label, in chart px. */
export interface PerspLabel {
	role: 'value' | 'category' | 'series';
	text: string;
	x: number;
	y: number;
	anchor: 'start' | 'middle' | 'end';
	fontSize: number;
}

export interface PerspLabelInput {
	fontSize: number;
	categories: readonly string[];
	/** Depth-row labels; empty when the chart has one row. */
	seriesNames: readonly string[];
	valueAxis: PptxChartAxisFormatting | undefined;
	percent: boolean;
}

type LayoutCore = Pick<
	PerspChartLayout,
	'view' | 'range' | 'categoryX' | 'rows' | 'kind' | 'horizontal'
>;

/** Every axis label for a laid-out perspective chart. */
export function buildPerspLabels(layout: LayoutCore, input: PerspLabelInput): PerspLabel[] {
	const { view, range } = layout;
	const { h, d, w } = view.box;
	const span = range.max - range.min;
	const labels: PerspLabel[] = [];
	const fontSize = input.fontSize;
	for (const v of axisTickValues({ ...range, span })) {
		const t = (v - range.min) / span;
		const text = input.percent
			? `${Math.round(v * 100)}%`
			: formatAxisValueWithUnits(v, input.valueAxis);
		if (layout.horizontal) {
			// Values run along the front floor edge: label under each tick.
			const at = perspToScreen(view, [t * w, 0, 0]);
			labels.push({
				role: 'value',
				text,
				x: at.x,
				y: at.y + CATEGORY_DY,
				anchor: 'middle',
				fontSize,
			});
		} else {
			const at = perspToScreen(view, [0, t * h, 0]);
			labels.push({ role: 'value', text, x: at.x - VALUE_GAP, y: at.y, anchor: 'end', fontSize });
		}
	}
	input.categories.forEach((text, c) => {
		const pos = layout.categoryX[c];
		if (pos === undefined) {
			return;
		}
		if (layout.horizontal) {
			// Categories run up the front-left edge: label to its left.
			const at = perspToScreen(view, [0, pos, 0]);
			labels.push({
				role: 'category',
				text,
				x: at.x - VALUE_GAP,
				y: at.y,
				anchor: 'end',
				fontSize,
			});
			return;
		}
		const at = perspToScreen(view, [pos, 0, 0]);
		labels.push({
			role: 'category',
			text,
			x: at.x + CATEGORY_DX,
			y: at.y + CATEGORY_DY,
			anchor: 'middle',
			fontSize,
		});
	});
	const rows = input.seriesNames.length;
	input.seriesNames.forEach((text, s) => {
		const z =
			layout.kind === 'surface'
				? rows > 1
					? (s / (rows - 1)) * d
					: d / 2
				: ((s + 0.5) / rows) * d;
		const at = perspToScreen(view, [w, 0, z]);
		labels.push({
			role: 'series',
			text,
			x: at.x + SERIES_DX,
			y: at.y + SERIES_DY,
			anchor: 'start',
			fontSize,
		});
	});
	return labels;
}
