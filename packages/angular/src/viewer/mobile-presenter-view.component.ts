import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import {
	formatMobileElapsed,
	isFirstSlide,
	isLastSlide,
	mobileElapsedSince,
	mobileNextThumbSize,
	mobileSlideCounter,
} from '../internal/shared';
import { currentSlideAt, nextSlideAfter, resolvePresenterNotes } from './presenter-view-helpers';
import { SlideCanvasComponent } from './slide-canvas.component';

/** Clock tick interval (ms) for the elapsed-timer display. */
const CLOCK_TICK_MS = 1000;

/**
 * MobilePresenterViewComponent: single-column phone layout for presenter /
 * speaker view, shown instead of the desktop split-screen
 * `PresenterViewComponent` when the speaker enters presenter mode on a small
 * screen (the orchestrator branches on `IsMobileService.isMobile()`). The
 * desktop layout is left unchanged; only the layout differs.
 *
 * Top to bottom: header (elapsed timer + slide counter + exit), the current
 * slide large, a small next-slide thumbnail, scrollable speaker notes, and
 * prev/next controls; all offset by the device safe-area insets. Pure geometry
 * / labels / time formatting come from `pptx-viewer-shared` (`presenter-mobile`,
 * re-exported via `../internal/shared`). Slide rendering reuses
 * `pptx-slide-canvas` like the desktop presenter.
 *
 * Selector: `pptx-mobile-presenter-view`. Keyboard navigation is owned by the
 * orchestrator; this component registers no document keydown listener.
 */
@Component({
	selector: 'pptx-mobile-presenter-view',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SlideCanvasComponent],
	styles: `
		:host {
			position: absolute;
			inset: 0;
			z-index: 50;
			display: flex;
			flex-direction: column;
			background: #0b0b0c;
			color: #f5f5f5;
			font-family: system-ui, sans-serif;
			padding-top: env(safe-area-inset-top, 0px);
			padding-bottom: env(safe-area-inset-bottom, 0px);
			padding-left: env(safe-area-inset-left, 0px);
			padding-right: env(safe-area-inset-right, 0px);
		}

		.pptx-ng-mpresenter-header,
		.pptx-ng-mpresenter-next,
		.pptx-ng-mpresenter-ctl {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			padding: 0.5rem 1rem;
		}

		.pptx-ng-mpresenter-header {
			justify-content: space-between;
			border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		}

		.pptx-ng-mpresenter-label {
			font-size: 0.625rem;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: rgba(255, 255, 255, 0.55);
		}

		.pptx-ng-mpresenter-elapsed {
			font-family: ui-monospace, monospace;
			font-variant-numeric: tabular-nums;
			font-size: 1.125rem;
			color: #6ea8fe;
		}

		.pptx-ng-mpresenter-counter {
			font-family: ui-monospace, monospace;
			font-variant-numeric: tabular-nums;
			font-size: 0.875rem;
		}

		.pptx-ng-mpresenter-exit {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 44px;
			height: 44px;
			min-width: 44px;
			min-height: 44px;
			border: none;
			border-radius: 6px;
			background: transparent;
			color: rgba(255, 255, 255, 0.75);
			cursor: pointer;
			font-size: 1.25rem;
			line-height: 1;
		}

		.pptx-ng-mpresenter-exit:hover {
			background: rgba(255, 255, 255, 0.12);
			color: #fff;
		}

		.pptx-ng-mpresenter-main {
			display: flex;
			align-items: center;
			justify-content: center;
			background: #000;
			padding: 0.75rem;
		}

		.pptx-ng-mpresenter-main-stage {
			width: 100%;
			max-width: 640px;
		}

		.pptx-ng-mpresenter-next {
			border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		}

		.pptx-ng-mpresenter-thumb {
			flex: 0 0 auto;
			overflow: hidden;
			border: 1px solid rgba(255, 255, 255, 0.15);
			border-radius: 4px;
		}

		.pptx-ng-mpresenter-next-empty {
			display: flex;
			flex: 1 1 auto;
			align-items: center;
			justify-content: center;
			height: 3rem;
			border: 1px solid rgba(255, 255, 255, 0.15);
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.04);
			font-size: 0.625rem;
			font-style: italic;
			color: rgba(255, 255, 255, 0.5);
		}

		.pptx-ng-mpresenter-notes {
			flex: 1 1 auto;
			display: flex;
			flex-direction: column;
			min-height: 0;
			padding: 0.5rem 1rem;
		}

		.pptx-ng-mpresenter-notes-body {
			flex: 1 1 auto;
			overflow-y: auto;
			margin-top: 0.25rem;
			border: 1px solid rgba(255, 255, 255, 0.15);
			border-radius: 6px;
			background: rgba(255, 255, 255, 0.04);
			padding: 0.5rem 0.75rem;
			white-space: pre-wrap;
			line-height: 1.5;
			font-size: 15px;
		}

		.pptx-ng-mpresenter-notes-empty {
			font-style: italic;
			color: rgba(255, 255, 255, 0.5);
		}

		.pptx-ng-mpresenter-ctl {
			justify-content: space-between;
			border-top: 1px solid rgba(255, 255, 255, 0.08);
		}

		.pptx-ng-mpresenter-navbtn {
			flex: 1 1 0;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 0.375rem;
			height: 44px;
			border: none;
			border-radius: 6px;
			background: rgba(255, 255, 255, 0.08);
			color: #f5f5f5;
			cursor: pointer;
			font-size: 0.9rem;
		}

		.pptx-ng-mpresenter-navbtn:hover:not(:disabled) {
			background: rgba(255, 255, 255, 0.16);
		}

		.pptx-ng-mpresenter-navbtn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.pptx-ng-mpresenter-empty {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			color: rgba(255, 255, 255, 0.6);
		}
	`,
	template: `
		@if (currentSlide(); as current) {
			<!-- Header: elapsed + counter + exit -->
			<div class="pptx-ng-mpresenter-header">
				<div>
					<div class="pptx-ng-mpresenter-label">Elapsed</div>
					<div class="pptx-ng-mpresenter-elapsed">{{ elapsedLabel() }}</div>
				</div>
				<span class="pptx-ng-mpresenter-counter">{{ counterLabel() }}</span>
				<button
					type="button"
					class="pptx-ng-mpresenter-exit"
					(click)="exit.emit()"
					aria-label="End presentation"
					title="End presentation"
				>
					&#x2715;
				</button>
			</div>

			<!-- Current slide (large) -->
			<div class="pptx-ng-mpresenter-main">
				<div class="pptx-ng-mpresenter-main-stage">
					<pptx-slide-canvas
						[slide]="currentPreviewSlide()"
						[canvasSize]="canvasSize()"
						[mediaDataUrls]="mediaDataUrls()"
						[zoom]="1"
						[interactive]="false"
					/>
				</div>
			</div>

			<!-- Next thumbnail -->
			<div class="pptx-ng-mpresenter-next">
				<span class="pptx-ng-mpresenter-label">Next slide</span>
				@if (nextPreviewSlide(); as next) {
					<div class="pptx-ng-mpresenter-thumb" [ngStyle]="thumbStyle()">
						<pptx-slide-canvas
							[slide]="next"
							[canvasSize]="canvasSize()"
							[mediaDataUrls]="mediaDataUrls()"
							[zoom]="1"
							[interactive]="false"
						/>
					</div>
				} @else {
					<div class="pptx-ng-mpresenter-next-empty">End of presentation</div>
				}
			</div>

			<!-- Speaker notes (scrollable) -->
			<div class="pptx-ng-mpresenter-notes">
				<div class="pptx-ng-mpresenter-label">Speaker notes</div>
				<div class="pptx-ng-mpresenter-notes-body">
					@if (notes().hasRichNotes) {
						@for (seg of notes().segments; track seg.key) {
							@if (seg.isBreak) {
								<br />
							} @else {
								<span [ngStyle]="seg.style">{{ seg.text }}</span>
							}
						}
					} @else if (notes().hasAnyNotes) {
						{{ notes().plainText }}
					} @else {
						<span class="pptx-ng-mpresenter-notes-empty">No notes for this slide.</span>
					}
				</div>
			</div>

			<!-- Prev / Next controls -->
			<div class="pptx-ng-mpresenter-ctl">
				<button
					type="button"
					class="pptx-ng-mpresenter-navbtn"
					(click)="movePresentationSlide.emit(-1)"
					[disabled]="atFirst()"
					aria-label="Previous slide"
					title="Previous slide"
				>
					&#x2039; Prev
				</button>
				<button
					type="button"
					class="pptx-ng-mpresenter-navbtn"
					(click)="movePresentationSlide.emit(1)"
					[disabled]="atLast()"
					aria-label="Next slide"
					title="Next slide"
				>
					Next &#x203A;
				</button>
			</div>
		} @else {
			<div class="pptx-ng-mpresenter-empty">No slides to present.</div>
		}
	`,
})
export class MobilePresenterViewComponent {
	// ------------------------------------------------------------------
	// Inputs
	// ------------------------------------------------------------------

	readonly slides = input.required<PptxSlide[]>();
	readonly currentSlideIndex = input.required<number>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly templateElements = input<readonly PptxElement[]>([]);
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly presentationStartTime = input<number | null>(null);

	// ------------------------------------------------------------------
	// Outputs
	// ------------------------------------------------------------------

	readonly movePresentationSlide = output<1 | -1>();
	readonly exit = output<void>();

	// ------------------------------------------------------------------
	// Internal state
	// ------------------------------------------------------------------

	/** Live wall-clock (epoch ms), advanced once per second. */
	private readonly now = signal(Date.now());

	constructor() {
		if (typeof setInterval !== 'undefined') {
			const handle = setInterval(() => this.now.set(Date.now()), CLOCK_TICK_MS);
			inject(DestroyRef).onDestroy(() => clearInterval(handle));
		}
	}

	// ------------------------------------------------------------------
	// Derived signals
	// ------------------------------------------------------------------

	protected readonly currentSlide = computed<PptxSlide | undefined>(() =>
		currentSlideAt(this.slides(), this.currentSlideIndex()),
	);

	protected readonly nextSlide = computed<PptxSlide | undefined>(() =>
		nextSlideAfter(this.slides(), this.currentSlideIndex()),
	);

	protected readonly currentPreviewSlide = computed<PptxSlide | undefined>(() =>
		this.withTemplate(this.currentSlide()),
	);

	protected readonly nextPreviewSlide = computed<PptxSlide | undefined>(() =>
		this.withTemplate(this.nextSlide()),
	);

	protected readonly notes = computed(() => resolvePresenterNotes(this.currentSlide()));

	protected readonly elapsedLabel = computed<string>(() =>
		formatMobileElapsed(mobileElapsedSince(this.presentationStartTime(), this.now())),
	);

	protected readonly counterLabel = computed<string>(() =>
		mobileSlideCounter(this.currentSlideIndex(), this.slides().length),
	);

	protected readonly atFirst = computed<boolean>(() => isFirstSlide(this.currentSlideIndex()));

	protected readonly atLast = computed<boolean>(() =>
		isLastSlide(this.currentSlideIndex(), this.slides().length),
	);

	/** Next-slide thumbnail box (CSS px); width drives the slide-canvas autoFit. */
	protected readonly thumbStyle = computed(() => {
		const size = this.canvasSize();
		const thumb = mobileNextThumbSize(size.width, size.height);
		return { width: `${thumb.width}px`, height: `${thumb.height}px` };
	});

	// ------------------------------------------------------------------
	// Helpers
	// ------------------------------------------------------------------

	private withTemplate(slide: PptxSlide | undefined): PptxSlide | undefined {
		if (!slide) {
			return undefined;
		}
		const template = this.templateElements();
		if (template.length === 0) {
			return slide;
		}
		return { ...slide, elements: [...template, ...slide.elements] };
	}
}
