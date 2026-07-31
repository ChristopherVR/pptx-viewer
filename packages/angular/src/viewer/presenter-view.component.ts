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

import { presenterPaneAdvancesOnClick } from '../internal/shared';
import type { CanvasSize } from '../internal/shared';
import type { StyleMap } from './element-style';
import { PresenterControlsComponent } from './presenter-controls.component';
import {
	NOTES_FONT_SIZE_DEFAULT,
	NOTES_FONT_SIZE_MAX,
	NOTES_FONT_SIZE_MIN,
	NOTES_FONT_SIZE_STEP,
	clampNotesFontSize,
	computeTimerProgress,
	currentSlideAt,
	elapsedSince,
	formatElapsed,
	formatTime,
	nextSlideAfter,
	resolvePresenterNotes,
	slideCounter,
	slideLabel,
} from './presenter-view-helpers';
import { PresenterWindowService } from './presenter-window.service';
import { SlideCanvasComponent } from './slide-canvas.component';

/** Clock tick interval (ms) for the current-time / elapsed display. */
const CLOCK_TICK_MS = 1000;

/**
 * PresenterViewComponent: split-screen presenter layout with the current
 * slide, a next-slide preview, speaker notes (rich or plain), a live clock +
 * elapsed timer, font-size controls, and navigation controls.
 *
 * Angular port of the React `PresenterView.tsx`. Keyboard navigation is owned
 * by the orchestrator (mirroring React, where `usePresentationKeyboard` handles
 * keys); this component registers no document keydown listener. Slide previews
 * reuse `pptx-slide-canvas` (the master/layout elements are prepended to each
 * slide's own elements, like the React `templateElements` merge).
 *
 * Selector: `pptx-presenter-view`
 *
 * Inputs:
 *   - `slides`                (required): all slides in the deck
 *   - `currentSlideIndex`     (required): zero-based active slide index
 *   - `canvasSize`            (required): logical slide dimensions (px)
 *   - `templateElements`     : master/layout elements behind every slide
 *   - `mediaDataUrls`        : data-URL map for media assets
 *   - `presentationStartTime`: epoch ms when the presentation began (or null)
 *   - `isAudienceWindowOpen` : whether a separate audience window is open
 *
 * Outputs:
 *   - `movePresentationSlide`: emits +1 / -1 to step the active slide
 *   - `exit`                 : emits void to end the presentation
 *   - `openAudienceWindow`   : request opening the audience display window
 *   - `closeAudienceWindow`  : request closing the audience display window
 */
@Component({
	selector: 'pptx-presenter-view',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SlideCanvasComponent, PresenterControlsComponent, TranslatePipe],
	styleUrl: './presenter-view.component.css',
	templateUrl: './presenter-view.component.html',
})
export class PresenterViewComponent {
	protected readonly presenterWindow = inject(PresenterWindowService);
	// Template-exposed constants.
	protected readonly NOTES_FONT_SIZE_MIN = NOTES_FONT_SIZE_MIN;
	protected readonly NOTES_FONT_SIZE_MAX = NOTES_FONT_SIZE_MAX;

	// ------------------------------------------------------------------
	// Inputs
	// ------------------------------------------------------------------

	readonly slides = input.required<PptxSlide[]>();
	readonly currentSlideIndex = input.required<number>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly templateElements = input<readonly PptxElement[]>([]);
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly presentationStartTime = input<number | null>(null);
	readonly isAudienceWindowOpen = input<boolean>(false);

	// ------------------------------------------------------------------
	// Outputs
	// ------------------------------------------------------------------

	readonly movePresentationSlide = output<1 | -1>();
	readonly exit = output<void>();
	readonly openAudienceWindow = output<void>();
	readonly closeAudienceWindow = output<void>();
	readonly navigateToSlide = output<number>();

	// ------------------------------------------------------------------
	// Internal state
	// ------------------------------------------------------------------

	/** Live wall-clock (epoch ms), advanced once per second. */
	private readonly now = signal(Date.now());

	/** Speaker-notes font size (px), clamped to the allowed range. */
	protected readonly notesFontSize = signal(NOTES_FONT_SIZE_DEFAULT);

	constructor() {
		// 1 Hz tick for the clock + elapsed timer + progress bar.
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

	/** Current slide with master/layout elements prepended for preview. */
	protected readonly currentPreviewSlide = computed<PptxSlide | undefined>(() =>
		this.withTemplate(this.currentSlide()),
	);

	/** Next slide with master/layout elements prepended for preview. */
	protected readonly nextPreviewSlide = computed<PptxSlide | undefined>(() =>
		this.withTemplate(this.nextSlide()),
	);

	protected readonly notes = computed(() => resolvePresenterNotes(this.currentSlide()));

	protected readonly clockLabel = computed<string>(() => formatTime(new Date(this.now())));

	protected readonly elapsedMs = computed<number>(() =>
		elapsedSince(this.presentationStartTime(), this.now()),
	);

	protected readonly elapsedLabel = computed<string>(() => formatElapsed(this.elapsedMs()));

	private readonly timerProgress = computed(() => computeTimerProgress(this.elapsedMs()));

	protected readonly timerPercent = computed<number>(() => this.timerProgress().percent);

	protected readonly progressValue = computed<number>(() =>
		Math.round(this.timerProgress().percent),
	);

	protected readonly slideBadge = computed<string>(() =>
		slideLabel(this.currentSlideIndex(), this.slides().length),
	);

	/**
	 * Clicking the current-slide pane advances the show, the way PowerPoint's
	 * presenter console does: it is how presenters actually drive a deck, with
	 * the Next button and the keyboard as fallbacks. A drawing tool owns the
	 * pointer instead, so clicking then annotates rather than jumping the deck
	 * out from under the stroke.
	 */
	protected readonly paneAdvancesOnClick = computed<boolean>(() =>
		presenterPaneAdvancesOnClick(this.presenterWindow.snapshot().pointer?.tool),
	);

	protected onSlidePaneClick(): void {
		if (this.paneAdvancesOnClick()) {
			this.movePresentationSlide.emit(1);
		}
	}

	protected readonly counterLabel = computed<string>(() =>
		slideCounter(this.currentSlideIndex(), this.slides().length),
	);

	protected readonly notesBodyStyle = computed<StyleMap>(() => ({
		'font-size': `${this.notesFontSize()}px`,
	}));

	// ------------------------------------------------------------------
	// Actions
	// ------------------------------------------------------------------

	protected increaseNotesFontSize(): void {
		this.notesFontSize.set(clampNotesFontSize(this.notesFontSize() + NOTES_FONT_SIZE_STEP));
	}

	protected decreaseNotesFontSize(): void {
		this.notesFontSize.set(clampNotesFontSize(this.notesFontSize() - NOTES_FONT_SIZE_STEP));
	}

	protected onToggleAudienceWindow(): void {
		if (this.isAudienceWindowOpen()) {
			this.closeAudienceWindow.emit();
		} else {
			this.openAudienceWindow.emit();
		}
	}

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
