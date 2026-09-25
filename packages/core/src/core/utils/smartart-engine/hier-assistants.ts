/**
 * Org-chart assistants (ECMA-376 Part 1, 21.4.2.6/21.4.2.7: `asst` points
 * under a `hierRoot`, laid out by their own `hierChild` row, the built-in
 * org charts' `hierChild3` / `forEach ptType="asst"`).
 *
 * Measured on `smartart-orgchart-hierbranch.pptx` (four managers with two
 * assistants, `hierBranch` std/hang/l/r) and
 * `smartart-orgchart-fan-variants.pptx` (one assistant each):
 *
 * - the assistants sit in their own band one `sp` below the manager, ABOVE
 *   every other row, which then starts one `sp` below the band;
 * - they pair up around the manager's centre line, first on the left: the
 *   left one ends and the right one starts `sibSp / 2` from the centre
 *   (`0.105 W` for the org charts' `sibSp = 0.21 W`), whatever `hierBranch`
 *   the manager hangs its reports with; a lone assistant sits on the left;
 * - a hanging manager with assistants insets its column by its `alignOff`
 *   (the definitions switch it from 0.25 to 0.65 when an assistant exists),
 *   read in `hier-measure.ts`.
 *
 * Further pairs stack one `sp` below the previous pair (the rows' own
 * `secLinDir="fromT"`).
 */

import type { EngineNode } from './engine-node';
import type { HierShape, OutlineRect } from './hier-shape';
import { boundsOf, shiftShape } from './hier-shape';

/** Whether every item of a `hierChild` row is an assistant. */
export function isAssistantRow(row: EngineNode, items: readonly EngineNode[]): boolean {
	return (
		items.length > 0 &&
		items.every((item) => item.point.type === 'asst') &&
		row.alg.type === 'hierChild'
	);
}

/**
 * Whether a `hierChild` row splits its items into two columns either side
 * of its parent's connector (`secLinDir`: the assistants' row, and a
 * `hierBranch="hang"` manager's reports).
 */
export function isTwoColumnRow(row: EngineNode): boolean {
	return row.alg.params.secLinDir !== undefined;
}

/**
 * Place measured subtrees in two columns either side of the line `centre`,
 * starting at `top`: items alternate left, right; each column stacks its
 * items `sp` apart and left-aligns them, the left column ending and the
 * right one starting `gap / 2` from the line. Measured on
 * `smartart-orgchart-hierbranch.pptx`'s hanging manager: the first report's
 * whole subtree ends `sibSp / 2` left of the manager's centre, the second
 * starts `sibSp / 2` right of it, and the third drops below the first,
 * flush with its subtree's left edge. Returns the outline and its bottom.
 */
export function placeTwoColumns(
	shapes: readonly HierShape[],
	centre: number,
	top: number,
	gap: number,
	sp: number,
): { rects: OutlineRect[]; bottom: number } {
	const rects: OutlineRect[] = [];
	let bottom = top;
	for (const side of [0, 1]) {
		const column = shapes.filter((_, i) => i % 2 === side);
		const width = Math.max(0, ...column.map((shape) => boundsOf(shape.rects).w));
		const left = side === 0 ? centre - gap / 2 - width : centre + gap / 2;
		let y = top;
		for (const shape of column) {
			const bounds = boundsOf(shape.rects);
			rects.push(...shiftShape(shape, left - bounds.x, y - bounds.y).rects);
			y += bounds.h + sp;
			bottom = Math.max(bottom, y - sp);
		}
	}
	return { rects, bottom };
}
