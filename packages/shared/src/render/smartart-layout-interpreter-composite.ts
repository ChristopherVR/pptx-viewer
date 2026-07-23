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
 *
 * Scope / honesty: like the rest of the partial interpreter (see
 * `smartart-layout-interpreter-model.ts`), this does NOT run the recursive
 * forEach/choose + constraint-reference solver. It treats the flattened child
 * `layoutNode`s as a fixed list of slots and maps one data point per slot. When
 * the composite carries no child that positions itself (no l/t/w/h/ctrX/ctrY
 * constraint) it returns `undefined` so the caller keeps its fallback. Pure
 * geometry; no framework code.
 */

import type {
	PptxSmartArtConstraint,
	PptxSmartArtLayoutNode,
	PptxSmartArtNode,
	SmartArtStyle,
} from 'pptx-viewer-core';

import type { ArrangementPlan } from './smartart-layout-interpreter-model';
import { findConstraint } from './smartart-layout-interpreter-model';
import { rectNode, styleContext } from './smartart-layout-interpreter-render';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

/** A single resolved dimension, either box-relative pixels or an absolute raw. */
interface Dim {
	/** Resolved pixels (from a `fact`, or a sub-1 `val` treated as a fraction). */
	px?: number;
	/** Raw absolute `val` (> 1); normalised later against the other slots. */
	abs?: number;
}

/** The raw dimensions read off one composite child slot. */
interface SlotDims {
	l?: Dim;
	t?: Dim;
	w?: Dim;
	h?: Dim;
	ctrX?: Dim;
	ctrY?: Dim;
}

/** A resolved, box-clamped rectangle for one child slot. */
interface Slot {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Pick the extent a constraint's `factor` multiplies, honouring `referenceType`. */
function axisExtent(referenceType: string | undefined, box: BoundingBox, fallback: number): number {
	if (referenceType === 'w') {
		return box.width;
	}
	if (referenceType === 'h') {
		return box.height;
	}
	return fallback;
}

/** Default axis extent for a constraint type when no `referenceType` is given. */
function defaultExtent(type: string, box: BoundingBox): number {
	return type === 'h' || type === 't' || type === 'ctrY' || type === 'b' ? box.height : box.width;
}

/** Resolve one constraint to pixels (factor / sub-1 value) or an absolute raw. */
function dimOf(
	constraints: PptxSmartArtConstraint[] | undefined,
	type: string,
	box: BoundingBox,
): Dim | undefined {
	const constraint = findConstraint(constraints, type);
	if (!constraint) {
		return undefined;
	}
	const extent = axisExtent(constraint.referenceType, box, defaultExtent(type, box));
	if (typeof constraint.factor === 'number' && Number.isFinite(constraint.factor)) {
		return { px: constraint.factor * extent };
	}
	if (typeof constraint.value === 'number' && Number.isFinite(constraint.value)) {
		if (constraint.value >= 0 && constraint.value <= 1) {
			return { px: constraint.value * extent };
		}
		if (constraint.value > 1) {
			return { abs: constraint.value };
		}
	}
	return undefined;
}

/** True when the slot carries at least one positioning constraint. */
function isPositioned(dims: SlotDims): boolean {
	return (
		dims.l !== undefined ||
		dims.t !== undefined ||
		dims.w !== undefined ||
		dims.h !== undefined ||
		dims.ctrX !== undefined ||
		dims.ctrY !== undefined
	);
}

/** Read the raw dimensions from every child, keeping only positioned slots. */
function readSlots(children: PptxSmartArtLayoutNode[], box: BoundingBox): SlotDims[] {
	const slots: SlotDims[] = [];
	for (const child of children) {
		const c = child.constraints;
		const dims: SlotDims = {
			l: dimOf(c, 'l', box),
			t: dimOf(c, 't', box),
			w: dimOf(c, 'w', box),
			h: dimOf(c, 'h', box),
			ctrX: dimOf(c, 'ctrX', box),
			ctrY: dimOf(c, 'ctrY', box),
		};
		if (isPositioned(dims)) {
			slots.push(dims);
		}
	}
	return slots;
}

/** Absolute raw of a dim, or 0 when it is factor-based / absent. */
function absOf(dim: Dim | undefined): number {
	return typeof dim?.abs === 'number' ? dim.abs : 0;
}

/**
 * Largest absolute (EMU-ish) extent on one axis, used to normalise raw `val`s.
 *
 * The extent of a slot is its far edge: `left + width` (or the centre-based
 * equivalent). The widest slot's far edge maps to the box, keeping every
 * absolutely-positioned slot inside the bounds.
 */
function axisAbsMax(
	slots: SlotDims[],
	pos: keyof SlotDims,
	ctr: keyof SlotDims,
	size: keyof SlotDims,
): number {
	let max = 0;
	for (const slot of slots) {
		const s = absOf(slot[size]);
		const edge = Math.max(absOf(slot[pos]) + s, absOf(slot[ctr]) + s / 2, s);
		if (edge > max) {
			max = edge;
		}
	}
	return max;
}

/** Resolve a single dimension to pixels, scaling any absolute raw by `absScale`. */
function px(dim: Dim | undefined, absScale: number): number | undefined {
	if (!dim) {
		return undefined;
	}
	if (typeof dim.px === 'number') {
		return dim.px;
	}
	if (typeof dim.abs === 'number') {
		return dim.abs * absScale;
	}
	return undefined;
}

/** Clamp `v` into `[min, max]` (returns `min` when the range is degenerate). */
function clamp(v: number, min: number, max: number): number {
	if (max <= min) {
		return min;
	}
	return Math.min(max, Math.max(min, v));
}

/** Resolve one slot's l/t/w/h from its (possibly ctr-based) constraints. */
function resolveSlot(dims: SlotDims, box: BoundingBox, absX: number, absY: number): Slot {
	const rawW = px(dims.w, absX);
	const rawH = px(dims.h, absY);
	const width = clamp(rawW ?? box.width, 1, box.width);
	const height = clamp(rawH ?? box.height, 1, box.height);

	const l = px(dims.l, absX);
	const ctrX = px(dims.ctrX, absX);
	let x: number;
	if (l !== undefined) {
		x = l;
	} else if (ctrX !== undefined) {
		x = ctrX - width / 2;
	} else {
		x = (box.width - width) / 2;
	}

	const t = px(dims.t, absY);
	const ctrY = px(dims.ctrY, absY);
	let y: number;
	if (t !== undefined) {
		y = t;
	} else if (ctrY !== undefined) {
		y = ctrY - height / 2;
	} else {
		y = (box.height - height) / 2;
	}

	return {
		x: clamp(x, 0, box.width - width),
		y: clamp(y, 0, box.height - height),
		width,
		height,
	};
}

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
): SmartArtLayoutResult | undefined {
	const children = plan.node.children;
	if (!children || children.length === 0 || nodes.length === 0) {
		return undefined;
	}
	const slotDims = readSlots(children, box);
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
