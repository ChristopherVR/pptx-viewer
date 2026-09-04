/**
 * SmartArt DiagramML interpreter - linear (`lin`) and snake (`snake`) arrangers.
 *
 * `lin` lays the data-model points out in a single row or column, honouring the
 * `linDir` direction and the scalar `sibSp`/`begPad`/`endPad`/`w`/`h`
 * constraints. `snake` wraps the points into a boustrophedon grid. Both produce
 * fully-styled rect view-models. Pure geometry; no framework code.
 */

import type { PptxSmartArtNode, SmartArtStyle } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import {
	EMPTY_CONSTRAINT_INDEX,
	resolveConstraint,
	resolveRatioConstraint,
	roleOf,
} from './smartart-constraint-solver';
import type { ArrangementPlan, FlowDirection } from './smartart-layout-interpreter-model';
import { algorithmParam, findConstraint, itemNode } from './smartart-layout-interpreter-model';
import { presetBoxNode } from './smartart-layout-interpreter-preset-node';
import { styleContext } from './smartart-layout-interpreter-render';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

const INSET = 6;

/**
 * Item aspect (height / width), resolved from whatever declares the item
 * role's `h`/`w` - its own `constrLst` (self-scoped), or (the common real-world
 * case) the arranger's `constrLst` with `for="ch" forName="<item role>"`. Both
 * land in the same index bucket (see `smartart-constraint-solver.ts`), and a
 * relative reference (`h` expressed as a `fact` of `w`, or vice versa) is
 * walked automatically.
 */
function itemAspect(plan: ArrangementPlan, index: ConstraintIndex): number | undefined {
	const item = itemNode(plan.node);
	if (!item) {
		return undefined;
	}
	const role = roleOf(item);
	const height = resolveConstraint(index, role, 'h');
	const width = resolveConstraint(index, role, 'w');
	if (typeof height === 'number' && typeof width === 'number' && height > 0 && width > 0) {
		return height / width;
	}
	return undefined;
}

/** Order the data nodes for the resolved flow direction. */
function ordered(nodes: PptxSmartArtNode[], flow: FlowDirection): PptxSmartArtNode[] {
	return flow.reverse ? [...nodes].reverse() : nodes;
}

/** Execute the `lin` algorithm: a single row/column honouring constraints. */
export function arrangeLinear(
	plan: ArrangementPlan,
	flow: FlowDirection,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	index: ConstraintIndex = EMPTY_CONSTRAINT_INDEX,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const ctx = styleContext(style);
	const constraints = plan.node.constraints;
	const role = roleOf(plan.node);
	const sib = resolveRatioConstraint(constraints, index, role, ['sibSp', 'sp'], 0.25);
	const begPad = resolveRatioConstraint(constraints, index, role, ['begPad'], 0);
	const endPad = resolveRatioConstraint(constraints, index, role, ['endPad'], 0);
	const aspect = itemAspect(plan, index);
	const flow2 = ordered(nodes, flow);
	const n = flow2.length;
	const horizontal = flow.orientation === 'horizontal';
	const usableMain = (horizontal ? w : h) - INSET * 2;
	const usableCross = (horizontal ? h : w) - INSET * 2;

	const denom = begPad + endPad + n + Math.max(0, n - 1) * sib;
	const mainExtent = n > 0 ? usableMain / denom : usableMain;
	const gap = sib * mainExtent;
	const crossDefault = Math.min(usableCross, mainExtent * 0.62);
	const crossExtent = aspect
		? Math.min(usableCross, Math.max(12, mainExtent * aspect))
		: crossDefault;
	const crossPos = INSET + (usableCross - crossExtent) / 2;
	const start = INSET + begPad * mainExtent;
	// The item template's own `dgm:shape` override (ellipse/chevron/diamond/...)
	// wins over the arranger's hardcoded rect default when present.
	const itemShape = itemNode(plan.node)?.shape;

	const renderedNodes: RenderedNode[] = flow2.map((node, i) => {
		const mainPos = start + i * (mainExtent + gap);
		return presetBoxNode({
			key: `${elementId}-lin-${node.id}-${i}`,
			x: horizontal ? mainPos : crossPos,
			y: horizontal ? crossPos : mainPos,
			width: horizontal ? mainExtent : crossExtent,
			height: horizontal ? crossExtent : mainExtent,
			node,
			index: i,
			total: n,
			palette,
			style,
			ctx,
			shape: itemShape,
			fallbackKind: 'rect',
		});
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'list',
	};
}

/** `dgm:param[@type=flowDir]`: which axis fills first (`row`, the default, or `col`). */
type SnakeFlowDir = 'row' | 'col';

/**
 * `dgm:param[@type=grDir]`: starting corner + growth axes. `tL` (top-left,
 * default) grows right/down; `tR` mirrors the column axis, `bL` the row axis,
 * `bR` both - matching the same four-corner vocabulary PowerPoint's own grid
 * layouts (picture/table grids) use for "grow direction".
 */
type SnakeGrowDir = 'tL' | 'tR' | 'bL' | 'bR';

/** Grid cell counts along the fill axis (`primary`) and the wrap axis (`secondary`). */
interface SnakeGridDims {
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
function snakeGridDims(
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
function snakeCell(
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

/** Execute the `snake` algorithm: a grid honouring `grDir`/`flowDir`/`contDir`/`bkpt`. */
export function arrangeSnake(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	index: ConstraintIndex = EMPTY_CONSTRAINT_INDEX,
): SmartArtLayoutResult {
	const { width: w, height: h } = box;
	const ctx = styleContext(style);
	const n = nodes.length;
	const sib = resolveRatioConstraint(
		plan.node.constraints,
		index,
		roleOf(plan.node),
		['sibSp', 'sp'],
		0.15,
	);
	const flowDir: SnakeFlowDir = algorithmParam(plan.node, 'flowDir') === 'col' ? 'col' : 'row';
	const grDirRaw = algorithmParam(plan.node, 'grDir');
	const grDir: SnakeGrowDir =
		grDirRaw === 'tR' || grDirRaw === 'bL' || grDirRaw === 'bR' ? grDirRaw : 'tL';
	// `contDir` defaults to the pre-existing boustrophedon behaviour (alternate
	// lines reverse) when absent, so an unauthored diagram renders exactly as
	// before; only an explicit `sameDir` disables the reversal.
	const sameDir = algorithmParam(plan.node, 'contDir') === 'sameDir';
	const { cols, rows } = snakeGridDims(plan, n, w, h, flowDir);
	const usableW = w - INSET * 2;
	const usableH = h - INSET * 2;
	const cellW = usableW / (cols + Math.max(0, cols - 1) * sib);
	const cellH = usableH / (rows + Math.max(0, rows - 1) * sib);
	const gapX = sib * cellW;
	const gapY = sib * cellH;
	const itemShape = itemNode(plan.node)?.shape;
	const dims: SnakeGridDims = { cols, rows };

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const { col, row } = snakeCell(i, dims, flowDir, sameDir, grDir);
		return presetBoxNode({
			key: `${elementId}-snake-${node.id}-${i}`,
			x: INSET + col * (cellW + gapX),
			y: INSET + row * (cellH + gapY),
			width: cellW,
			height: cellH,
			node,
			index: i,
			total: n,
			palette,
			style,
			ctx,
			shape: itemShape,
			fallbackKind: 'rect',
		});
	});

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${w} ${h}`,
		family: 'matrix',
	};
}
