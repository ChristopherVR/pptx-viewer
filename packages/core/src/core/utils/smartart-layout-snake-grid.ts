/**
 * SmartArt DiagramML interpreter - `snake` grid geometry.
 *
 * Split out of `smartart-layout-interpreter-linear.ts` (which was pushing
 * past the repo's per-file line budget): resolves the `snake` algorithm's
 * `(cols, rows)` grid dimensions and maps a flat data-point index to a
 * `(col, row)` cell, honouring `grDir`/`flowDir`/`contDir`/`bkpt`. Pure
 * geometry; no framework code.
 */

import { findConstraint } from './smartart-layout-interpreter-constraints';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { algorithmParam } from './smartart-layout-interpreter-model';

/** `dgm:param[@type=flowDir]`: which axis fills first (`row`, the default, or `col`). */
export type SnakeFlowDir = 'row' | 'col';

/**
 * `dgm:param[@type=grDir]`: starting corner + growth axes. `tL` (top-left,
 * default) grows right/down; `tR` mirrors the column axis, `bL` the row axis,
 * `bR` both - matching the same four-corner vocabulary PowerPoint's own grid
 * layouts (picture/table grids) use for "grow direction".
 */
export type SnakeGrowDir = 'tL' | 'tR' | 'bL' | 'bR';

/** Grid cell counts along the fill axis (`primary`) and the wrap axis (`secondary`). */
export interface SnakeGridDims {
	cols: number;
	rows: number;
}

/**
 * Resolve the grid's column/row counts. `bkpt="fixed"` (with the `bkPtFixedVal`
 * constraint giving the fixed line length) breaks to a new row/column after
 * exactly that many items, honouring `flowDir` for which axis it counts along.
 * Any other `bkpt` (`bal`/`endCnt`/absent) keeps the existing area-based grid
 * guess, computed against whichever box dimension is the fill axis.
 */
export function snakeGridDims(
	plan: ArrangementPlan,
	n: number,
	w: number,
	h: number,
	flowDir: SnakeFlowDir,
): SnakeGridDims {
	const bkpt = algorithmParam(plan.node, 'bkpt');
	const fixedVal = findConstraint(plan.node.constraints, 'bkPtFixedVal')?.value;
	if (bkpt === 'fixed' && typeof fixedVal === 'number' && fixedVal > 0) {
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

/**
 * Map data-point index `i` to a `(col, row)` grid cell honouring `flowDir` (which
 * axis is walked first), `contDir` (whether alternate lines reverse - the
 * boustrophedon "snake" the algorithm is named for - or every line reads the
 * same direction), and `grDir` (which corner the grid grows from).
 */
export function snakeCell(
	i: number,
	dims: SnakeGridDims,
	flowDir: SnakeFlowDir,
	sameDir: boolean,
	grDir: SnakeGrowDir,
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
