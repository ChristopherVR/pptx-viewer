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
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { AuthoredSlideRange, CanvasSize, ShowOrderCustomShow } from '../internal/shared';
import {
	formatMobileElapsed,
	mobileElapsedSince,
	mobileNextThumbSize,
	mobileSlideCounter,
	presenterNextDisabled,
	presenterPrevDisabled,
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
	imports: [NgStyle, SlideCanvasComponent, TranslatePipe],
	styleUrl: './mobile-presenter-view.component.css',
	templateUrl: './mobile-presenter-view.component.html',
})
export class MobilePresenterViewComponent {
	// ------------------------------------------------------------------
	// Inputs
	// ------------------------------------------------------------------

	readonly slides = input.required<PptxSlide[]>();
	readonly currentSlideIndex = input.required<number>();
	/**
	 * The running custom show, or null for the whole deck. The "next slide"
	 * preview MUST honour it: while a show is playing, the slide the next
	 * forward press lands on is the show's next member, not `index + 1`.
	 */
	readonly activeCustomShow = input<ShowOrderCustomShow | null>(null);
	/**
	 * The deck's authored `p:showPr/p:sldRg` slide-range restriction, or null
	 * for the whole deck. The next-slide preview must honour it the same way it
	 * honours {@link activeCustomShow}.
	 */
	readonly authoredRange = input<AuthoredSlideRange | null>(null);
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
		nextSlideAfter(
			this.slides(),
			this.currentSlideIndex(),
			this.activeCustomShow(),
			this.authoredRange(),
		),
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

	// The desktop console's rules, not a phone-sized copy of them: Next stays live
	// on the last slide so the presenter can reach the end-of-show screen and
	// finish, exactly as the split-screen console does.
	protected readonly prevDisabled = computed<boolean>(() =>
		presenterPrevDisabled(this.currentSlideIndex()),
	);

	protected readonly nextDisabled = computed<boolean>(() => presenterNextDisabled());

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
