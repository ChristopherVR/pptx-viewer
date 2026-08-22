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
import { itemNode } from './smartart-layout-interpreter-model';
import { rectNode, styleContext } from './smartart-layout-interpreter-render';
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

	const renderedNodes: RenderedNode[] = flow2.map((node, i) => {
		const mainPos = start + i * (mainExtent + gap);
		return rectNode({
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

/** Execute the `snake` algorithm: a boustrophedon wrapping grid. */
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
	const cols = Math.max(1, Math.round(Math.sqrt(n * Math.max(0.2, w / Math.max(1, h)))));
	const rows = Math.max(1, Math.ceil(n / cols));
	const usableW = w - INSET * 2;
	const usableH = h - INSET * 2;
	const cellW = usableW / (cols + Math.max(0, cols - 1) * sib);
	const cellH = usableH / (rows + Math.max(0, rows - 1) * sib);
	const gapX = sib * cellW;
	const gapY = sib * cellH;

	const renderedNodes: RenderedNode[] = nodes.map((node, i) => {
		const row = Math.floor(i / cols);
		const posInRow = i % cols;
		// Reverse every odd row so the flow snakes back (boustrophedon).
		const col = row % 2 === 1 ? cols - 1 - posInRow : posInRow;
		return rectNode({
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
