/**
 * `snake` algorithm (ECMA-376 Part 1, 21.4.2.x): children fill a grid whose
 * `(cols, rows)` dimensions come from the node's own aspect ratio, or from a
 * fixed line length when `bkpt="fixed"` declares one (`bkPtFixedVal`).
 * `flowDir` picks which axis is walked first, `contDir` decides whether
 * alternate lines reverse (the boustrophedon "snake" the algorithm is named
 * for; the ECMA-376 default), `grDir` which corner the grid grows from, and
 * `off="ctr"` centers an incomplete final line under the full lines above it
 * instead of leaving it flush against the growth-corner edge.
 *
 * Every cell gets the SAME size (the node's box divided evenly by the grid,
 * less the `sibSp`/`sp`-derived gap between cells) - this mirrors the legacy
 * family interpreter's `arrangeSnake` (`smartart-layout-interpreter-
 * snake.ts`), which the gallery corpus measured accurate for the 35 fixtures
 * that resolve to the `snake` family; unlike that interpreter, which font-fits
 * every cell as one shared decision, this engine leaves each cell's own
 * subtree (its `sp`/`tx`/`composite` children) to size itself the same way
 * every other per-point algorithm does, via the ordinary constraint/font-fit
 * pipeline the layout driver already runs for it.
 */

import type { Box, EngineNode } from './engine-node';

type FlowDir = 'row' | 'col';
type GrowDir = 'tL' | 'tR' | 'bL' | 'bR';

interface GridDims {
	cols: number;
	rows: number;
}

function gridDims(node: EngineNode, n: number, w: number, h: number, flowDir: FlowDir): GridDims {
	const bkpt = node.alg.params.bkpt;
	const fixedVal = node.values.get('bkPtFixedVal');
	if (bkpt === 'fixed' && fixedVal !== undefined && fixedVal > 0) {
		const lineLength = Math.max(1, Math.min(n, Math.round(fixedVal)));
		if (flowDir === 'col') {
			const rows = lineLength;
			return { cols: Math.max(1, Math.ceil(n / rows)), rows };
		}
		const cols = lineLength;
		return { cols, rows: Math.max(1, Math.ceil(n / cols)) };
	}
	if (flowDir === 'col') {
		const rows = Math.max(1, Math.round(Math.sqrt(n * Math.max(0.2, h / Math.max(1, w)))));
		return { cols: Math.max(1, Math.ceil(n / rows)), rows };
	}
	const cols = Math.max(1, Math.round(Math.sqrt(n * Math.max(0.2, w / Math.max(1, h)))));
	return { cols, rows: Math.max(1, Math.ceil(n / cols)) };
}

function snakeCell(
	i: number,
	dims: GridDims,
	flowDir: FlowDir,
	sameDir: boolean,
	grDir: GrowDir,
): { col: number; row: number } {
	const primaryCount = flowDir === 'col' ? dims.rows : dims.cols;
	const line = Math.floor(i / primaryCount);
	let posInLine = i % primaryCount;
	if (!sameDir && line % 2 === 1) {
		posInLine = primaryCount - 1 - posInLine;
	}
	let col = flowDir === 'col' ? line : posInLine;
	let row = flowDir === 'col' ? posInLine : line;
	if (grDir === 'tR' || grDir === 'bR') {
		col = dims.cols - 1 - col;
	}
	if (grDir === 'bL' || grDir === 'bR') {
		row = dims.rows - 1 - row;
	}
	return { col, row };
}

export function arrangeSnake(node: EngineNode): void {
	const box = node.box;
	const n = node.children.length;
	if (!box || n === 0) {
		return;
	}
	const params = node.alg.params;
	const flowDir: FlowDir = params.flowDir === 'col' ? 'col' : 'row';
	const grDirRaw = params.grDir;
	const grDir: GrowDir =
		grDirRaw === 'tR' || grDirRaw === 'bL' || grDirRaw === 'bR' ? grDirRaw : 'tL';
	// `contDir` defaults to the boustrophedon (alternating) behaviour; only an
	// explicit `sameDir` disables the reversal (matches the legacy arranger).
	const sameDir = params.contDir === 'sameDir';
	const dims = gridDims(node, n, box.w, box.h, flowDir);
	const sib = node.values.get('sibSp') ?? node.values.get('sp') ?? 0.15;
	const mainCount = flowDir === 'col' ? dims.rows : dims.cols;
	const usableMain = flowDir === 'col' ? box.h : box.w;
	const gap = (sib * usableMain) / (mainCount + sib * (mainCount - 1));
	const cellW = (box.w - Math.max(0, dims.cols - 1) * gap) / dims.cols;
	const cellH = (box.h - Math.max(0, dims.rows - 1) * gap) / dims.rows;

	const cells = node.children.map((_child, i) => snakeCell(i, dims, flowDir, sameDir, grDir));
	const centerIncompleteLines = params.off === 'ctr';
	const fullLineCount = flowDir === 'row' ? dims.cols : dims.rows;
	const lineCounts = new Map<number, number>();
	if (centerIncompleteLines) {
		for (const c of cells) {
			const key = flowDir === 'row' ? c.row : c.col;
			lineCounts.set(key, (lineCounts.get(key) ?? 0) + 1);
		}
	}

	node.children.forEach((child, i) => {
		const { col, row } = cells[i];
		let x = box.x + col * (cellW + gap);
		let y = box.y + row * (cellH + gap);
		if (centerIncompleteLines) {
			const key = flowDir === 'row' ? row : col;
			const count = lineCounts.get(key) ?? fullLineCount;
			if (count < fullLineCount) {
				const shift =
					((fullLineCount - count) * (flowDir === 'row' ? cellW + gap : cellH + gap)) / 2;
				if (flowDir === 'row') {
					x += shift;
				} else {
					y += shift;
				}
			}
		}
		const cellBox: Box = { x, y, w: cellW, h: cellH };
		child.box = cellBox;
	});
}
