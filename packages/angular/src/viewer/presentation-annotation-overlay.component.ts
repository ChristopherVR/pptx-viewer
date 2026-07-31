/**
 * presentation-annotation-overlay.component.ts: SVG overlay that captures
 * pointer events and renders ink strokes + laser dot during presentation mode.
 *
 * Ported from React:
 *   packages/react/src/viewer/components/PresentationAnnotationOverlay.tsx
 *
 * Selector: `pptx-presentation-annotation-overlay`
 *
 * This component is purely presentational: it calls out to
 * {@link PresentationAnnotationsService} for all state mutations, and
 * accepts `canvasSize` and `zoom` to correctly map pointer events from
 * screen space into slide space.
 *
 * When the tool is `'none'` the component renders nothing and sets
 * `pointer-events: none` on its host so click-to-advance still works.
 */

import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	computed,
	inject,
	input,
	viewChild,
} from '@angular/core';

import type { CanvasSize } from '../internal/shared';
import { cursorForTool } from './presentation-annotations-helpers';
import { PresentationAnnotationsService } from './presentation-annotations.service';

@Component({
	selector: 'pptx-presentation-annotation-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle],
	styleUrl: './presentation-annotation-overlay.component.css',
	templateUrl: './presentation-annotation-overlay.component.html',
})
export class PresentationAnnotationOverlayComponent {
	// ------------------------------------------------------------------
	// Inputs
	// ------------------------------------------------------------------

	/** Logical canvas dimensions (the slide's authored size in pixels). */
	readonly canvasSize = input.required<CanvasSize>();

	/**
	 * The zoom factor currently applied to the slide stage.
	 * Pointer-event coordinates are divided by this value to obtain
	 * slide-space coordinates.
	 */
	readonly zoom = input<number>(1);

	// ------------------------------------------------------------------
	// Injected state
	// ------------------------------------------------------------------

	protected readonly service = inject(PresentationAnnotationsService);

	// ------------------------------------------------------------------
	// Template references
	// ------------------------------------------------------------------

	private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svg');

	// ------------------------------------------------------------------
	// Eraser bookkeeping
	// ------------------------------------------------------------------

	/** True while a pointer-down is active in eraser mode. */
	private _isErasing = false;

	// ------------------------------------------------------------------
	// Derived signals
	// ------------------------------------------------------------------

	/** True when any tool other than 'none' is armed. */
	protected readonly isArmed = computed<boolean>(() => this.service.tool() !== 'none');

	/** SVG viewBox string that covers the full canvas. */
	protected readonly viewBox = computed<string>(() => {
		const { width, height } = this.canvasSize();
		return `0 0 ${width} ${height}`;
	});

	/** CSS cursor for the outer wrapper div. */
	protected readonly wrapperStyle = computed<Record<string, string>>(() => ({
		cursor: cursorForTool(this.service.tool()),
		'pointer-events': this.isArmed() ? 'auto' : 'none',
		'z-index': '60',
	}));

	/** Transform the SVG to match the slide's zoom level. */
	protected readonly svgStyle = computed<Record<string, string>>(() => ({
		transform: `scale(${this.zoom()})`,
	}));

	/** All strokes to render: committed + the live in-progress stroke. */
	protected readonly allStrokes = computed(() => {
		const committed = this.service.annotationStrokes();
		const live = this.service.currentStroke();
		return live ? [...committed, live] : committed;
	});

	// ------------------------------------------------------------------
	// Template helpers
	// ------------------------------------------------------------------

	protected strokePath(points: Array<{ x: number; y: number }>): string {
		if (points.length === 0) {
			return '';
		}
		const first = points[0];
		let d = `M ${first.x} ${first.y}`;
		for (let i = 1; i < points.length; i++) {
			const pt = points[i];
			d += ` L ${pt.x} ${pt.y}`;
		}
		return d;
	}

	protected laserDotStyle(x: number, y: number): Record<string, string> {
		const z = this.zoom();
		const dotSize = 24;
		return {
			width: `${dotSize}px`,
			height: `${dotSize}px`,
			left: `${x * z - dotSize / 2}px`,
			top: `${y * z - dotSize / 2}px`,
			'z-index': '70',
		};
	}

	// ------------------------------------------------------------------
	// Pointer event dispatch
	// ------------------------------------------------------------------

	protected onPointerDown(event: PointerEvent): void {
		const tool = this.service.tool();
		if (tool === 'none') {
			return;
		}
		event.preventDefault();
		event.stopPropagation();

		const coords = this._toSlideCoords(event.clientX, event.clientY);
		if (!coords) {
			return;
		}

		if (tool === 'eraser') {
			this._isErasing = true;
			this.service.beginErase(coords.x, coords.y);
			return;
		}
		if (tool === 'pen' || tool === 'highlighter') {
			this.service.beginStroke(coords.x, coords.y);
		}
	}

	protected onPointerMove(event: PointerEvent): void {
		const tool = this.service.tool();
		if (tool === 'none') {
			return;
		}

		const coords = this._toSlideCoords(event.clientX, event.clientY);
		if (!coords) {
			return;
		}

		if (tool === 'laser') {
			this.service.moveLaser(coords.x, coords.y);
			return;
		}
		if (tool === 'eraser' && this._isErasing) {
			this.service.continueErase(coords.x, coords.y);
			return;
		}
		if (tool === 'pen' || tool === 'highlighter') {
			this.service.extendStroke(coords.x, coords.y);
		}
	}

	protected onPointerUp(event: PointerEvent): void {
		const tool = this.service.tool();
		if (tool === 'none') {
			return;
		}
		event.preventDefault();

		if (tool === 'eraser') {
			this._isErasing = false;
			this.service.endErase();
			return;
		}
		this.service.endStroke();
	}

	protected onPointerLeave(_event: PointerEvent): void {
		const tool = this.service.tool();
		if (tool === 'laser') {
			this.service.hideLaser();
		}
		if (tool === 'eraser') {
			this._isErasing = false;
			this.service.endErase();
		}
		this.service.endStroke();
	}

	// ------------------------------------------------------------------
	// Coordinate mapping
	// ------------------------------------------------------------------

	/**
	 * Map a client-space pointer position to slide-space coordinates by
	 * subtracting the SVG element's bounding rect and dividing by the zoom.
	 * Returns `null` when the SVG ref is not yet available.
	 */
	private _toSlideCoords(clientX: number, clientY: number): { x: number; y: number } | null {
		const svgEl = this.svgRef()?.nativeElement;
		if (!svgEl) {
			return null;
		}
		const rect = svgEl.getBoundingClientRect();
		const z = this.zoom() || 1;
		return {
			x: (clientX - rect.left) / z,
			y: (clientY - rect.top) / z,
		};
	}
}
