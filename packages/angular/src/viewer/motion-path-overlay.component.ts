/**
 * motion-path-overlay.component.ts: draws the selected element's motion path on
 * the slide stage and lets the user drag its end point.
 *
 * Selector: `pptx-motion-path-overlay`
 *
 * WHY it is a stage-level sibling and not part of the element's own adorners: a
 * motion path routinely extends far outside the shape's bounding box, and the
 * element wrapper carries the shape's rotation / flip transform, which would
 * skew the path. Projected into the scaled stage (like the collaboration
 * overlays) it shares the stage's UNSCALED slide-pixel space, so the stage's
 * own `transform: scale()` applies the on-screen zoom exactly once and the only
 * zoom maths left is converting a pointer delta back into slide pixels.
 *
 * The DOM contract (`data-pptx-motion-path-overlay`,
 * `data-pptx-motion-path-handle="end"`) is deliberately neutral and identical
 * in every binding, so `e2e/` can address one viewer the same way it addresses
 * the next.
 *
 * Reference binding: packages/react/src/viewer/components/canvas/MotionPathOverlay.tsx
 *
 * @module viewer/motion-path-overlay
 */
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	computed,
	input,
	output,
	viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';

import {
	isEditableMotionPath,
	motionPathEndPixel,
	motionPathFor,
	motionPathToSvgD,
	setMotionPathEnd,
} from '../internal/shared';
import type { CanvasSize, MotionPathFrame } from '../internal/shared';

/** Live drag state: which pointer owns the handle and where it last was. */
interface EndHandleDrag {
	pointerId: number;
	clientX: number;
	clientY: number;
}

/** Slide size assumed when the stage cannot be measured (detached overlay). */
const FALLBACK_CANVAS: CanvasSize = { width: 1280, height: 720 };

@Component({
	selector: 'pptx-motion-path-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (pathD(); as d) {
			<svg
				#overlay
				class="pptx-ng-motion-path-overlay"
				data-pptx-motion-path-overlay="true"
				role="img"
				[attr.aria-label]="'pptx.animation.motionPath.overlay' | translate"
				[attr.width]="size().width"
				[attr.height]="size().height"
			>
				<path
					[attr.d]="d"
					fill="none"
					stroke="#0ea5e9"
					stroke-width="2"
					stroke-dasharray="6 4"
					vector-effect="non-scaling-stroke"
				/>
				<circle
					[attr.cx]="frame().originX"
					[attr.cy]="frame().originY"
					r="5"
					fill="#0ea5e9"
					opacity="0.55"
				/>
				<circle
					data-pptx-motion-path-handle="end"
					[class.is-editable]="editable()"
					[attr.cx]="endPoint().x"
					[attr.cy]="endPoint().y"
					r="7"
					fill="#ffffff"
					stroke="#0ea5e9"
					stroke-width="2"
					[attr.aria-label]="'pptx.animation.motionPath.endHandle' | translate"
					(pointerdown)="onHandlePointerDown($event)"
					(pointermove)="onHandlePointerMove($event)"
					(pointerup)="onHandlePointerUp($event)"
					(pointercancel)="onHandlePointerUp($event)"
				/>
			</svg>
		}
	`,
	styles: `
		:host {
			position: absolute;
			inset: 0;
			pointer-events: none;
			overflow: visible;
		}

		.pptx-ng-motion-path-overlay {
			position: absolute;
			top: 0;
			left: 0;
			z-index: 45;
			pointer-events: none;
			overflow: visible;
		}

		circle.is-editable {
			pointer-events: auto;
			cursor: move;
		}
	`,
})
export class MotionPathOverlayComponent {
	/** The selected element; its centre is the path origin. */
	readonly element = input<PptxElement | null>(null);

	/** The active slide's animations; the path is read off the matching entry. */
	readonly animations = input<readonly PptxElementAnimation[]>([]);

	/** Stage size in slide pixels: the unit the path fractions scale by. */
	readonly canvasSize = input<CanvasSize>(FALLBACK_CANVAS);

	/** Whether the deck is editable; a read-only deck draws no overlay at all. */
	readonly canEdit = input<boolean>(false);

	/** Emits an edited path (drag of the end handle) for the host to commit. */
	readonly pathChange = output<string>();

	private readonly overlayRef = viewChild<ElementRef<SVGSVGElement>>('overlay');

	private drag: EndHandleDrag | null = null;

	/** Guards a divide-by-zero when a host passes an unmeasured stage. */
	protected readonly size = computed<CanvasSize>(() => {
		const size = this.canvasSize();
		return size.width > 0 && size.height > 0 ? size : FALLBACK_CANVAS;
	});

	/** The path applied to the selected element, or `''` when there is none. */
	protected readonly path = computed<string>(() => {
		const element = this.element();
		if (!element || !this.canEdit()) {
			return '';
		}
		return motionPathFor(this.animations(), element.id) ?? '';
	});

	/** Slide-pixel frame the path fractions are measured against. */
	protected readonly frame = computed<MotionPathFrame>(() => {
		const element = this.element();
		const size = this.size();
		return {
			originX: element ? element.x + element.width / 2 : 0,
			originY: element ? element.y + element.height / 2 : 0,
			slideWidth: size.width,
			slideHeight: size.height,
		};
	});

	/** The `d` attribute of the drawn path; empty when nothing is drawable. */
	protected readonly pathD = computed<string>(() => {
		const path = this.path();
		return path ? motionPathToSvgD(path, this.frame()) : '';
	});

	/** Where the end handle sits, in slide pixels. */
	protected readonly endPoint = computed(() => motionPathEndPixel(this.path(), this.frame()));

	/** A closed shape has no free end, so its handle stays inert. */
	protected readonly editable = computed(() => this.canEdit() && isEditableMotionPath(this.path()));

	protected onHandlePointerDown(event: PointerEvent): void {
		if (!this.editable()) {
			return;
		}
		event.stopPropagation();
		event.preventDefault();
		capturePointer(event);
		this.drag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
	}

	protected onHandlePointerMove(event: PointerEvent): void {
		const drag = this.drag;
		if (!drag || drag.pointerId !== event.pointerId) {
			return;
		}
		event.stopPropagation();
		const path = this.path();
		const frame = this.frame();
		const scale = this.stageScale();
		const end = this.endPoint();
		const nextX =
			(end.x + (event.clientX - drag.clientX) / scale - frame.originX) / frame.slideWidth;
		const nextY =
			(end.y + (event.clientY - drag.clientY) / scale - frame.originY) / frame.slideHeight;
		const next = setMotionPathEnd(path, nextX, nextY);
		if (next === path) {
			return;
		}
		// Re-anchor to the pointer so the next move measures from where the path
		// actually ended up, not from where the gesture began.
		this.drag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
		this.pathChange.emit(next);
	}

	protected onHandlePointerUp(event: PointerEvent): void {
		if (this.drag?.pointerId !== event.pointerId) {
			return;
		}
		releasePointer(event);
		this.drag = null;
	}

	/**
	 * The stage's on-screen scale, measured rather than plumbed.
	 *
	 * The overlay is rendered INSIDE the scaled stage at slide-pixel size, so the
	 * ratio between its rendered width and the slide width is exactly the scale
	 * the stage transform applied (auto-fit folded with the user's zoom). Reading
	 * it here avoids threading a value the canvas owns privately, per instance,
	 * through the whole viewer.
	 */
	private stageScale(): number {
		const svg = this.overlayRef()?.nativeElement;
		if (!svg) {
			return 1;
		}
		const rendered = svg.getBoundingClientRect().width;
		return rendered > 0 ? rendered / this.size().width : 1;
	}
}

/** Capture the pointer on the handle so a fast drag cannot outrun it. */
function capturePointer(event: PointerEvent): void {
	const target = event.target;
	if (target instanceof Element && typeof target.setPointerCapture === 'function') {
		target.setPointerCapture(event.pointerId);
	}
}

function releasePointer(event: PointerEvent): void {
	const target = event.target;
	if (target instanceof Element && typeof target.releasePointerCapture === 'function') {
		target.releasePointerCapture(event.pointerId);
	}
}
