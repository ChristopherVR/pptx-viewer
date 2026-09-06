/**
 * Fallback table for regionMap categories that could not be matched to a
 * known world region (rendered as SVG text rows below the map/legend).
 *
 * Split out of `chart-waterfall-map.ts` (which re-exports the regionMap
 * builder that consumes this) to keep that file's two unrelated chart kinds
 * (waterfall, regionMap) each under the repo's per-file line budget.
 *
 * @module chart-region-map-fallback-table
 */

import type { SvgRect, SvgText } from './chart-view-model';
import { formatAxisValue } from './chart-view-model';

/** Row height (px) used both to size the reserved table area and to draw it. */
export const FALLBACK_ROW_HEIGHT = 14;

export interface UnmatchedRegionRow {
	label: string;
	value: number;
}

/** Height (px) to reserve for the fallback table, or 0 when there is nothing to show. */
export function fallbackTableHeight(unmatchedRows: ReadonlyArray<UnmatchedRegionRow>): number {
	if (unmatchedRows.length === 0) {
		return 0;
	}
	const maxFallbackRows = Math.min(unmatchedRows.length, 5);
	return (maxFallbackRows + 1) * FALLBACK_ROW_HEIGHT + 8;
}

/**
 * Build the "Additional regions (not shown on map)" fallback table primitives:
 * a header label, up to 5 alternating-striped rows, and a "+N more" footer
 * when there are more than 5 unmatched rows.
 */
export function buildRegionMapFallbackTable(
	unmatchedRows: ReadonlyArray<UnmatchedRegionRow>,
	legendY: number,
	svgWidth: number,
	svgHeight: number,
): Array<SvgRect | SvgText> {
	if (unmatchedRows.length === 0) {
		return [];
	}

	const primitives: Array<SvgRect | SvgText> = [];
	const maxFallbackRows = Math.min(unmatchedRows.length, 5);
	const tableY = legendY + 26;
	const fontSize = Math.min(8, FALLBACK_ROW_HEIGHT * 0.7);
	const colW = Math.min((svgWidth - 20) / 2, 120);
	const tableX = (svgWidth - colW * 2) / 2;

	primitives.push({
		kind: 'text',
		x: svgWidth / 2,
		y: tableY,
		text: 'Additional regions (not shown on map)',
		fontSize: 7,
		fill: '#94a3b8',
		textAnchor: 'middle',
	} satisfies SvgText);

	for (let i = 0; i < maxFallbackRows; i++) {
		const row = unmatchedRows[i];
		if (row === undefined) {
			continue;
		}
		const ry = tableY + FALLBACK_ROW_HEIGHT * (i + 1);
		if (ry + FALLBACK_ROW_HEIGHT > svgHeight) {
			break;
		}

		if (i % 2 === 0) {
			primitives.push({
				kind: 'rect',
				x: tableX,
				y: ry - FALLBACK_ROW_HEIGHT + 4,
				w: colW * 2,
				h: FALLBACK_ROW_HEIGHT,
				fill: '#f1f5f9',
				rx: 2,
			} satisfies SvgRect);
		}

		primitives.push(
			{
				kind: 'text',
				x: tableX + 4,
				y: ry,
				text: row.label,
				fontSize,
				fill: '#334155',
				textAnchor: 'start',
			} satisfies SvgText,
			{
				kind: 'text',
				x: tableX + colW + 4,
				y: ry,
				text: formatAxisValue(row.value),
				fontSize,
				fill: '#475569',
				textAnchor: 'start',
			} satisfies SvgText,
		);
	}

	if (unmatchedRows.length > 5) {
		const moreY = tableY + FALLBACK_ROW_HEIGHT * 6;
		primitives.push({
			kind: 'text',
			x: svgWidth / 2,
			y: moreY,
			text: `+${unmatchedRows.length - 5} more regions`,
			fontSize: 6,
			fill: '#94a3b8',
			textAnchor: 'middle',
		} satisfies SvgText);
	}

	return primitives;
}
