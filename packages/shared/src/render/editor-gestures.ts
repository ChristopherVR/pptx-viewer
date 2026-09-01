import { lockResizeAspect } from './editor-geometry';
import type { InteractionBox, ResizeHandleId } from './element-interaction';
import {
	applyDragDelta,
	applyResize,
	boxCenter,
	computeRotation,
	snapAngle,
} from './element-interaction';
import type { SnapGuideInput, SnapLine, SnapSibling } from './snap-guides';
import { computeSnapToShape, snapToGridStep } from './snap-guides';

/**
 * Pointer gesture driver for the editing overlay: move / resize / rotate.
 *
 * All geometry math comes from the shared `element-interaction` helpers
 * (`applyDragDelta`, `applyResize`, `computeRotation`, `snapAngle`) plus the
 * shared `computeSnapToShape` snap model during moves; this module only owns
 * the pointer-event lifecycle (dead-zone, window listeners, cancel). Extracted
 * from the byte-for-byte-equivalent Svelte / Vanilla `editor/editor-gestures`
 * (Svelte's superset: grid snap, shape-snap toggle, and guide lines).
 *
 * Unlike the pre-extraction bindings, the public surface here (`begin`,
 * `computeRotate`) takes a {@link PointerLike} plain object instead of a real
 * `PointerEvent`, so the pure math is testable without constructing DOM events.
 * The controller still attaches real `window` pointer listeners internally (a
 * `PointerEvent` satisfies `PointerLike` structurally, so the DOM listener
 * wires straight into the same handlers); only `window` is touched, and only
 * from inside `begin`/`dispose`.
 *
 * Behaviour change from the pre-extraction bindings: `begin` no longer calls
 * `event.preventDefault()` / `event.stopPropagation()` on the source event
 * (a plain object has no such methods). The caller's `pointerdown` handler
 * must call both itself before invoking `begin`.
 */

export type GestureKind = 'move' | 'resize' | 'rotate';

/** The subset of a `PointerEvent` this module needs. A real `PointerEvent`
 * satisfies this structurally, so a binding can pass one straight through. */
export interface PointerLike {
	clientX: number;
	clientY: number;
	pointerId: number;
	shiftKey: boolean;
}

/** Live geometry emitted during and at the end of a gesture (element px). */
export interface GestureTransform {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

export interface GestureDeps {
	/** Current stage scale (screen px per element px). */
	getScale(): number;
	/** Element geometry at gesture start (element px). */
	getElementBox(id: string): InteractionBox | undefined;
	/** Sibling boxes on the same slide, for snap-to-shape during a move. */
	getSiblings(): SnapSibling[];
	getSnapToGrid?(): boolean;
	getSnapToShape?(): boolean;
	getGridSize?(): number;
	getGuides?(): readonly SnapGuideInput[];
	/** Overlay origin in client coordinates, for rotation pointer mapping. */
	getStageOrigin(): { left: number; top: number };
	/** First movement past the dead zone (push history, mark interaction). */
	onStart(id: string, kind: GestureKind): void;
	/** Live preview: apply the geometry and render `lines` as snap guides. */
	onPreview(transform: GestureTransform, lines: readonly SnapLine[]): void;
	/** Gesture finished. `moved` is false for a plain tap (no dead-zone exit). */
	onEnd(transform: GestureTransform | null, moved: boolean, id: string): void;
}

export interface GestureController {
	/**
	 * Begin a gesture from a `pointerdown`. `handle` only for `resize`. Unlike
	 * the source event, `begin` does NOT call `preventDefault` /
	 * `stopPropagation`; the caller does that before invoking `begin`.
	 */
	begin(kind: GestureKind, id: string, pointer: PointerLike, handle?: ResizeHandleId): void;
	isActive(): boolean;
	/** Abort listeners without emitting an end transform (teardown). */
	dispose(): void;
}

/** Dead zone in screen px before a pointerdown becomes a drag. */
const DRAG_DEAD_ZONE_PX = 2;

interface ActiveGesture {
	kind: GestureKind;
	id: string;
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startBox: InteractionBox;
	handle?: ResizeHandleId;
	moved: boolean;
	last: GestureTransform | null;
}

export function createGestureController(deps: GestureDeps): GestureController {
	let active: ActiveGesture | null = null;

	const toTransform = (id: string, box: InteractionBox): GestureTransform => ({
		id,
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height,
		rotation: box.rotation ?? 0,
	});

	function computeMove(g: ActiveGesture, dx: number, dy: number): [GestureTransform, SnapLine[]] {
		const scale = deps.getScale();
		let box = applyDragDelta(g.startBox, dx, dy, scale);
		if (deps.getSnapToGrid?.()) {
			const grid = deps.getGridSize?.() ?? 12;
			box = { ...box, x: snapToGridStep(box.x, grid), y: snapToGridStep(box.y, grid) };
		}
		// Snap to sibling edges/centres (skipped for rotated boxes, whose AABB
		// no longer matches the visual outline).
		if (!box.rotation && deps.getSnapToShape?.() !== false) {
			const siblings = deps.getSiblings();
			const snapped = computeSnapToShape(
				box.x,
				box.y,
				box.width,
				box.height,
				siblings,
				new Set([g.id]),
				deps.getGuides?.() ?? [],
			);
			return [{ ...toTransform(g.id, box), x: snapped.x, y: snapped.y }, snapped.lines];
		}
		return [toTransform(g.id, box), []];
	}

	function computeResize(
		g: ActiveGesture,
		dx: number,
		dy: number,
		shift: boolean,
	): GestureTransform {
		const scale = deps.getScale();
		const handle = g.handle;
		if (!handle) {
			return toTransform(g.id, g.startBox);
		}
		let box = applyResize(g.startBox, handle, dx, dy, scale);
		if (shift) {
			box = lockResizeAspect(box, g.startBox, handle);
		}
		return toTransform(g.id, box);
	}

	function computeRotate(g: ActiveGesture, pointer: PointerLike): GestureTransform {
		const scale = deps.getScale() || 1;
		const origin = deps.getStageOrigin();
		const point = {
			x: (pointer.clientX - origin.left) / scale,
			y: (pointer.clientY - origin.top) / scale,
		};
		let angle = computeRotation(boxCenter(g.startBox), point);
		if (pointer.shiftKey) {
			angle = snapAngle(angle);
		}
		return { ...toTransform(g.id, g.startBox), rotation: angle };
	}

	function onPointerMove(pointer: PointerLike): void {
		const g = active;
		if (!g || pointer.pointerId !== g.pointerId) {
			return;
		}
		const dx = pointer.clientX - g.startClientX;
		const dy = pointer.clientY - g.startClientY;
		if (!g.moved) {
			if (Math.abs(dx) <= DRAG_DEAD_ZONE_PX && Math.abs(dy) <= DRAG_DEAD_ZONE_PX) {
				return;
			}
			g.moved = true;
			deps.onStart(g.id, g.kind);
		}
		let lines: readonly SnapLine[] = [];
		let next: GestureTransform;
		if (g.kind === 'move') {
			[next, lines] = computeMove(g, dx, dy);
		} else if (g.kind === 'resize') {
			next = computeResize(g, dx, dy, pointer.shiftKey);
		} else {
			next = computeRotate(g, pointer);
		}
		g.last = next;
		deps.onPreview(next, lines);
	}

	function onPointerUp(pointer: PointerLike): void {
		const g = active;
		if (!g || pointer.pointerId !== g.pointerId) {
			return;
		}
		detach();
		active = null;
		deps.onEnd(g.moved ? g.last : null, g.moved, g.id);
	}

	function detach(): void {
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerUp);
	}

	return {
		begin(kind, id, pointer, handle) {
			const box = deps.getElementBox(id);
			if (!box || active) {
				return;
			}
			active = {
				kind,
				id,
				pointerId: pointer.pointerId,
				startClientX: pointer.clientX,
				startClientY: pointer.clientY,
				startBox: { ...box },
				handle,
				moved: false,
				last: null,
			};
			window.addEventListener('pointermove', onPointerMove);
			window.addEventListener('pointerup', onPointerUp);
			window.addEventListener('pointercancel', onPointerUp);
		},
		isActive() {
			return active !== null;
		},
		dispose() {
			detach();
			active = null;
		},
	};
}
