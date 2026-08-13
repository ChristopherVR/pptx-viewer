/**
 * selection-overlay-geometry.ts: the pure placement maths behind
 * `SelectionOverlay.vue`.
 *
 * None of this needs Vue. It was inline in the SFC, which grew past the repo's
 * 300-LOC file budget and made the component's actual job (wire pointer events
 * to emits, render a box) hard to see. Everything here takes explicit
 * arguments rather than closing over props, so it is directly testable and the
 * SFC keeps only the reactive wiring.
 *
 * The handle table itself is NOT here: it lives in `pptx-viewer-shared`'s
 * `RESIZE_HANDLE_GEOMETRY`, because all five bindings place the same eight
 * handles and used to keep five copies of the same eight constants.
 *
 * @module viewer/components/selection-overlay-geometry
 */
import type { InteractionBox, ResizeHandleId } from 'pptx-viewer-shared';
import { RESIZE_HANDLE_GEOMETRY, RESIZE_HANDLES, ROTATE_STEM_PX } from 'pptx-viewer-shared';

/** A selected element's box, carrying the id the gesture reports back. */
export interface SelectedBox extends InteractionBox {
	id: string;
}

/** Live geometry emitted while (and after) a transform gesture. */
export interface TransformPayload {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

/**
 * Live values emitted while (and after) a shape-adjustment gesture.
 *
 * A MAP, not one number: a preset has one handle per `a:avLst` guide and a
 * callout's single diamond drives two of them at once, so a payload carrying
 * only `value` could describe neither. It also carries the element's other
 * adjustments forward, because the store writes `shapeAdjustments` whole.
 */
export interface AdjustPayload {
	id: string;
	adjustments: Record<string, number>;
}

/** One rendered resize handle: its id plus where and how it draws. */
export interface HandleMeta {
	id: ResizeHandleId;
	cursor: string;
	/** Fractional position within the box: 0 = left/top, 1 = right/bottom. */
	fx: number;
	fy: number;
}

/** The eight handles in render order, resolved from the shared table. */
export const HANDLE_LIST: readonly HandleMeta[] = RESIZE_HANDLES.map((id) => ({
	id,
	...RESIZE_HANDLE_GEOMETRY[id],
}));

/**
 * True when the primary pointer is coarse (touch). Resolved once at module
 * load and guarded for environments without `matchMedia` (SSR / tests). On
 * touch the handle and knob hit areas are grown so a finger can actually grab
 * them.
 */
export const IS_COARSE_POINTER: boolean =
	typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** The payload shape for a box, with rotation defaulted. */
export function payloadFromBox(id: string, box: InteractionBox): TransformPayload {
	return {
		id,
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height,
		rotation: box.rotation ?? 0,
	};
}

/** A plain copy of a box, used as a gesture's immutable start state. */
export function startBoxOf(box: SelectedBox): InteractionBox {
	return {
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height,
		rotation: box.rotation ?? 0,
	};
}

/**
 * Inverse of the stage zoom.
 *
 * The overlay lives INSIDE the zoom-scaled stage, so anything sized in plain px
 * shrinks with the zoom: at a typical fit zoom of ~0.7 a 10px handle painted
 * only ~7px on screen and its reach inside the corner fell to ~3px, while the
 * other four bindings keep a 10px SCREEN-px handle centred on the corner.
 */
export function inverseZoom(zoom: number): number {
	return 1 / (zoom || 1);
}

/**
 * Rotate-stem length in ELEMENT px for the current zoom.
 *
 * The stem is a constant 24 SCREEN px in every binding. Vue used a flat 24
 * element px, so at a mobile fit zoom of ~0.3 the knob sat only ~7 screen px
 * above the top edge and the (correctly sized) N resize handle covered it,
 * swallowing the rotate press entirely.
 */
export function stemLength(zoom: number): number {
	return ROTATE_STEM_PX * inverseZoom(zoom);
}

/** Absolute placement of the selection rectangle itself. */
export function boxStyle(box: SelectedBox): Record<string, string> {
	const rotation = box.rotation ?? 0;
	return {
		left: `${box.x}px`,
		top: `${box.y}px`,
		width: `${box.width}px`,
		height: `${box.height}px`,
		transform: rotation ? `rotate(${rotation}deg)` : 'none',
	};
}

/** Placement + cursor for one resize handle on a given box. */
export function handleStyle(meta: HandleMeta, box: SelectedBox): Record<string, string> {
	return {
		left: `${meta.fx * box.width}px`,
		top: `${meta.fy * box.height}px`,
		cursor: meta.cursor,
	};
}

/** The vertical stem connecting the box to the rotate knob. */
export function rotateStemStyle(box: SelectedBox, zoom: number): Record<string, string> {
	const stem = stemLength(zoom);
	return {
		left: `${box.width / 2}px`,
		top: `${-stem}px`,
		height: `${stem}px`,
	};
}

/** The rotate knob at the top of the stem. */
export function rotateKnobStyle(box: SelectedBox, zoom: number): Record<string, string> {
	return {
		left: `${box.width / 2}px`,
		top: `${-stemLength(zoom)}px`,
	};
}

/** Placement + cursor for the shape-adjustment diamond, if the shape has one. */
export function adjustHandleStyle(
	descriptor: { left: number; top: number; cursor: string } | null,
): Record<string, string> {
	// The descriptor point is where the handle's CENTRE belongs (shared measures
	// it off the preset geometry), and the diamond is 10px, so it is pulled back
	// by half. Left un-centred, every handle sat down-and-right of the feature it
	// controls, which on a small shape is the difference between grabbing the
	// adjust handle and grabbing the resize handle beside it.
	return {
		left: `${(descriptor?.left ?? 0) - 5}px`,
		top: `${(descriptor?.top ?? 0) - 5}px`,
		cursor: descriptor?.cursor ?? 'ew-resize',
	};
}
