import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	HostListener,
	computed,
	input,
	output,
} from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import { SlideCanvasComponent } from './slide-canvas.component';
import { thumbnailHeight, thumbnailZoom } from './slide-sorter-overlay-helpers';

/** Pixel width of each thumbnail cell (the clipping box, not the canvas). */
const THUMB_W = 200;

/** Gap between grid cells in pixels. */
const GRID_GAP = 16;

/**
 * SlideSorterOverlayComponent — Angular port of the React `SlideSorterOverlay`.
 *
 * Renders a fixed full-screen modal overlay containing a responsive grid of
 * scaled slide previews. Clicking a thumbnail emits `select(index)`; pressing
 * Escape or clicking the ✕ button emits `closed`.
 *
 * Viewer-first scope: no drag-reorder, no context menu, no section grouping.
 * Those features are tracked in PORTING.md.
 *
 * Usage:
 * ```html
 * <pptx-slide-sorter-overlay
 *   [slides]="slides()"
 *   [canvasSize]="canvasSize()"
 *   [mediaDataUrls]="mediaDataUrls()"
 *   [activeIndex]="activeSlideIndex()"
 *   (select)="goTo($event)"
 *   (closed)="showSorter.set(false)"
 * />
 * ```
 */
@Component({
	selector: 'pptx-slide-sorter-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SlideCanvasComponent],
	template: `
		<!-- Backdrop -->
		<div class="pptx-ng-sorter-backdrop" (click)="onBackdropClick($event)">
			<!-- Modal panel -->
			<div class="pptx-ng-sorter-panel" (click)="$event.stopPropagation()">
				<!-- Header -->
				<header class="pptx-ng-sorter-header">
					<h2 class="pptx-ng-sorter-title">Slide Sorter</h2>
					<span class="pptx-ng-sorter-count">{{ slides().length }} slides</span>
					<button
						type="button"
						class="pptx-ng-sorter-close"
						aria-label="Close slide sorter"
						(click)="closed.emit()"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</header>

				<!-- Scrollable grid -->
				<div class="pptx-ng-sorter-grid-scroll">
					<div class="pptx-ng-sorter-grid" [ngStyle]="gridStyle()">
						@for (slide of slides(); track slide.id; let i = $index) {
							<button
								type="button"
								class="pptx-ng-sorter-cell"
								[class.is-active]="i === activeIndex()"
								[class.is-hidden]="isHiddenSlide(slide)"
								[attr.aria-label]="'Slide ' + (i + 1)"
								[attr.aria-current]="i === activeIndex() ? 'true' : null"
								(click)="onThumbClick(i)"
							>
								<!-- Thumbnail clipping wrapper -->
								<div class="pptx-ng-sorter-thumb-clip" [ngStyle]="clipStyle()">
									<pptx-slide-canvas
										[slide]="slide"
										[canvasSize]="canvasSize()"
										[mediaDataUrls]="mediaDataUrls()"
										[zoom]="thumbZoom()"
									/>
								</div>
								<!-- Slide number badge -->
								<span class="pptx-ng-sorter-index" aria-hidden="true">{{ i + 1 }}</span>
							</button>
						}
					</div>
				</div>
			</div>
		</div>
	`,
	styles: [
		`
			:host {
				display: contents;
			}

			.pptx-ng-sorter-backdrop {
				position: fixed;
				inset: 0;
				z-index: 50;
				display: flex;
				align-items: center;
				justify-content: center;
				background: rgba(0, 0, 0, 0.7);
				backdrop-filter: blur(4px);
			}

			.pptx-ng-sorter-panel {
				display: flex;
				flex-direction: column;
				width: min(96vw, 1200px);
				max-height: 90vh;
				border-radius: 0.5rem;
				background: #1a1a1a;
				color: #e5e5e5;
				box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
				overflow: hidden;
			}

			.pptx-ng-sorter-header {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				padding: 0.75rem 1.25rem;
				border-bottom: 1px solid rgba(255, 255, 255, 0.1);
				flex-shrink: 0;
			}

			.pptx-ng-sorter-title {
				margin: 0;
				font-size: 0.875rem;
				font-weight: 500;
			}

			.pptx-ng-sorter-count {
				font-size: 0.75rem;
				color: rgba(255, 255, 255, 0.5);
				flex: 1;
			}

			.pptx-ng-sorter-close {
				display: flex;
				align-items: center;
				justify-content: center;
				/* Touch-friendly: at least 44x44 CSS px so it can be tapped
				   without a keyboard on mobile. */
				width: 44px;
				height: 44px;
				min-width: 44px;
				min-height: 44px;
				padding: 0;
				border: none;
				border-radius: 50%;
				background: rgba(255, 255, 255, 0.1);
				color: #e5e5e5;
				cursor: pointer;
				transition: background 0.15s;
				flex-shrink: 0;
				touch-action: manipulation;
			}

			.pptx-ng-sorter-close:hover {
				background: rgba(255, 255, 255, 0.2);
			}

			.pptx-ng-sorter-grid-scroll {
				flex: 1;
				overflow-y: auto;
				padding: 1.25rem;
			}

			.pptx-ng-sorter-grid {
				display: grid;
				gap: 1rem;
			}

			.pptx-ng-sorter-cell {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 0.5rem;
				padding: 0.5rem;
				border: 2px solid transparent;
				border-radius: 0.375rem;
				background: transparent;
				cursor: pointer;
				transition:
					border-color 0.15s,
					background 0.15s;
				color: inherit;
			}

			.pptx-ng-sorter-cell:hover {
				background: rgba(255, 255, 255, 0.06);
				border-color: rgba(255, 255, 255, 0.2);
			}

			.pptx-ng-sorter-cell.is-active {
				border-color: #3b82f6;
				background: rgba(59, 130, 246, 0.1);
			}

			.pptx-ng-sorter-cell.is-hidden {
				opacity: 0.4;
			}

			.pptx-ng-sorter-thumb-clip {
				overflow: hidden;
				border-radius: 2px;
				/* Width/height set via [ngStyle] to match computed thumbnail size. */
			}

			/* Remove the 1rem auto margin that SlideCanvasComponent adds to its wrapper
		   so the stage sits flush inside the clipping box. */
			.pptx-ng-sorter-thumb-clip ::ng-deep .pptx-ng-canvas-wrapper {
				margin: 0 !important;
			}

			.pptx-ng-sorter-index {
				font-size: 0.6875rem;
				color: rgba(255, 255, 255, 0.55);
				user-select: none;
			}
		`,
	],
})
export class SlideSorterOverlayComponent {
	/** Full list of slides to display. */
	readonly slides = input.required<PptxSlide[]>();

	/** Natural (100 %) canvas dimensions — passed through to SlideCanvasComponent. */
	readonly canvasSize = input.required<CanvasSize>();

	/** Media asset lookup table — forwarded to each SlideCanvasComponent. */
	readonly mediaDataUrls = input<Map<string, string>>(new Map());

	/** Zero-based index of the currently active slide (highlighted in blue). */
	readonly activeIndex = input<number>(0);

	/** Emits the zero-based index of the thumbnail the user clicked. */
	readonly select = output<number>();

	/** Emits when the user closes the overlay (✕ button or Escape key). */
	readonly closed = output<void>();

	// -------------------------------------------------------------------------
	// Derived display values
	// -------------------------------------------------------------------------

	/** Zoom level that fits the full canvas width into THUMB_W pixels. */
	readonly thumbZoom = computed(() => thumbnailZoom(this.canvasSize().width, THUMB_W));

	/** Pixel height of the clipping box (aspect-correct). */
	readonly thumbH = computed(() =>
		thumbnailHeight(this.canvasSize().width, this.canvasSize().height, THUMB_W),
	);

	/** ngStyle object for the thumbnail clipping box. */
	readonly clipStyle = computed<Record<string, string>>(() => ({
		width: `${THUMB_W}px`,
		height: `${this.thumbH()}px`,
	}));

	/** ngStyle object for the grid: responsive auto-fill columns. */
	readonly gridStyle = computed<Record<string, string>>(() => ({
		'grid-template-columns': `repeat(auto-fill, minmax(${THUMB_W + GRID_GAP * 2 + 4}px, 1fr))`,
	}));

	// -------------------------------------------------------------------------
	// Event handlers
	// -------------------------------------------------------------------------

	/** Keyboard handler: Escape closes the overlay. */
	@HostListener('document:keydown', ['$event'])
	onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			this.closed.emit();
		}
	}

	/** Clicking the backdrop (outside the panel) closes the overlay. */
	onBackdropClick(event: MouseEvent): void {
		// Only close when the click target IS the backdrop element itself.
		if (event.target === event.currentTarget) {
			this.closed.emit();
		}
	}

	/** Clicking a thumbnail selects the slide. */
	onThumbClick(index: number): void {
		this.select.emit(index);
	}

	// -------------------------------------------------------------------------
	// Utilities
	// -------------------------------------------------------------------------

	/** Returns true when a slide has been marked as hidden in the presentation. */
	isHiddenSlide(slide: PptxSlide): boolean {
		// PptxSlide carries a `hidden` boolean when the slide is set to hidden in
		// the OpenXML package. Cast via unknown to avoid accessing a field that
		// may not exist on all versions of the core type.
		const s = slide as unknown as Record<string, unknown>;
		return s['hidden'] === true;
	}
}
