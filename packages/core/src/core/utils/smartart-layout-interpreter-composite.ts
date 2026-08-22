/**
 * SmartArt DiagramML interpreter - composite (`composite`) arranger.
 *
 * The `composite` algorithm does not flow points; it positions each of its child
 * `layoutNode`s at an explicit offset given by that child's `dgm:constr`
 * (`l`/`t`/`w`/`h`/`ctrX`/`ctrY`, usually a `fact` of the parent w/h). It is how
 * many built-ins place a fixed set of slots - a title beside a body, a shape over
 * its picture, an accent plus a caption. This arranger reads each positioned
 * child slot, resolves its constraints against the bounding box, and maps the
 * actual data-model points into those slots in order, producing styled rects.
 * Slot dimension resolution (including a slot's `w`/`h`/`l`/`t` expressed
 * relative to ANOTHER sibling slot, not just the box) lives in
 * `smartart-layout-interpreter-composite-slots.ts` to keep this file within
 * the repo's per-file line budget.
 *
 * Scope / honesty: like the rest of the partial interpreter (see
 * `smartart-layout-interpreter-model.ts`), this does NOT run the recursive
 * forEach/choose + constraint-reference solver. It treats the flattened child
 * `layoutNode`s as a fixed list of slots and maps one data point per slot. When
 * the composite carries no child that positions itself (no l/t/w/h/ctrX/ctrY
 * constraint) it returns `undefined` so the caller keeps its fallback. Pure
 * geometry; no framework code.
 */

import type { PptxSmartArtNode, SmartArtStyle } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { axisAbsMax, readSlots, resolveSlot } from './smartart-layout-interpreter-composite-slots';
import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { rectNode, styleContext } from './smartart-layout-interpreter-render';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

/**
 * Execute the `composite` algorithm: map data points into the fixed child slots.
 *
 * Returns `undefined` when the composite has no child that positions itself, so
 * the caller can fall back to its legacy family approximation.
 */
export function arrangeComposite(
	plan: ArrangementPlan,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	index: ConstraintIndex = EMPTY_CONSTRAINT_INDEX,
): SmartArtLayoutResult | undefined {
	const children = plan.node.children;
	if (!children || children.length === 0 || nodes.length === 0) {
		return undefined;
	}
	const slotDims = readSlots(children, box, index);
	if (slotDims.length === 0) {
		return undefined;
	}

	// Normalise any absolute (EMU-ish) values so the widest slot fits the box.
	const absMaxX = axisAbsMax(slotDims, 'l', 'ctrX', 'w');
	const absMaxY = axisAbsMax(slotDims, 't', 'ctrY', 'h');
	const absX = absMaxX > 0 ? box.width / absMaxX : 1;
	const absY = absMaxY > 0 ? box.height / absMaxY : 1;

	const slots = slotDims.map((dims) => resolveSlot(dims, box, absX, absY));
	const ctx = styleContext(style);
	const count = Math.min(slots.length, nodes.length);

	const renderedNodes: RenderedNode[] = [];
	for (let i = 0; i < count; i++) {
		const slot = slots[i];
		const node = nodes[i];
		renderedNodes.push(
			rectNode({
				key: `${elementId}-comp-${node.id}-${i}`,
				x: slot.x,
				y: slot.y,
				width: slot.width,
				height: slot.height,
				node,
				index: i,
				total: count,
				palette,
				style,
				ctx,
			}),
		);
	}

	return {
		nodes: renderedNodes,
		connectors: [],
		shadowFilter: ctx.shadow,
		viewBox: `0 0 ${box.width} ${box.height}`,
		family: 'list',
	};
}
