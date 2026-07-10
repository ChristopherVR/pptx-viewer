import type { InteractionBox, ResizeHandleId, SnapLine, SnapSibling } from 'pptx-viewer-shared';
import {
	applyDragDelta,
	applyResize,
	boxCenter,
	computeRotation,
	computeSnapToShape,
	snapAngle,
} from 'pptx-viewer-shared';

import { lockResizeAspect } from './editor-geometry';

/**
 * Pointer gesture driver for the editing overlay: move / resize / rotate.
 *
 * All geometry math comes from the shared `element-interaction` helpers
 * (`applyDragDelta`, `applyResize`, `computeRotation`, `snapAngle`) plus the
 * shared `computeSnapToShape` snap model during moves; this module only owns
 * the pointer-event lifecycle (dead-zone, window listeners, cancel). It is
 * framework-agnostic (no Svelte), matching the vanilla binding's driver.
 */

export type GestureKind = 'move' | 'resize' | 'rotate';

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
	/** Begin a gesture from a `pointerdown`. `handle` only for `resize`. */
	begin(kind: GestureKind, id: string, event: PointerEvent, handle?: ResizeHandleId): void;
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
		const box = applyDragDelta(g.startBox, dx, dy, scale);
		// Snap to sibling edges/centres (skipped for rotated boxes, whose AABB
		// no longer matches the visual outline).
		if (!box.rotation) {
			const siblings = deps.getSiblings();
			const snapped = computeSnapToShape(
				box.x,
				box.y,
				box.width,
				box.height,
				siblings,
				new Set([g.id]),
				[],
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

	function computeRotate(g: ActiveGesture, event: PointerEvent): GestureTransform {
		const scale = deps.getScale() || 1;
		const origin = deps.getStageOrigin();
		const pointer = {
			x: (event.clientX - origin.left) / scale,
			y: (event.clientY - origin.top) / scale,
		};
		let angle = computeRotation(boxCenter(g.startBox), pointer);
		if (event.shiftKey) {
			angle = snapAngle(angle);
		}
		return { ...toTransform(g.id, g.startBox), rotation: angle };
	}

	function onPointerMove(event: PointerEvent): void {
		const g = active;
		if (!g || event.pointerId !== g.pointerId) {
			return;
		}
		const dx = event.clientX - g.startClientX;
		const dy = event.clientY - g.startClientY;
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
			next = computeResize(g, dx, dy, event.shiftKey);
		} else {
			next = computeRotate(g, event);
		}
		g.last = next;
		deps.onPreview(next, lines);
	}

	function onPointerUp(event: PointerEvent): void {
		const g = active;
		if (!g || event.pointerId !== g.pointerId) {
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
		begin(kind, id, event, handle) {
			const box = deps.getElementBox(id);
			if (!box || active) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			active = {
				kind,
				id,
				pointerId: event.pointerId,
				startClientX: event.clientX,
				startClientY: event.clientY,
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
