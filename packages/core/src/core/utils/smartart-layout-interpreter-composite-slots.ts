/**
 * SmartArt DiagramML interpreter - `composite` child-slot dimension resolver.
 *
 * Split out of `smartart-layout-interpreter-composite.ts` to keep that file
 * under the repo's per-file line budget: this half reads each composite
 * child `layoutNode`'s `l`/`t`/`w`/`h`/`ctrX`/`ctrY` constraints into
 * box-relative pixels (or an absolute raw, normalised later), including a
 * TRUE cross-role reference ("this slot's `w` is 0.8x THAT sibling role's
 * `h`", resolved via `smartart-constraint-solver.ts`); the other half maps
 * the resolved slots onto data-model points. Pure geometry; no framework
 * code.
 */

import type { PptxSmartArtConstraint, PptxSmartArtLayoutNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { resolveConstraint } from './smartart-constraint-solver';
import { findConstraint } from './smartart-layout-interpreter-model';
import type { BoundingBox } from './smartart-layout-types';

/** A single resolved dimension, either box-relative pixels or an absolute raw. */
export interface Dim {
	/** Resolved pixels (from a `fact`, or a sub-1 `val` treated as a fraction). */
	px?: number;
	/** Raw absolute `val` (> 1); normalised later against the other slots. */
	abs?: number;
}

/** The raw dimensions read off one composite child slot. */
export interface SlotDims {
	l?: Dim;
	t?: Dim;
	w?: Dim;
	h?: Dim;
	ctrX?: Dim;
	ctrY?: Dim;
}

/** A resolved, box-clamped rectangle for one child slot. */
export interface Slot {
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

/**
 * True cross-role reference: `refFor`/`refForName` name ANOTHER layoutNode
 * (as opposed to omitted/`self`, which the existing `referenceType`-vs-box-axis
 * handling below already covers).
 */
function isCrossRoleReference(constraint: PptxSmartArtConstraint): boolean {
	return (
		(constraint.referenceFor === 'ch' || constraint.referenceFor === 'des') &&
		Boolean(constraint.referenceForName)
	);
}

/** Resolve one constraint to pixels (factor / sub-1 value) or an absolute raw. */
function dimOf(
	constraints: PptxSmartArtConstraint[] | undefined,
	type: string,
	box: BoundingBox,
	index: ConstraintIndex,
): Dim | undefined {
	const constraint = findConstraint(constraints, type);
	if (!constraint) {
		return undefined;
	}
	if (isCrossRoleReference(constraint)) {
		// "This slot's <type> is a factor of THAT sibling role's resolved
		// <refType>" - e.g. a caption slot sized relative to its picture
		// sibling. Walk the whole-definition constraint graph for the answer
		// (see `smartart-constraint-solver.ts`); fall through to the box-axis
		// approximation below only when it cannot be resolved.
		const refType = constraint.referenceType ?? constraint.type;
		const resolved = resolveConstraint(index, constraint.referenceForName!, refType);
		if (resolved !== undefined) {
			const factor =
				typeof constraint.factor === 'number' && Number.isFinite(constraint.factor)
					? constraint.factor
					: 1;
			const extent = axisExtent(constraint.referenceType, box, defaultExtent(type, box));
			return { px: resolved * factor * extent };
		}
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
export function readSlots(
	children: PptxSmartArtLayoutNode[],
	box: BoundingBox,
	index: ConstraintIndex,
): SlotDims[] {
	const slots: SlotDims[] = [];
	for (const child of children) {
		const c = child.constraints;
		const dims: SlotDims = {
			l: dimOf(c, 'l', box, index),
			t: dimOf(c, 't', box, index),
			w: dimOf(c, 'w', box, index),
			h: dimOf(c, 'h', box, index),
			ctrX: dimOf(c, 'ctrX', box, index),
			ctrY: dimOf(c, 'ctrY', box, index),
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
export function axisAbsMax(
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
export function resolveSlot(dims: SlotDims, box: BoundingBox, absX: number, absY: number): Slot {
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
