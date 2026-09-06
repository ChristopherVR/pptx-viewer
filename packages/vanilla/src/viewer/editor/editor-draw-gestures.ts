import type { InkPoint, StrokeToInkElementOpts } from 'pptx-viewer-shared';
import { pointFromPointerEvent } from 'pptx-viewer-shared';

import type { DrawTool } from '../state';
import { resolveTopLevelElementId } from './element-hit';

/**
 * Pointer gesture driver for the Draw ribbon tab's pen/highlighter/eraser
 * tools, the drawing counterpart of `editor-gestures.ts`'s move/resize/rotate
 * driver: it only owns the pointer-event lifecycle (capture the active
 * pointer, accumulate points, dead-zone-free since every sample counts for a
 * stroke), never slide/history mutation (that's `editor-ink-actions.ts`, via
 * the `onCommitStroke` / `onEraseAt` callbacks).
 *
 * `select` is not handled here at all: `editor-controller.ts` only routes a
 * `pointerdown` to this controller when the active `DrawTool` isn't
 * `'select'`, so drawing and the normal move/resize/rotate/inline-edit
 * gestures in `editor-stage-interactions.ts` stay mutually exclusive.
 */

/** Map a client-space pointer coordinate into unscaled stage-local px. */
export function clientPointToStagePoint(
	clientX: number,
	clientY: number,
	origin: { left: number; top: number },
	scale: number,
): InkPoint {
	const s = scale || 1;
	return { x: (clientX - origin.left) / s, y: (clientY - origin.top) / s };
}

export interface DrawGesturesDeps {
	/** Current stage scale (screen px per element px). */
	getScale(): number;
	/** Stage overlay origin in client coordinates, for pointer->stage mapping. */
	getStageOrigin(): { left: number; top: number };
	/** The rendered stage element, for the eraser's hit-test. */
	getStageRoot(): Element | null;
	getTool(): DrawTool;
	getColor(): string;
	getWidth(): number;
	/** A pen/highlighter stroke was released; commit it as a new ink element. */
	onCommitStroke(stroke: StrokeToInkElementOpts): void;
	/** The eraser tool was clicked on an existing element with this id. */
	onEraseAt(id: string): void;
	/**
	 * The in-progress stroke's accumulated points, updated on pointerdown and
	 * every pointermove; `null` once the gesture ends (pointerup/cancel) so the
	 * caller clears its live preview. Optional so existing callers (and tests)
	 * that don't render a live preview are unaffected.
	 */
	onStrokePreview?(points: readonly InkPoint[] | null): void;
}

export interface DrawGestures {
	/** Pointer-down on the stage while a drawing tool (not `'select'`) is active. */
	onStagePointerDown(event: PointerEvent): void;
	isActive(): boolean;
	/** Abort listeners without committing a stroke (teardown / tool switch). */
	dispose(): void;
}

interface ActiveStroke {
	tool: 'pen' | 'highlighter' | 'freeform';
	pointerId: number;
	points: InkPoint[];
}

export function createDrawGestures(deps: DrawGesturesDeps): DrawGestures {
	let active: ActiveStroke | null = null;

	/**
	 * Map a pointer event to a stage-local point, carrying its pressure and
	 * tilt reading along (via the shared `pointFromPointerEvent`).
	 * `strokeToInkElement` (via the shared `onCommitStroke` path) decides
	 * whether the accumulated per-point pressures vary enough, or any point's
	 * tilt is genuinely non-zero, to author a variable-width / calligraphic
	 * stroke.
	 */
	const mapPoint = (event: PointerEvent): InkPoint => {
		const { x, y } = clientPointToStagePoint(
			event.clientX,
			event.clientY,
			deps.getStageOrigin(),
			deps.getScale(),
		);
		return pointFromPointerEvent(x, y, event);
	};

	function detach(): void {
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerCancel);
	}

	function onPointerMove(event: PointerEvent): void {
		if (!active || event.pointerId !== active.pointerId) {
			return;
		}
		active.points.push(mapPoint(event));
		deps.onStrokePreview?.(active.points);
	}

	function onPointerUp(event: PointerEvent): void {
		if (!active || event.pointerId !== active.pointerId) {
			return;
		}
		active.points.push(mapPoint(event));
		const stroke = active;
		detach();
		active = null;
		deps.onStrokePreview?.(null);
		deps.onCommitStroke({
			points: stroke.points,
			color: deps.getColor(),
			width: deps.getWidth(),
			tool: stroke.tool,
		});
	}

	function onPointerCancel(event: PointerEvent): void {
		if (!active || event.pointerId !== active.pointerId) {
			return;
		}
		detach();
		active = null;
		deps.onStrokePreview?.(null);
	}

	return {
		onStagePointerDown(event) {
			if (event.button !== 0) {
				return;
			}
			const tool = deps.getTool();
			if (tool === 'select') {
				return;
			}
			if (tool === 'eraser') {
				const id = resolveTopLevelElementId(event.target, deps.getStageRoot());
				if (id) {
					event.preventDefault();
					event.stopPropagation();
					deps.onEraseAt(id);
				}
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			active = { tool, pointerId: event.pointerId, points: [mapPoint(event)] };
			deps.onStrokePreview?.(active.points);
			window.addEventListener('pointermove', onPointerMove);
			window.addEventListener('pointerup', onPointerUp);
			window.addEventListener('pointercancel', onPointerCancel);
		},
		isActive: () => active !== null,
		dispose() {
			const wasActive = active !== null;
			detach();
			active = null;
			if (wasActive) {
				deps.onStrokePreview?.(null);
			}
		},
	};
}
