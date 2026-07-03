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

import type { CanvasSize } from '../internal/shared';

/** A user-created guide line dragged from a ruler strip. */
export interface RulerGuide {
	id: string;
	axis: 'x' | 'y';
	pos: number;
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

	/** Drag from the horizontal ruler to create a new horizontal guide (axis:'y'). */
	onHRulerPointerDown(event: PointerEvent): void {
		const host = this.requireHost();
		if (!host.editable()) {
			return;
		}
		const stage = host.stageElement();
		if (!stage) {
			return;
		}
		event.preventDefault();
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		const rect = stage.getBoundingClientRect();
		const z = host.effectiveScale() || 1;
		const pos = (event.clientY - rect.top) / z;
		const id = `guide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		this.rulerGuides.update((gs) => [...gs, { id, axis: 'y' as const, pos: Math.max(0, pos) }]);
		this.guideDrag = { id, axis: 'y' };
	}

	/** Drag from the vertical ruler to create a new vertical guide (axis:'x'). */
	onVRulerPointerDown(event: PointerEvent): void {
		const host = this.requireHost();
		if (!host.editable()) {
			return;
		}
		const stage = host.stageElement();
		if (!stage) {
			return;
		}
		event.preventDefault();
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		const rect = stage.getBoundingClientRect();
		const z = host.effectiveScale() || 1;
		const pos = (event.clientX - rect.left) / z;
		const id = `guide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		this.rulerGuides.update((gs) => [...gs, { id, axis: 'x' as const, pos: Math.max(0, pos) }]);
		this.guideDrag = { id, axis: 'x' };
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
