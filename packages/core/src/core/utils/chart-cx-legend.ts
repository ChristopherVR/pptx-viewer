/**
 * `cx:legend` builder, split out of `chart-cx-generator.ts` to keep it within
 * the repo's ~300-LOC limit.
 *
 * @module utils/chart-cx-legend
 */
import type { XmlObject } from '../types';

/**
 * A `cx:legend` node. ChartEx positions are `ST_SidePos` (`t`, `b`, `l`, `r`),
 * so the 2006 corner value `tr` folds onto the right edge.
 */
export function buildChartExLegend(legendPosition: string | undefined): XmlObject {
	const pos =
		legendPosition === 't' || legendPosition === 'b' || legendPosition === 'l'
			? legendPosition
			: 'r';
	return { '@_pos': pos, '@_align': 'ctr', '@_overlay': '0' };
}
