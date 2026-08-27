import type { InkPoint } from 'pptx-viewer-shared';

import type { InkDrawTool } from './editor-ink-controller.svelte';

/**
 * Pointer gesture driver for freehand ink drawing: pen/highlighter accumulate
 * points into a live stroke and commit it on pointerup; eraser hit-tests on
 * pointerdown alone. Framework-agnostic (no Svelte), mirroring
 * `editor-gestures.ts`'s pure-module + window-listener pattern so a stroke
 * keeps tracking the pointer even when it leaves the stage bounds.
 */

export interface InkGestureDeps {
	/** Current stage scale (screen px per element px). */
	getScale(): number;
	/** Stage-holder origin in client coordinates, for pointer-to-slide-space mapping. */
	getStageOrigin(): { left: number; top: number };
	/** The active draw tool; `'select'` means the gesture controller is idle. */
	getTool(): InkDrawTool;
	/** A pen/highlighter stroke started (first point captured). */
	onStrokeStart(): void;
	/** Live preview: the accumulated points so far (pen/highlighter only). */
	onStrokePreview(points: readonly InkPoint[]): void;
	/** A pen/highlighter stroke finished (pointerup); may be too short to keep. */
	onStrokeEnd(points: readonly InkPoint[]): void;
	/** Eraser: a single point to hit-test against ink elements. */
	onErase(point: InkPoint): void;
}

export interface InkGestureController {
	/** Handle a stage `pointerdown` while a draw tool may be active. No-op when the tool is `'select'`. */
	handlePointerDown(event: PointerEvent): void;
	isActive(): boolean;
	/** Abort listeners without emitting an end callback (teardown). */
	dispose(): void;
}

export function createInkGestureController(deps: InkGestureDeps): InkGestureController {
	let points: InkPoint[] = [];
	let activePointerId: number | null = null;

	/**
	 * Map a pointer event to a stage-local point, carrying its pressure
	 * reading along (`PointerEvent.pressure`, 0..1) so a completed stroke can
	 * author a variable-width `inkPointPressures` channel, matching React.
	 */
	function toPoint(event: PointerEvent): InkPoint {
		const origin = deps.getStageOrigin();
		const scale = deps.getScale() || 1;
		return {
			x: (event.clientX - origin.left) / scale,
			y: (event.clientY - origin.top) / scale,
			pressure: event.pressure,
		};
	}

	function onPointerMove(event: PointerEvent): void {
		if (activePointerId === null || event.pointerId !== activePointerId) {
			return;
		}
		points.push(toPoint(event));
		deps.onStrokePreview(points);
	}

	function onPointerUp(event: PointerEvent): void {
		if (activePointerId === null || event.pointerId !== activePointerId) {
			return;
		}
		detach();
		const finished = points;
		points = [];
		activePointerId = null;
		deps.onStrokeEnd(finished);
	}

	function detach(): void {
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerUp);
	}

	return {
		handlePointerDown(event) {
			const tool = deps.getTool();
			if (tool === 'select') {
				return;
			}
			const point = toPoint(event);
			if (tool === 'eraser') {
				deps.onErase(point);
				return;
			}
			event.preventDefault();
			activePointerId = event.pointerId;
			points = [point];
			deps.onStrokeStart();
			deps.onStrokePreview(points);
			window.addEventListener('pointermove', onPointerMove);
			window.addEventListener('pointerup', onPointerUp);
			window.addEventListener('pointercancel', onPointerUp);
		},
		isActive() {
			return activePointerId !== null;
		},
		dispose() {
			detach();
			activePointerId = null;
			points = [];
		},
	};
}
