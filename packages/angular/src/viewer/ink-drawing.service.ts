/**
 * ink-drawing.service.ts: Pen/highlighter/freeform/eraser drawing state +
 * logic for `SlideCanvasComponent`'s "draw" branch: capturing a live stroke's
 * points, the SVG preview path, eraser hit-testing against ink elements, and
 * finalising a completed stroke into an `InkPptxElement`.
 *
 * Extracted from {@link SlideCanvasComponent}. Provided per canvas instance
 * (`providers: [InkDrawingService]`), so each canvas has its own in-progress
 * stroke. The component's pointerdown/move/up handlers dispatch to this
 * service FIRST (draw tools take over all pointer gestures), falling through
 * to the select/marquee/drag path only when {@link isDrawToolActive} is false
 * (down) or the move/up delegate methods return `false` (no stroke in
 * progress).
 */

import { Injectable, signal } from '@angular/core';
import type { InkPptxElement, PptxElement } from 'pptx-viewer-core';

import { findEraserHitElementId } from '../internal/shared';
import { pointsToSvgPathD, strokeToInkElement } from './ink-drawing-helpers';
import type { InkPoint } from './ink-drawing-helpers';

/** The draw tools `SlideCanvasComponent` forwards from the ribbon Draw tab. */
export type DrawTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform';

/** Live host accessors + emitters the ink-drawing controller needs. */
interface InkDrawingHost {
	readonly stageElement: () => HTMLElement | undefined;
	readonly effectiveScale: () => number;
	readonly elements: () => readonly PptxElement[];
	readonly drawTool: () => DrawTool;
	readonly drawColor: () => string;
	readonly drawWidth: () => number;
	readonly emitInkStrokeComplete: (ink: InkPptxElement) => void;
	readonly emitEraserHit: (id: string) => void;
}

@Injectable()
export class InkDrawingService {
	/** Whether a freehand stroke is in progress. Signal for template reactivity. */
	readonly active = signal(false);
	/** SVG path `d` for the live stroke preview (updated on every pointer move). */
	readonly liveInkPath = signal<string>('');
	/** Accumulated points for the stroke currently being drawn. */
	private points: InkPoint[] = [];

	private host: InkDrawingHost | null = null;

	/** Wire the host accessors/emitters (called once from the component constructor). */
	bind(host: InkDrawingHost): void {
		this.host = host;
	}

	private requireHost(): InkDrawingHost {
		if (!this.host) {
			throw new Error('InkDrawingService.bind() was not called');
		}
		return this.host;
	}

	/** True when a draw tool (anything but 'select') should own the current gesture. */
	isDrawToolActive(): boolean {
		return this.requireHost().drawTool() !== 'select';
	}

	/**
	 * Handle a stage pointerdown while a draw tool is active: eraser hit-tests
	 * against ink elements (topmost wins); pen/highlighter/freeform begin a new
	 * stroke.
	 */
	handleStagePointerDown(event: PointerEvent): void {
		const host = this.requireHost();
		const stage = host.stageElement();
		if (!stage) {
			return;
		}
		const rect = stage.getBoundingClientRect();
		const zoom = host.effectiveScale() || 1;
		const pt: InkPoint = {
			x: (event.clientX - rect.left) / zoom,
			y: (event.clientY - rect.top) / zoom,
			pressure: event.pressure,
		};

		if (host.drawTool() === 'eraser') {
			// Find the top-most ink/contentPart element under the pointer (+ hit
			// radius). `contentPart` is included because ink saved via the Draw
			// tab reloads in that shape, so it must stay erasable after a
			// save/reload round-trip.
			const hitId = findEraserHitElementId(host.elements(), pt);
			if (hitId) {
				host.emitEraserHit(hitId);
			}
			return;
		}

		// pen / highlighter / freeform: begin stroke
		event.preventDefault();
		(event.target as Element | null)?.setPointerCapture?.(event.pointerId);
		this.points = [pt];
		this.active.set(true);
		this.liveInkPath.set(pointsToSvgPathD(this.points));
	}

	/** Append a point to the in-progress stroke. Returns false when no stroke is active (caller should fall through). */
	handlePointerMove(event: PointerEvent): boolean {
		if (!this.active()) {
			return false;
		}
		const host = this.requireHost();
		const stage = host.stageElement();
		if (!stage) {
			return true;
		}
		const rect = stage.getBoundingClientRect();
		const zoom = host.effectiveScale() || 1;
		const pt: InkPoint = {
			x: (event.clientX - rect.left) / zoom,
			y: (event.clientY - rect.top) / zoom,
			pressure: event.pressure,
		};
		this.points.push(pt);
		this.liveInkPath.set(pointsToSvgPathD(this.points));
		return true;
	}

	/** Finalise the in-progress stroke and emit it. Returns false when no stroke was active (caller should fall through). */
	handlePointerUp(): boolean {
		if (!this.active()) {
			return false;
		}
		const host = this.requireHost();
		this.active.set(false);
		const tool = host.drawTool();
		const resolvedTool: 'pen' | 'highlighter' | 'freeform' =
			tool === 'highlighter' ? 'highlighter' : tool === 'freeform' ? 'freeform' : 'pen';
		const ink = strokeToInkElement({
			points: this.points,
			color: host.drawColor(),
			width: host.drawWidth(),
			tool: resolvedTool,
		});
		if (ink) {
			host.emitInkStrokeComplete(ink);
		}
		this.points = [];
		this.liveInkPath.set('');
		return true;
	}
}
