/**
 * `snake` algorithm (ECMA-376 Part 1, 21.4.2.x): the node's content points
 * fill a grid line by line, each keeping the size its constraints gave it,
 * with the whole grid scaled uniformly to fit the node.
 *
 * - Cells are the non-transition children; a `sibTrans` child between two
 *   cells is a spacer whose own `w` (`h` for `flowDir="col"`) is the gap
 *   along a line, and the node's `sp` is the gap between lines.
 * - The line length is `bkPtFixedVal` for `bkpt="fixed"`; otherwise every
 *   line length is tried and the one whose grid scales largest into the
 *   node wins (the grid only ever shrinks to fit, never grows) (`bkpt="bal"` then evens the lines out). "Basic Block List":
 *   three `W x 0.6 W` cells, `0.1 W` apart, fit a 650 x 400 frame largest as
 *   two columns, at the cached 307.5 x 184.5.
 * - `flowDir` picks the line axis, `contDir="revDir"` reverses alternate
 *   lines, `grDir` the starting corner, `off="ctr"` centres a short last
 *   line, and `horzAlign`/`vertAlign` place the grid in the node (centred
 *   by default).
 */

import { applyConstraint } from './constraint-eval';
import type { Box, EngineNode } from './engine-node';
import { isSelfSizeConstraint } from './preferred-size';

interface Dims {
	cols: number;
	rows: number;
}

interface Metrics {
	cellW: number;
	cellH: number;
	/** Gap between cells along a line, and between lines. */
	along: number;
	across: number;
}

function isSpacer(child: EngineNode): boolean {
	return child.point.type === 'sibTrans' || child.point.type === 'parTrans';
}

/**
 * A cell's natural size: what the snake node's constraints assigned it,
 * completed by the cell's own self-scoped size constraints (`h refType="w"
 * fact="0.6"` on "Basic Bending Process"'s node). A self-scoped LITERAL size
 * does not override a dimension the parent already assigned: "Bending
 * Picture Accent List"'s `compNode` declares `w val="1"` next to its
 * `h refType="w" fact="1.06"` only to fix the aspect, and the cached cards
 * are sized from the parent's `w = W`, not 1mm. An unconstrained dimension
 * defaults to the snake node's own.
 */
function cellSize(cell: EngineNode, box: Box): { w: number; h: number } {
	const assigned = new Set(['w', 'h'].filter((type) => cell.values.has(type)));
	cell.constraints.forEach((constraint, i) => {
		if (!isSelfSizeConstraint(cell, i)) {
			return;
		}
		const literal = constraint.refType === 'none';
		if (literal && assigned.has(constraint.type)) {
			return;
		}
		applyConstraint(cell, constraint);
	});
	return { w: cell.values.get('w') ?? box.w, h: cell.values.get('h') ?? box.h };
}

function metricsOf(
	node: EngineNode,
	box: Box,
	cells: EngineNode[],
	spacers: EngineNode[],
	row: boolean,
): Metrics {
	const sizes = cells.map((c) => cellSize(c, box));
	const cellW = Math.max(...sizes.map((s) => s.w));
	const cellH = Math.max(...sizes.map((s) => s.h));
	const spacer = spacers[0];
	const along = spacer
		? (spacer.values.get(row ? 'w' : 'h') ?? 0)
		: (node.values.get('sibSp') ?? 0);
	return {
		cellW,
		cellH,
		along: Math.max(0, along),
		across: Math.max(0, node.values.get('sp') ?? 0),
	};
}

function gridSize(dims: Dims, m: Metrics, row: boolean): { w: number; h: number } {
	const lineLen = row ? dims.cols : dims.rows;
	const lines = row ? dims.rows : dims.cols;
	const alongLen = lineLen * (row ? m.cellW : m.cellH) + (lineLen - 1) * m.along;
	const acrossLen = lines * (row ? m.cellH : m.cellW) + (lines - 1) * m.across;
	return row ? { w: alongLen, h: acrossLen } : { w: acrossLen, h: alongLen };
}

function dimsFor(lineLen: number, n: number, row: boolean): Dims {
	const lines = Math.max(1, Math.ceil(n / lineLen));
	return row ? { cols: lineLen, rows: lines } : { cols: lines, rows: lineLen };
}

function chooseDims(node: EngineNode, n: number, m: Metrics, box: Box, row: boolean): Dims {
	const fixed = node.values.get('bkPtFixedVal') ?? Number(node.alg.params.bkPtFixedVal);
	if (node.alg.params.bkpt === 'fixed' && Number.isFinite(fixed) && fixed > 0) {
		return dimsFor(Math.min(n, Math.round(fixed)), n, row);
	}
	let best = dimsFor(n, n, row);
	let bestScale = -Infinity;
	for (let lineLen = n; lineLen >= 1; lineLen--) {
		const dims = dimsFor(lineLen, n, row);
		const size = gridSize(dims, m, row);
		const scale = Math.min(box.w / Math.max(1e-9, size.w), box.h / Math.max(1e-9, size.h));
		if (scale > bestScale + 1e-9) {
			best = dims;
			bestScale = scale;
		}
	}
	if (node.alg.params.bkpt === 'bal') {
		const lines = row ? best.rows : best.cols;
		return dimsFor(Math.ceil(n / lines), n, row);
	}
	return best;
}

function alignOffset(free: number, align: string | undefined, start: string, end: string): number {
	if (align === start) {
		return 0;
	}
	if (align === end) {
		return free;
	}
	return free / 2;
}

export function arrangeSnake(node: EngineNode): void {
	const box = node.box;
	const cells = node.children.filter((c) => !isSpacer(c));
	if (!box || cells.length === 0) {
		return;
	}
	const spacers = node.children.filter(isSpacer);
	const params = node.alg.params;
	const row = params.flowDir !== 'col';
	const m = metricsOf(node, box, cells, spacers, row);
	if (!(m.cellW > 0) || !(m.cellH > 0)) {
		return;
	}
	const n = cells.length;
	const dims = chooseDims(node, n, m, box, row);
	const size = gridSize(dims, m, row);
	// Shrink to fit, never grow: "Text Card Short Line"'s four 0.22 W cards
	// already fit the frame and keep exactly that width in the cached drawing.
	const scale = Math.min(1, box.w / size.w, box.h / size.h);
	const cw = m.cellW * scale;
	const ch = m.cellH * scale;
	const along = m.along * scale;
	const across = m.across * scale;
	const x0 = box.x + alignOffset(box.w - size.w * scale, params.horzAlign, 'l', 'r');
	const y0 = box.y + alignOffset(box.h - size.h * scale, params.vertAlign, 't', 'b');
	const lineLen = row ? dims.cols : dims.rows;
	const grDir = params.grDir ?? 'tL';
	const fromRight = grDir === 'tR' || grDir === 'bR';
	const fromBottom = grDir === 'bL' || grDir === 'bR';
	const reverseAlternate = params.contDir === 'revDir';
	cells.forEach((cell, i) => {
		const line = Math.floor(i / lineLen);
		const inLine = Math.min(lineLen, n - line * lineLen);
		// A reversed (boustrophedon) line runs back from the far end of a full
		// line, so a short last line hugs that far end ("Basic Bending
		// Process": Node Four under Node Three, not under Node One).
		const reversedLine = reverseAlternate && line % 2 === 1;
		const pos = reversedLine ? lineLen - 1 - (i % lineLen) : i % lineLen;
		const centre = params.off === 'ctr' ? (lineLen - inLine) / 2 : 0;
		const shortShift = reversedLine ? -centre : centre;
		let col = row ? pos + shortShift : line;
		let rowIdx = row ? line : pos + shortShift;
		if (fromRight) {
			col = dims.cols - 1 - col;
		}
		if (fromBottom) {
			rowIdx = dims.rows - 1 - rowIdx;
		}
		const gapX = row ? along : across;
		const gapY = row ? across : along;
		cell.box = { x: x0 + col * (cw + gapX), y: y0 + rowIdx * (ch + gapY), w: cw, h: ch };
	});
	for (const spacer of spacers) {
		spacer.box = { x: box.x, y: box.y, w: 0, h: 0 };
	}
}
