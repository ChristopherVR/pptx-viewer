/**
 * Shape-adjustment handles: PowerPoint's yellow `a:avLst` diamonds. Pure,
 * framework-agnostic math shared by all five bindings.
 *
 * Owns the adjustment scalar constants and the handle/drag descriptor types so
 * each binding consumes one copy rather than re-declaring them.
 *
 * A preset has ONE handle per adjustable parameter and many presets have
 * several (`callout3` has eight), so the entry point is
 * {@link getShapeAdjustmentHandleDescriptors}, returning an array. Placement and
 * drag scale are measured off the preset geometry by
 * `shape-adjustment-handles`; this module is the element-level policy around
 * it (lock check, element type, custom geometry) plus the round-rect helpers
 * the renderers use for `border-radius`.
 */
import type { PptxElement, PptxElementWithShapeStyle } from 'pptx-viewer-core';
import { getShapeType, hasShapeProperties } from 'pptx-viewer-core';

import { canInteractWithElement } from './element-locks';
import { deriveCustomGeometryAdjustmentHandles } from './shape-adjustment-custom-geometry';
import { derivePresetAdjustmentHandles } from './shape-adjustment-handles';
import type { AdjustmentAxisSolver } from './shape-adjustment-model';
import { solveShapeAdjustmentValue, solveShapeAdjustments } from './shape-adjustment-solver';

// Scalar constants (mirrors the React `viewer/constants/scalar.ts` values).
export const SHAPE_ADJUSTMENT_MIN = 0;
export const SHAPE_ADJUSTMENT_MAX = 50000;
export const DEFAULT_ROUND_RECT_ADJUSTMENT = 16667;

/** Descriptor for one draggable adjustment handle (the amber diamond). */
export interface ShapeAdjustmentHandleDescriptor {
	/** The `a:avLst` guide name this handle writes (`adj`, `adj1`, ...). */
	key: string;
	/** Handle x offset in element-local px (origin = element top-left). */
	left: number;
	/** Handle y offset in element-local px. */
	top: number;
	/**
	 * Current adjustment value in GUIDE units, not a 0-1 fraction. Most presets
	 * range 0..50000 or 0..100000 and the angular ones run to 21,600,000.
	 */
	value: number;
	cursor: string;
	/**
	 * How this handle's drag resolves, measured off the preset geometry: one
	 * entry per `a:avLst` guide it drives (callouts drive two). Absent only for
	 * a caller that built a descriptor by hand.
	 */
	solvers?: AdjustmentAxisSolver[];
}

/** Live drag state captured when an adjustment gesture starts. */
export interface ShapeAdjustmentDragState {
	elementId: string;
	key: string;
	shapeType: string;
	startClientX: number;
	startClientY: number;
	startAdjustment: number;
	startWidth: number;
	startHeight: number;
	moved: boolean;
	/** Copied from the descriptor the gesture started on. */
	solvers?: AdjustmentAxisSolver[];
	/**
	 * The element's whole `a:avLst` map at gesture start.
	 *
	 * A binding writes `shapeAdjustments` as one object, so a drag that sent
	 * only the guide it changed would DELETE every other authored adjustment on
	 * a multi-adjust preset (a `quadArrow` would lose two of its three the first
	 * time one was touched).
	 */
	startAdjustments?: Record<string, number>;
}

export function clampShapeAdjustmentValue(value: number): number {
	return Math.max(SHAPE_ADJUSTMENT_MIN, Math.min(SHAPE_ADJUSTMENT_MAX, Math.round(value)));
}

export function getRoundRectAdjustmentValue(element: PptxElementWithShapeStyle): number {
	const adjustment = element.shapeAdjustments?.adj;
	if (typeof adjustment === 'number' && Number.isFinite(adjustment)) {
		return clampShapeAdjustmentValue(adjustment);
	}
	return DEFAULT_ROUND_RECT_ADJUSTMENT;
}

export function getRoundRectRadiusPx(element: PptxElementWithShapeStyle): number {
	const normalizedAdjustment = getRoundRectAdjustmentValue(element) / SHAPE_ADJUSTMENT_MAX;
	return (
		Math.min(Math.max(element.width, 1), Math.max(element.height, 1)) * 0.5 * normalizedAdjustment
	);
}

/** Structural view of the geometry fields that suppress a preset handle. */
interface AdjustableShapeFields {
	shapeType?: string;
	shapeAdjustments?: Record<string, number>;
	customGeometryPaths?: unknown[];
}

/** Map a `DerivedAdjustmentHandle` onto the descriptor shape a binding renders. */
function toDescriptor(handle: {
	key: string;
	x: number;
	y: number;
	value: number;
	cursor: string;
	solvers: AdjustmentAxisSolver[];
}): ShapeAdjustmentHandleDescriptor {
	return {
		key: handle.key,
		left: handle.x,
		top: handle.y,
		value: handle.value,
		cursor: handle.cursor,
		solvers: handle.solvers,
	};
}

/**
 * Every adjustment handle `element` offers, in `a:avLst`/`a:ahLst`
 * declaration order.
 *
 * A `a:custGeom` shape with its own `a:ahXY`/`a:ahPolar` gets its handles from
 * {@link deriveCustomGeometryAdjustmentHandles} (evaluated off its OWN
 * `a:gdLst`, not the preset table, which would describe geometry nobody
 * paints for a freeform shape); a preset shape gets them from
 * `derivePresetAdjustmentHandles`. Empty when neither applies, or when the
 * element's `a:spLocks/@noAdjustHandles` forbids the affordance. The lock
 * check lives HERE rather than at each binding's overlay, so a locked shape
 * hides its amber diamonds in all five without five separate guards.
 */
export function getShapeAdjustmentHandleDescriptors(
	element: PptxElement,
): ShapeAdjustmentHandleDescriptor[] {
	if (!hasShapeProperties(element) || element.type === 'connector') {
		return [];
	}
	if (!canInteractWithElement(element, 'adjustHandle')) {
		return [];
	}
	const shape = element as PptxElement & AdjustableShapeFields;
	if (shape.customGeometryPaths && shape.customGeometryPaths.length > 0) {
		return deriveCustomGeometryAdjustmentHandles(element).map(toDescriptor);
	}

	// Normalised before the lookup, never raw: a deck spells the preset
	// `roundRect` while the picker may hand us `oval` or `rtArrow`, and a raw
	// compare is the single most common way a binding drifts.
	return derivePresetAdjustmentHandles(
		shape.shapeType,
		element.width,
		element.height,
		shape.shapeAdjustments ?? {},
	).map(toDescriptor);
}

/**
 * The FIRST adjustment handle for `element`, or `null`.
 *
 * Kept for callers that only ever showed one diamond; new view code should
 * render {@link getShapeAdjustmentHandleDescriptors} so a preset with several
 * adjustable parameters offers all of them.
 */
export function getShapeAdjustmentHandleDescriptor(
	element: PptxElement,
): ShapeAdjustmentHandleDescriptor | null {
	return getShapeAdjustmentHandleDescriptors(element)[0] ?? null;
}

/**
 * New adjustment value for a pointer delta (element px) from the gesture start.
 *
 * `deltaY` matters for every handle that does not travel horizontally (the
 * vertical arm of a `quadArrow`, a callout's leader line, the swing of a `pie`
 * wedge); it defaults to 0 so a caller that only tracks horizontal travel keeps
 * working.
 */
export function getDraggedShapeAdjustmentValue(
	state: ShapeAdjustmentDragState,
	deltaX: number,
	deltaY = 0,
): number {
	const solver = state.solvers?.[0]?.solver;
	if (solver) {
		return solveShapeAdjustmentValue(solver, solver.anchorX + deltaX, solver.anchorY + deltaY);
	}
	// Fallback for a gesture started without a captured solver. Normalised
	// before the compare, never raw: `shapeType` arrives exactly as the deck
	// spells it (`roundRect`), so the old raw `!== 'roundrect'` matched nothing
	// and every drag returned the START value.
	if (getShapeType(state.shapeType) !== 'roundRect') {
		return state.startAdjustment;
	}
	const minDimension = Math.max(
		1,
		Math.min(Math.max(state.startWidth, 1), Math.max(state.startHeight, 1)),
	);
	const deltaAdjustment = (deltaX / Math.max(minDimension * 0.5, 1)) * SHAPE_ADJUSTMENT_MAX;
	return clampShapeAdjustmentValue(state.startAdjustment + deltaAdjustment);
}

/**
 * The whole `shapeAdjustments` map to write for a drag delta (element px).
 *
 * This is what a binding should write, not a single value: a callout handle
 * drives two guides at once (so resolving only
 * {@link getDraggedShapeAdjustmentValue} would move its leader line
 * horizontally and never vertically), and the result carries the element's
 * other adjustments forward so writing it cannot drop them.
 */
export function getDraggedShapeAdjustments(
	state: ShapeAdjustmentDragState,
	deltaX: number,
	deltaY = 0,
): Record<string, number> {
	const solvers = state.solvers;
	const patch =
		solvers && solvers.length > 0
			? solveShapeAdjustments(
					solvers,
					solvers[0].solver.anchorX + deltaX,
					solvers[0].solver.anchorY + deltaY,
				)
			: { [state.key]: getDraggedShapeAdjustmentValue(state, deltaX, deltaY) };
	return { ...state.startAdjustments, ...patch };
}

/**
 * Capture the drag state for an adjustment gesture starting on `descriptor`.
 *
 * Shared so no binding has to remember to copy the solver across (and so none
 * repeats the `shapeType` lower-casing that used to be needed).
 */
export function beginShapeAdjustment(
	element: PptxElement,
	descriptor: ShapeAdjustmentHandleDescriptor,
	clientX: number,
	clientY: number,
): ShapeAdjustmentDragState {
	const shape = element as PptxElement & AdjustableShapeFields;
	return {
		elementId: element.id,
		key: descriptor.key,
		shapeType: String(shape.shapeType ?? ''),
		startClientX: clientX,
		startClientY: clientY,
		startAdjustment: descriptor.value,
		startWidth: element.width,
		startHeight: element.height,
		moved: false,
		solvers: descriptor.solvers,
		startAdjustments: { ...shape.shapeAdjustments },
	};
}
