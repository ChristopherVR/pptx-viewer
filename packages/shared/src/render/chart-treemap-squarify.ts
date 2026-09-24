/**
 * Squarified treemap layout algorithm, generic over any weighted node.
 * Split out of `chart-treemap-hierarchy.ts` (which supplies the node/box
 * shapes and drives the recursive render) to keep each file under the
 * repo's ~300-LOC budget.
 *
 * @module chart-treemap-squarify
 */

export interface TreemapBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

interface WeightedNode {
	weight: number;
}

/** Worst (largest) aspect-ratio deviation from square a row of `areas` would have at `side` thickness. */
function worstAspectRatio(areas: readonly number[], side: number): number {
	const sum = areas.reduce((total, area) => total + area, 0);
	const max = Math.max(...areas);
	const min = Math.min(...areas);
	const sideSq = side * side;
	const sumSq = sum * sum;
	return Math.max((sideSq * max) / sumSq, sumSq / (sideSq * min));
}

/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk): repeatedly lays out
 * the widest possible "row" of items along the box's shorter side, adding
 * items to the row only while doing so keeps improving (or not worsening)
 * that row's worst aspect ratio, so cells stay close to square instead of
 * degenerating into thin slivers the way a plain alternating slice-and-dice
 * split does. COM-verified against charts-com.pptx slide 28 (chartEx3.xml):
 * PowerPoint's own treemap mixes row and column splits within the SAME
 * parent region (e.g. a tall cell beside a further row/column split), which
 * a single alternating dimension split can never reproduce.
 */
export function squarify<TNode extends WeightedNode>(
	nodes: readonly TNode[],
	box: TreemapBox,
): Array<[TNode, TreemapBox]> {
	const sorted = [...nodes].sort((a, b) => b.weight - a.weight);
	const total = sorted.reduce((sum, node) => sum + node.weight, 0);
	// Equal-area fallback when every node is weightless (matches the previous
	// slice-and-dice behaviour for this degenerate case).
	const scale = total > 0 ? (box.w * box.h) / total : (box.w * box.h) / sorted.length;
	const items = sorted.map((node) => ({ node, area: (total > 0 ? node.weight : 1) * scale }));

	const result: Array<[TNode, TreemapBox]> = [];
	let rect = { ...box };
	let remaining = items;

	while (remaining.length > 0) {
		const side = Math.min(rect.w, rect.h);
		let row = [remaining[0]];
		let rowAreas = [remaining[0].area];
		let worst = worstAspectRatio(rowAreas, side);
		let cursor = 1;
		while (cursor < remaining.length) {
			const candidateAreas = [...rowAreas, remaining[cursor].area];
			const candidateWorst = worstAspectRatio(candidateAreas, side);
			if (candidateWorst > worst) {
				break;
			}
			row = [...row, remaining[cursor]];
			rowAreas = candidateAreas;
			worst = candidateWorst;
			cursor++;
		}

		const rowTotalArea = rowAreas.reduce((sum, area) => sum + area, 0);
		const thickness = side > 0 ? rowTotalArea / side : 0;
		const layoutVertically = rect.w >= rect.h;
		let offset = layoutVertically ? rect.y : rect.x;
		for (const item of row) {
			const length = thickness > 0 ? item.area / thickness : 0;
			if (layoutVertically) {
				result.push([item.node, { x: rect.x, y: offset, w: thickness, h: length }]);
			} else {
				result.push([item.node, { x: offset, y: rect.y, w: length, h: thickness }]);
			}
			offset += length;
		}

		rect = layoutVertically
			? { ...rect, x: rect.x + thickness, w: rect.w - thickness }
			: { ...rect, y: rect.y + thickness, h: rect.h - thickness };
		remaining = remaining.slice(row.length);
	}
	return result;
}
