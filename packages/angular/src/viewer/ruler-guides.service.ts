/**
 * ruler-guides.service.ts: User-created ruler guide-line state + logic for
 * `SlideCanvasComponent`: dragging a new guide off a ruler strip, dragging an
 * existing guide, and removing one (double-click its handle).
 *
 * Extracted from {@link SlideCanvasComponent}. Provided per canvas instance
 * (`providers: [RulerGuidesService]`), so each canvas keeps its own set of
 * guides. The component's shared pointermove/pointerup handlers check
 * {@link isDragging} / call {@link handlePointerMove} / {@link handlePointerUp}
 * FIRST (a guide drag takes over the gesture entirely), falling through to the
 * draw/marquee/drag path only when no guide drag is in progress. The general
 * move-drag's guide-snap math stays on the component (it needs the drag's
 * live `box`), reading {@link rulerGuides} directly.
 */

import { Injectable, signal } from '@angular/core';

import { rulerDragToGuidePosition } from '../internal/shared';
import type { CanvasSize } from '../internal/shared';

/** A user-created guide line dragged from a ruler strip. */
export interface RulerGuide {
	id: string;
	axis: 'x' | 'y';
	pos: number;
}

export function centeredGuide(axis: RulerGuide['axis'], size: CanvasSize, id: string): RulerGuide {
	return { id, axis, pos: axis === 'x' ? size.width / 2 : size.height / 2 };
}

/** Live host accessors the guide controller needs. */
interface RulerGuidesHost {
	readonly editable: () => boolean;
	readonly stageElement: () => HTMLElement | undefined;
	readonly effectiveScale: () => number;
	readonly canvasSize: () => CanvasSize;
}

@Injectable()
export class RulerGuidesService {
	/**
	 * User-created guide lines (dragged from rulers or added from toolbar).
	 * axis:'x' -> vertical line at x=pos; axis:'y' -> horizontal line at y=pos.
	 */
	readonly rulerGuides = signal<readonly RulerGuide[]>([]);
	/** Active guide-drag state (id + axis only), or null when nothing is being dragged. */
	private guideDrag: Pick<RulerGuide, 'id' | 'axis'> | null = null;
	/** Ruler strip a drag-out-a-guide gesture was armed on, or null. */
	private rulerDragAxis: 'h' | 'v' | null = null;

	private host: RulerGuidesHost | null = null;

	/** Wire the host accessors (called once from the component constructor). */
	bind(host: RulerGuidesHost): void {
		this.host = host;
	}

	private requireHost(): RulerGuidesHost {
		if (!this.host) {
			throw new Error('RulerGuidesService.bind() was not called');
		}
		return this.host;
	}

	/** True while an existing or just-created guide is being dragged. */
	isDragging(): boolean {
		return this.guideDrag !== null;
	}

	/** Add a centered guide from the View ribbon without starting a drag gesture. */
	addGuide(axis: RulerGuide['axis']): void {
		const host = this.requireHost();
		if (!host.editable()) {
			return;
		}
		const id = `guide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		this.rulerGuides.update((guides) => [...guides, centeredGuide(axis, host.canvasSize(), id)]);
	}

	/** Begin dragging an existing guide. Called from the guide handle pointerdown. */
	onGuidePointerDown(event: PointerEvent, id: string, axis: RulerGuide['axis']): void {
		event.stopPropagation();
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		this.guideDrag = { id, axis };
	}

	/** Remove a guide (called on guide handle double-click). */
	onGuideDoubleClick(event: MouseEvent, id: string): void {
		event.stopPropagation();
		this.rulerGuides.update((gs) => gs.filter((g) => g.id !== id));
	}

	/**
	 * Arm a drag-out-a-guide gesture on a ruler strip ('h' = the horizontal strip
	 * along the top, 'v' = the vertical strip down the left).
	 *
	 * Nothing is created yet: the guide is dropped on pointer-UP so a stray click
	 * on the strip cannot leave a guide behind. This is the gesture React, Vue,
	 * Svelte and Vanilla all implement; Angular used to create the guide on
	 * pointer-DOWN off its own stage-relative arithmetic, which both diverged
	 * from the other bindings and duplicated the drop maths.
	 */
	onRulerPointerDown(axis: 'h' | 'v', event: PointerEvent): void {
		if (!this.requireHost().editable()) {
			return;
		}
		event.preventDefault();
		(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
		this.rulerDragAxis = axis;
	}

	/**
	 * Resolve an armed ruler drag: drop one guide when the pointer left the strip
	 * and landed on the slide. All three rules (must have left the strip, strip
	 * thickness subtracted before un-scaling, out-of-slide drops discarded) live
	 * in the shared {@link rulerDragToGuidePosition}.
	 */
	onRulerPointerUp(axis: 'h' | 'v', event: PointerEvent): void {
		const armed = this.rulerDragAxis;
		this.rulerDragAxis = null;
		const strip = event.currentTarget as Element | null;
		if (armed !== axis || !strip) {
			return;
		}
		try {
			strip.releasePointerCapture?.(event.pointerId);
		} catch {
			// Capture may already have been released by the browser.
		}
		const host = this.requireHost();
		const rect = strip.getBoundingClientRect();
		const offset = axis === 'h' ? event.clientY - rect.top : event.clientX - rect.left;
		const size = host.canvasSize();
		const position = rulerDragToGuidePosition(
			offset,
			host.effectiveScale(),
			axis === 'h' ? size.height : size.width,
		);
		if (position === null) {
			return;
		}
		const id = `guide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		this.rulerGuides.update((gs) => [
			...gs,
			{ id, axis: axis === 'h' ? ('y' as const) : ('x' as const), pos: position },
		]);
	}

	/** Update the dragged guide's position. Returns false when no guide drag is in progress (caller should fall through). */
	handlePointerMove(event: PointerEvent): boolean {
		if (!this.guideDrag) {
			return false;
		}
		const host = this.requireHost();
		const stage = host.stageElement();
		if (stage) {
			const rect = stage.getBoundingClientRect();
			const z = host.effectiveScale() || 1;
			const guides = this.rulerGuides();
			const { id, axis } = this.guideDrag;
			const rawPos =
				axis === 'x' ? (event.clientX - rect.left) / z : (event.clientY - rect.top) / z;
			const canvasSize = host.canvasSize();
			const clampMax = axis === 'x' ? canvasSize.width : canvasSize.height;
			const pos = Math.max(0, Math.min(clampMax, rawPos));
			this.rulerGuides.set(guides.map((g) => (g.id === id ? { ...g, pos } : g)));
		}
		return true;
	}

	/** End the guide drag. Returns false when no guide drag was in progress (caller should fall through). */
	handlePointerUp(): boolean {
		if (!this.guideDrag) {
			return false;
		}
		this.guideDrag = null;
		return true;
	}
}
