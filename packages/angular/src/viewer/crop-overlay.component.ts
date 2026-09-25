/**
 * crop-overlay.component.ts: the on-canvas crop-mode overlay for one picture.
 *
 * Rendered by {@link SlideCanvasComponent} inside the scaled stage, exactly
 * over the picture's box (same left/top/width/height and rotation), while
 * {@link PictureCropService} has a session on it. What it draws is the shared
 * `buildCropOverlay` descriptor: the dimmed ghost of the whole image (the
 * cropped-away part, also the pan target), the frame outline and the eight
 * black crop handles. Drags go through the shared `beginCropDrag` /
 * `dragCropHandle` / `panCropImage` and land LIVE via the service, so the
 * normal picture renderer shows the new crop as it changes.
 *
 * A press outside the overlay commits the session; so does this overlay being
 * torn down (selection or slide change), deferred a microtask so the commit
 * never writes signals in the middle of a change-detection pass.
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	HostListener,
	inject,
	input,
	OnDestroy,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import {
	beginCropDrag,
	buildCropOverlay,
	CROP_HANDLE_ARIA_KEY,
	CROP_MODE_HINT_KEY,
	dragCropHandle,
	getImageSrc,
	panCropImage,
	toElementAxes,
} from '../internal/shared';
import type { CropDragStart, CropHandleId } from '../internal/shared';
import { PictureCropService } from './picture-crop.service';

/** A live crop gesture: a handle drag, or a pan (`handle === null`). */
interface CropGesture {
	handle: CropHandleId | null;
	start: CropDragStart;
	clientX: number;
	clientY: number;
	pointerId: number;
}

@Component({
	selector: 'pptx-crop-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	host: { style: 'display: contents' },
	template: `
		@let o = overlay();
		<div
			data-pptx-crop-overlay="true"
			data-export-ignore="true"
			[attr.title]="hintKey | translate"
			[style.position]="'absolute'"
			[style.left.px]="element().x"
			[style.top.px]="element().y"
			[style.width.px]="element().width"
			[style.height.px]="element().height"
			[style.transform]="'rotate(' + (element().rotation ?? 0) + 'deg)'"
			[style.transform-origin]="'center'"
			[style.overflow]="'visible'"
			[style.z-index]="10002"
			[style.touch-action]="'none'"
		>
			<div
				data-pptx-crop-ghost
				[style.position]="'absolute'"
				[style.left.px]="o.ghost.left"
				[style.top.px]="o.ghost.top"
				[style.width.px]="o.ghost.width"
				[style.height.px]="o.ghost.height"
				[style.clip-path]="o.ghost.clipPath"
				[style.opacity]="o.ghost.opacity"
				[style.cursor]="'move'"
				(pointerdown)="onPointerDown($event, null)"
			>
				@if (imageSrc(); as src) {
					<img
						alt=""
						draggable="false"
						[src]="src"
						[style.display]="'block'"
						[style.width]="'100%'"
						[style.height]="'100%'"
						[style.pointer-events]="'none'"
						[style.transform]="o.ghost.transform || null"
					/>
				}
			</div>
			<div
				data-pptx-crop-frame
				[style.position]="'absolute'"
				[style.left.px]="o.frame.left"
				[style.top.px]="o.frame.top"
				[style.width.px]="o.frame.width"
				[style.height.px]="o.frame.height"
				[style.box-sizing]="'border-box'"
				[style.outline]="stroke() + 'px solid rgba(0,0,0,0.75)'"
				[style.cursor]="'move'"
				(pointerdown)="onPointerDown($event, null)"
			></div>
			@for (h of o.handles; track h.id) {
				<div
					role="button"
					[attr.data-pptx-crop-handle]="h.id"
					[attr.aria-label]="ariaKey | translate"
					[style.position]="'absolute'"
					[style.left.px]="h.left"
					[style.top.px]="h.top"
					[style.width.px]="h.width"
					[style.height.px]="h.height"
					[style.cursor]="h.cursor"
					(pointerdown)="onPointerDown($event, h.id)"
				>
					<svg
						aria-hidden="true"
						[attr.width]="h.width"
						[attr.height]="h.height"
						[attr.viewBox]="'0 0 ' + h.width + ' ' + h.height"
						style="display: block; overflow: visible"
					>
						<path [attr.d]="h.path" fill="#000" stroke="#fff" [attr.stroke-width]="stroke()" />
					</svg>
				</div>
			}
		</div>
	`,
})
export class CropOverlayComponent implements OnDestroy {
	private readonly crop = inject(PictureCropService, { optional: true });

	/** The picture in crop mode (live: re-read on every drag frame). */
	readonly element = input.required<PptxElement>();
	/** The stage's effective scale (1 = 100%). */
	readonly zoom = input<number>(1);
	readonly mediaDataUrls = input<Map<string, string>>(new Map());

	protected readonly hintKey = CROP_MODE_HINT_KEY;
	protected readonly ariaKey = CROP_HANDLE_ARIA_KEY;
	protected readonly overlay = computed(() => buildCropOverlay(this.element(), this.zoom()));
	protected readonly imageSrc = computed(() => getImageSrc(this.element(), this.mediaDataUrls()));
	/** One screen pixel, in slide pixels. */
	protected readonly stroke = computed(() => 1 / (this.zoom() || 1));

	private gesture: CropGesture | null = null;

	/** Start a handle drag (`handle`) or a pan (`null`). */
	protected onPointerDown(event: PointerEvent, handle: CropHandleId | null): void {
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
		this.gesture = {
			handle,
			start: beginCropDrag(this.element()),
			clientX: event.clientX,
			clientY: event.clientY,
			pointerId: event.pointerId,
		};
	}

	@HostListener('document:pointermove', ['$event'])
	protected onPointerMove(event: PointerEvent): void {
		const gesture = this.gesture;
		if (!gesture || event.pointerId !== gesture.pointerId) {
			return;
		}
		const zoom = this.zoom() || 1;
		const { dx, dy } = toElementAxes(
			(event.clientX - gesture.clientX) / zoom,
			(event.clientY - gesture.clientY) / zoom,
			gesture.start.rotation,
		);
		this.crop?.applyLive(
			gesture.handle === null
				? panCropImage(gesture.start, dx, dy)
				: dragCropHandle(gesture.start, gesture.handle, dx, dy),
		);
	}

	@HostListener('document:pointerup', ['$event'])
	@HostListener('document:pointercancel', ['$event'])
	protected onPointerUp(event: PointerEvent): void {
		if (this.gesture?.pointerId === event.pointerId) {
			this.gesture = null;
		}
	}

	/**
	 * A press anywhere outside the overlay commits the crop. The ribbon Crop
	 * toggle is exempt: its own click commits, and committing here first would
	 * make that click re-enter crop mode.
	 */
	@HostListener('document:pointerdown', ['$event'])
	protected onDocumentPointerDown(event: PointerEvent): void {
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest('[data-pptx-crop-overlay], [data-pptx-ribbon-control="crop"]')) {
			return;
		}
		this.crop?.commit();
	}

	ngOnDestroy(): void {
		const session = this.crop?.state()?.session;
		queueMicrotask(() => this.crop?.commitSession(session));
	}
}
