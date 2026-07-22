/**
 * chart-pie-labels.ts: pie / doughnut data-label placement, including outside
 * (`c:dLblPos` = `outEnd` / `bestFit`) labels with `c:leaderLines` connectors.
 *
 * PowerPoint pins pie data labels either INSIDE each slice (`ctr`, `inEnd`) or
 * OUTSIDE the rim (`outEnd`, `bestFit`). Outside labels are joined to their slice
 * by a leader line when `c:dLbls/c:showLeaderLines` is set (the default for
 * offset labels). The flat engine previously only produced centred inside labels;
 * this module adds the outside placement + leader-line geometry so offset pie
 * labels render with their connectors.
 *
 * @module chart-pie-labels
 */
import type { PptxChartDataLabelPosition } from 'pptx-viewer-core';

import { formatAxisValue } from './chart-view-model';
import type { PieSliceGeometry, SvgLine, SvgText } from './chart-view-model';

/** Distance (px) an outside label sits beyond the slice rim. */
const LEADER_LENGTH = 14;

export interface PieLabelParams {
	slices: ReadonlyArray<PieSliceGeometry>;
	values: ReadonlyArray<number>;
	cx: number;
	cy: number;
	outerR: number;
	/** Resolved `c:dLblPos`; `outEnd` / `bestFit` place labels outside the rim. */
	position?: PptxChartDataLabelPosition;
	/** `c:showLeaderLines`. Defaults to on for outside labels. */
	showLeaderLines?: boolean;
}

export interface PieLabelResult {
	labels: SvgText[];
	leaderLines: SvgLine[];
}

/** Whether a data-label position renders outside the pie rim. */
export function isOutsidePosition(position: PptxChartDataLabelPosition | undefined): boolean {
	return position === 'outEnd' || position === 'bestFit';
}

/**
 * Build pie/doughnut data labels. Inside positions reuse each slice's centroid
 * (white bold, centred). Outside positions place the label beyond the rim with a
 * leader line from the rim point to the label anchor.
 */
export function buildPieDataLabels(params: PieLabelParams): PieLabelResult {
	const { slices, values, cx, cy, outerR, position, showLeaderLines } = params;
	const outside = isOutsidePosition(position);
	const labels: SvgText[] = [];
	const leaderLines: SvgLine[] = [];

	slices.forEach((slice, i) => {
		const val = values[i];
		if (val === undefined) {
			return;
		}
		if (!outside) {
			labels.push({
				kind: 'text',
				x: slice.labelX,
				y: slice.labelY,
				text: formatAxisValue(val),
				fontSize: 8,
				fill: '#ffffff',
				textAnchor: 'middle',
				fontWeight: 'bold',
				dominantBaseline: 'central',
			});
			return;
		}

		const cos = Math.cos(slice.midAngle);
		const sin = Math.sin(slice.midAngle);
		const rimX = cx + outerR * cos;
		const rimY = cy + outerR * sin;
		const labelX = cx + (outerR + LEADER_LENGTH) * cos;
		const labelY = cy + (outerR + LEADER_LENGTH) * sin;
		const anchor: 'start' | 'end' = cos >= 0 ? 'start' : 'end';

		labels.push({
			kind: 'text',
			x: labelX + (cos >= 0 ? 2 : -2),
			y: labelY,
			text: formatAxisValue(val),
			fontSize: 8,
			fill: '#334155',
			textAnchor: anchor,
			dominantBaseline: 'central',
		});

		// Leader lines default ON for offset labels (only suppressed when the source
		// explicitly clears c:showLeaderLines).
		if (showLeaderLines !== false) {
			leaderLines.push({
				kind: 'line',
				x1: rimX,
				y1: rimY,
				x2: labelX,
				y2: labelY,
				stroke: '#94a3b8',
				strokeWidth: 0.75,
			});
		}
	});

	return { labels, leaderLines };
}
