/**
 * SmartArt DiagramML interpreter - `composite` child-slot dimension resolver.
 *
 * Split out of `smartart-layout-interpreter-composite.ts` to keep that file
 * under the repo's per-file line budget: this half reads each composite
 * child `layoutNode`'s `l`/`t`/`w`/`h`/`ctrX`/`ctrY` constraints into
 * box-relative pixels (or an absolute raw, normalised later) - per-dimension
 * resolution itself (including a TRUE cross-role reference, resolved via
 * `smartart-constraint-solver.ts`) lives in `smartart-layout-interpreter-
 * composite-slot-dim.ts` (a further split for the SAME line budget); the
 * other half maps the resolved slots onto data-model points. Pure geometry;
 * no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { roleOf } from './smartart-constraint-solver';
import { isUserSizeHubRole } from './smartart-layout-interpreter-composite-aspect';
import type { Dim } from './smartart-layout-interpreter-composite-slot-dim';
import { dimOf } from './smartart-layout-interpreter-composite-slot-dim';
import type { BoundingBox } from './smartart-layout-types';

export type { Dim } from './smartart-layout-interpreter-composite-slot-dim';

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

/** One composite child slot's raw dimensions, plus its source layoutNode
 * (for `arrangeComposite`'s `dgm:presOf`-aware data mapping). */
export interface SlottedDims {
	node: PptxSmartArtLayoutNode;
	dims: SlotDims;
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

/**
 * Read the raw dimensions from every child, keeping only positioned slots.
 *
 * @param declaringRole The composite arranger's own role name (`roleOf`),
 *   for resolving a slot positioned by the ARRANGER's `for="ch"
 *   forName="<slot>"` constraint instead of the slot's own (see
 *   `dimDeclaredBy`). Defaults to the composite `layoutNode`'s own name when
 *   omitted (every existing call site already has it to hand as `children`'s
 *   parent). A CHAIN of roles (nearest ancestor first, round 32) tries each
 *   in turn per dimension `type` - see `dimDeclaredBy`'s own doc comment.
 * @param sizeBox The extent a `userS`-declared hub role's own `w`/`h` facts
 *   are read against instead of `box` - see `smartart-layout-interpreter-
 *   composite-aspect.ts`'s `isUserSizeHubRole`/`fitAspectRatioBox` for why
 *   this is scoped to exactly that one role, not every child. Defaults to
 *   `box` (every pre-existing caller, and every composite with no `userS`
 *   hub role): unchanged behaviour.
 */
export function readSlots(
	children: PptxSmartArtLayoutNode[],
	box: BoundingBox,
	index: ConstraintIndex,
	declaringRole: string | readonly string[],
	sizeBox: BoundingBox = box,
): SlottedDims[] {
	const slots: SlottedDims[] = [];
	for (const child of children) {
		const c = child.constraints;
		const role = roleOf(child);
		const hubSizeBox = isUserSizeHubRole(role, index) ? sizeBox : box;
		const dims: SlotDims = {
			l: dimOf(c, 'l', box, index, role, declaringRole),
			t: dimOf(c, 't', box, index, role, declaringRole),
			w: dimOf(c, 'w', hubSizeBox, index, role, declaringRole),
			h: dimOf(c, 'h', hubSizeBox, index, role, declaringRole),
			ctrX: dimOf(c, 'ctrX', box, index, role, declaringRole),
			ctrY: dimOf(c, 'ctrY', box, index, role, declaringRole),
		};
		if (isPositioned(dims)) {
			slots.push({ node: child, dims });
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
	slots: SlottedDims[],
	pos: keyof SlotDims,
	ctr: keyof SlotDims,
	size: keyof SlotDims,
): number {
	let max = 0;
	for (const { dims } of slots) {
		const s = absOf(dims[size]);
		const edge = Math.max(absOf(dims[pos]) + s, absOf(dims[ctr]) + s / 2, s);
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
