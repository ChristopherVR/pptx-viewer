/**
 * mobile-slides-sheet.component.ts: Mobile bottom sheet for slide thumbnails.
 *
 * Ported from: packages/react/src/viewer/components/mobile/MobileSlidesSheet.tsx
 *
 * Renders a scrollable grid of scaled live slide previews inside a
 * `MobileSheetComponent`. Tapping a thumbnail emits `jumpToSlide(index)` and
 * the sheet closes automatically. Uses the same `SlideCanvasComponent` /
 * `thumbnailZoom` / `thumbnailHeight` pattern as `SlideSorterOverlayComponent`
 * so thumbnails are live (not static images).
 *
 * The sheet occupies 70 % of the viewport height so the active canvas remains
 * partially visible, matching the React `heightFraction={0.7}` default.
 *
 * Inputs
 *   open          : controls sheet visibility
 *   slides        : the full slide array (viewer or editor deck)
 *   canvasSize    : natural canvas dimensions forwarded to SlideCanvasComponent
 *   mediaDataUrls : asset lookup forwarded to SlideCanvasComponent
 *   activeIndex   : currently displayed slide (highlighted in the grid)
 *
 * Outputs
 *   closed        : user dismissed the sheet without selecting a slide
 *   jumpToSlide   : user tapped a thumbnail; value is the zero-based slide index
 */

import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import { MobileSheetComponent } from './mobile-sheet.component';
import { SlideCanvasComponent } from './slide-canvas.component';
import { thumbnailHeight, thumbnailZoom } from './slide-sorter-overlay-helpers';

/** Pixel width of each thumbnail clipping box. */
const THUMB_W = 160;

@Component({
	selector: 'pptx-mobile-slides-sheet',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, MobileSheetComponent, SlideCanvasComponent],
	template: `
		<pptx-mobile-sheet
			[open]="open()"
			title="Slides"
			[heightFraction]="0.7"
			(closed)="closed.emit()"
		>
			<!-- Slide count summary -->
			<p class="pptx-ng-mslides-count" aria-live="polite">
				{{ slides().length }} slide{{ slides().length === 1 ? '' : 's' }} &nbsp;&mdash;&nbsp; slide
				{{ activeIndex() + 1 }} active
			</p>

			<!-- Grid of thumbnails -->
			<div class="pptx-ng-mslides-grid" role="listbox" aria-label="Slides">
				@for (slide of slides(); track slide.id; let i = $index) {
					<button
						type="button"
						class="pptx-ng-mslides-cell"
						[class.is-active]="i === activeIndex()"
						role="option"
						[attr.aria-selected]="i === activeIndex()"
						[attr.aria-label]="'Slide ' + (i + 1)"
						(click)="onThumbClick(i)"
					>
						<!-- Thumbnail clipping wrapper -->
						<div class="pptx-ng-mslides-clip" [ngStyle]="clipStyle()">
							<pptx-slide-canvas
								[slide]="slide"
								[canvasSize]="canvasSize()"
								[mediaDataUrls]="mediaDataUrls()"
								[zoom]="thumbZoom()"
								[editable]="false"
								[autoFit]="false"
								[interactive]="false"
							/>
						</div>

						<!-- Slide number badge -->
						<span class="pptx-ng-mslides-num" aria-hidden="true">{{ i + 1 }}</span>
					</button>
				}
			</div>
		</pptx-mobile-sheet>
	`,
	styles: [
		`
			:host {
				display: contents;
			}

			/* ── Slide count summary ── */

			.pptx-ng-mslides-count {
				margin: 0;
				padding: 0.5rem 1rem 0.25rem;
				font-size: 0.75rem;
				color: rgba(255, 255, 255, 0.45);
			}

			/* ── Grid ── */

			.pptx-ng-mslides-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
				gap: 0.75rem;
				padding: 0.75rem 0.875rem 1.5rem;
			}

			/* ── Thumbnail cell ── */

			.pptx-ng-mslides-cell {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.375rem;
				padding: 0.375rem;
				border: 2px solid transparent;
				border-radius: 0.5rem;
				background: transparent;
				color: inherit;
				cursor: pointer;
				touch-action: manipulation;
				-webkit-tap-highlight-color: transparent;
				transition:
					border-color 0.12s,
					background 0.12s;
			}

			.pptx-ng-mslides-cell:hover {
				background: rgba(255, 255, 255, 0.05);
				border-color: rgba(255, 255, 255, 0.15);
			}

			.pptx-ng-mslides-cell:active {
				background: rgba(255, 255, 255, 0.1);
			}

			.pptx-ng-mslides-cell.is-active {
				border-color: #3b82f6;
				background: rgba(59, 130, 246, 0.1);
			}

			/* ── Clipping box: fixed width, aspect-correct height via [ngStyle].
			       ::ng-deep removes the 1rem auto margin from SlideCanvas so the
			       stage sits flush (same technique as SlideSorterOverlayComponent). ── */

			.pptx-ng-mslides-clip {
				overflow: hidden;
				border-radius: 0.25rem;
				width: 100%;
			}

			.pptx-ng-mslides-clip ::ng-deep .pptx-ng-canvas-wrapper {
				margin: 0 !important;
			}

			/* ── Slide number badge ── */

			.pptx-ng-mslides-num {
				display: block;
				font-size: 0.625rem;
				color: rgba(255, 255, 255, 0.4);
				line-height: 1.4;
				user-select: none;
			}
		`,
	],
})
export class MobileSlidesSheetComponent {
	// ── Inputs ────────────────────────────────────────────────────────────────

	/** Whether the sheet is visible. */
	readonly open = input<boolean>(false);

	/** The full slide array to display as thumbnails. */
	readonly slides = input<readonly PptxSlide[]>([]);

	/** Natural (100 %) canvas dimensions forwarded to each SlideCanvasComponent. */
	readonly canvasSize = input.required<CanvasSize>();

	/** Media asset lookup table forwarded to each SlideCanvasComponent. */
	readonly mediaDataUrls = input<Map<string, string>>(new Map());

	/** Zero-based index of the currently active slide (highlighted). */
	readonly activeIndex = input<number>(0);

	// ── Outputs ───────────────────────────────────────────────────────────────

	/** Emits when the user dismisses the sheet without selecting a slide. */
	readonly closed = output<void>();

	/**
	 * Emits the zero-based index of the slide the user tapped. The orchestrator
	 * should call `goTo(index)` and then close this sheet.
	 */
	readonly jumpToSlide = output<number>();

	// ── Derived thumbnail dimensions ──────────────────────────────────────────

	/** Zoom level that fits THUMB_W pixels wide. */
	readonly thumbZoom = computed(() => thumbnailZoom(this.canvasSize().width, THUMB_W));

	/** Pixel height for the clip box (aspect-correct). */
	readonly thumbH = computed(() =>
		thumbnailHeight(this.canvasSize().width, this.canvasSize().height, THUMB_W),
	);

	/** ngStyle for the clipping wrapper. */
	readonly clipStyle = computed<Record<string, string>>(() => ({
		width: `${THUMB_W}px`,
		height: `${this.thumbH()}px`,
	}));

	// ── Event handler ─────────────────────────────────────────────────────────

	onThumbClick(index: number): void {
		this.jumpToSlide.emit(index);
		this.closed.emit();
	}
}
