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
import type { StyleMap } from './element-style';
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
import { SlideCanvasComponent } from './slide-canvas.component';

/** Clock tick interval (ms) for the current-time / elapsed display. */
const CLOCK_TICK_MS = 1000;

/**
 * PresenterViewComponent — split-screen presenter layout with the current
 * slide, a next-slide preview, speaker notes (rich or plain), a live clock +
 * elapsed timer, font-size controls, and navigation controls.
 *
 * Angular port of the React `PresenterView.tsx`. Keyboard navigation is owned
 * by the orchestrator (mirroring React, where `usePresentationKeyboard` handles
 * keys) — this component registers no document keydown listener. Slide previews
 * reuse `pptx-slide-canvas` (the master/layout elements are prepended to each
 * slide's own elements, like the React `templateElements` merge).
 *
 * Selector: `pptx-presenter-view`
 *
 * Inputs:
 *   - `slides`                (required) — all slides in the deck
 *   - `currentSlideIndex`     (required) — zero-based active slide index
 *   - `canvasSize`            (required) — logical slide dimensions (px)
 *   - `templateElements`      — master/layout elements behind every slide
 *   - `mediaDataUrls`         — data-URL map for media assets
 *   - `presentationStartTime` — epoch ms when the presentation began (or null)
 *   - `isAudienceWindowOpen`  — whether a separate audience window is open
 *
 * Outputs:
 *   - `movePresentationSlide` — emits +1 / -1 to step the active slide
 *   - `exit`                  — emits void to end the presentation
 *   - `openAudienceWindow`    — request opening the audience display window
 *   - `closeAudienceWindow`   — request closing the audience display window
 */
@Component({
	selector: 'pptx-presenter-view',
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
		}

		.pptx-ng-presenter-body {
			display: flex;
			flex: 1 1 auto;
			min-height: 0;
		}

		.pptx-ng-presenter-current {
			flex: 7 1 0;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			background: #000;
			padding: 1rem;
			min-width: 0;
		}

		.pptx-ng-presenter-preview-stage {
			width: 100%;
			max-width: 100%;
			min-height: 0;
		}

		.pptx-ng-presenter-slide-badge {
			margin-top: 0.5rem;
			font-family: ui-monospace, monospace;
			font-variant-numeric: tabular-nums;
			font-size: 0.75rem;
			color: rgba(255, 255, 255, 0.5);
			user-select: none;
		}

		.pptx-ng-presenter-side {
			flex: 3 1 0;
			display: flex;
			flex-direction: column;
			background: #18181b;
			border-left: 1px solid rgba(255, 255, 255, 0.12);
			min-width: 260px;
			max-width: 440px;
		}

		.pptx-ng-presenter-header,
		.pptx-ng-presenter-nav,
		.pptx-ng-presenter-next {
			padding: 0.5rem 1rem;
			border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		}

		.pptx-ng-presenter-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
		}

		.pptx-ng-presenter-label {
			font-size: 0.625rem;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: rgba(255, 255, 255, 0.55);
		}

		.pptx-ng-presenter-clock {
			font-family: ui-monospace, monospace;
			font-variant-numeric: tabular-nums;
			font-size: 1.125rem;
		}

		.pptx-ng-presenter-elapsed {
			color: #6ea8fe;
		}

		.pptx-ng-presenter-iconbtn {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 32px;
			height: 32px;
			border: none;
			border-radius: 6px;
			background: transparent;
			color: rgba(255, 255, 255, 0.7);
			cursor: pointer;
			font-size: 1rem;
			line-height: 1;
		}

		.pptx-ng-presenter-iconbtn:hover {
			background: rgba(255, 255, 255, 0.1);
			color: #fff;
		}

		.pptx-ng-presenter-iconbtn:disabled {
			opacity: 0.3;
			cursor: not-allowed;
		}

		.pptx-ng-presenter-nav {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		.pptx-ng-presenter-navbtn {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.375rem 0.75rem;
			border: none;
			border-radius: 6px;
			background: rgba(255, 255, 255, 0.08);
			color: #f5f5f5;
			cursor: pointer;
			font-size: 0.75rem;
		}

		.pptx-ng-presenter-navbtn:hover:not(:disabled) {
			background: rgba(255, 255, 255, 0.16);
		}

		.pptx-ng-presenter-navbtn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.pptx-ng-presenter-counter {
			font-family: ui-monospace, monospace;
			font-variant-numeric: tabular-nums;
			font-size: 0.875rem;
		}

		.pptx-ng-presenter-next-empty {
			display: flex;
			align-items: center;
			justify-content: center;
			height: 4rem;
			border: 1px solid rgba(255, 255, 255, 0.15);
			border-radius: 6px;
			background: rgba(255, 255, 255, 0.04);
			font-size: 0.75rem;
			font-style: italic;
			color: rgba(255, 255, 255, 0.5);
		}

		.pptx-ng-presenter-notes {
			flex: 1 1 auto;
			display: flex;
			flex-direction: column;
			min-height: 0;
			padding: 0.75rem 1rem;
		}

		.pptx-ng-presenter-notes-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 0.5rem;
		}

		.pptx-ng-presenter-notes-size {
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}

		.pptx-ng-presenter-notes-size-value {
			min-width: 28px;
			text-align: center;
			font-family: ui-monospace, monospace;
			font-variant-numeric: tabular-nums;
			font-size: 0.625rem;
			color: rgba(255, 255, 255, 0.55);
			user-select: none;
		}

		.pptx-ng-presenter-notes-body {
			flex: 1 1 auto;
			overflow-y: auto;
			border: 1px solid rgba(255, 255, 255, 0.15);
			border-radius: 6px;
			background: rgba(255, 255, 255, 0.04);
			padding: 0.5rem 0.75rem;
			white-space: pre-wrap;
			line-height: 1.5;
		}

		.pptx-ng-presenter-notes-empty {
			font-style: italic;
			color: rgba(255, 255, 255, 0.5);
		}

		.pptx-ng-presenter-progress {
			height: 6px;
			width: 100%;
			background: rgba(255, 255, 255, 0.12);
			flex: 0 0 auto;
		}

		.pptx-ng-presenter-progress-fill {
			height: 100%;
			background: #6ea8fe;
			transition: width 1s linear;
		}

		.pptx-ng-presenter-empty {
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
			<div class="pptx-ng-presenter-body">
				<!-- Current slide (≈70%) -->
				<div class="pptx-ng-presenter-current">
					<div class="pptx-ng-presenter-preview-stage">
						<pptx-slide-canvas
							[slide]="currentPreviewSlide()"
							[canvasSize]="canvasSize()"
							[mediaDataUrls]="mediaDataUrls()"
							[zoom]="1"
							[interactive]="false"
						/>
					</div>
					<div class="pptx-ng-presenter-slide-badge">{{ slideBadge() }}</div>
				</div>

				<!-- Controls (≈30%) -->
				<div class="pptx-ng-presenter-side">
					<!-- Header: clock + elapsed + window/exit -->
					<div class="pptx-ng-presenter-header">
						<div>
							<div class="pptx-ng-presenter-label">Current time</div>
							<div class="pptx-ng-presenter-clock">{{ clockLabel() }}</div>
						</div>
						<div>
							<div class="pptx-ng-presenter-label">Elapsed</div>
							<div class="pptx-ng-presenter-clock pptx-ng-presenter-elapsed">
								{{ elapsedLabel() }}
							</div>
						</div>
						<div style="display:flex;align-items:center;gap:0.25rem;">
							<button
								type="button"
								class="pptx-ng-presenter-iconbtn"
								(click)="onToggleAudienceWindow()"
								[attr.aria-label]="
									isAudienceWindowOpen() ? 'Close audience window' : 'Open audience window'
								"
								[title]="isAudienceWindowOpen() ? 'Close audience window' : 'Open audience window'"
							>
								{{ isAudienceWindowOpen() ? '▣' : '□' }}
							</button>
							<button
								type="button"
								class="pptx-ng-presenter-iconbtn"
								(click)="exit.emit()"
								aria-label="End presentation"
								title="End presentation"
							>
								&#x2715;
							</button>
						</div>
					</div>

					<!-- Navigation -->
					<div class="pptx-ng-presenter-nav">
						<button
							type="button"
							class="pptx-ng-presenter-navbtn"
							(click)="movePresentationSlide.emit(-1)"
							[disabled]="currentSlideIndex() === 0"
							title="Previous slide"
						>
							&#x2039; Prev
						</button>
						<span class="pptx-ng-presenter-counter">{{ counterLabel() }}</span>
						<button
							type="button"
							class="pptx-ng-presenter-navbtn"
							(click)="movePresentationSlide.emit(1)"
							[disabled]="currentSlideIndex() >= slides().length - 1"
							title="Next slide"
						>
							Next &#x203A;
						</button>
					</div>

					<!-- Next slide preview -->
					<div class="pptx-ng-presenter-next">
						<div class="pptx-ng-presenter-label" style="margin-bottom:0.5rem;">Next slide</div>
						@if (nextPreviewSlide(); as next) {
							<pptx-slide-canvas
								[slide]="next"
								[canvasSize]="canvasSize()"
								[mediaDataUrls]="mediaDataUrls()"
								[zoom]="1"
								[interactive]="false"
							/>
						} @else {
							<div class="pptx-ng-presenter-next-empty">End of presentation</div>
						}
					</div>

					<!-- Speaker notes -->
					<div class="pptx-ng-presenter-notes">
						<div class="pptx-ng-presenter-notes-head">
							<div class="pptx-ng-presenter-label">Speaker notes</div>
							<div class="pptx-ng-presenter-notes-size">
								<button
									type="button"
									class="pptx-ng-presenter-iconbtn"
									(click)="decreaseNotesFontSize()"
									[disabled]="notesFontSize() <= NOTES_FONT_SIZE_MIN"
									aria-label="Decrease font size"
									title="Decrease font size"
								>
									&#x2212;
								</button>
								<span class="pptx-ng-presenter-notes-size-value">{{ notesFontSize() }}px</span>
								<button
									type="button"
									class="pptx-ng-presenter-iconbtn"
									(click)="increaseNotesFontSize()"
									[disabled]="notesFontSize() >= NOTES_FONT_SIZE_MAX"
									aria-label="Increase font size"
									title="Increase font size"
								>
									&#x2b;
								</button>
							</div>
						</div>
						<div class="pptx-ng-presenter-notes-body" [ngStyle]="notesBodyStyle()">
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
								<span class="pptx-ng-presenter-notes-empty">No notes for this slide.</span>
							}
						</div>
					</div>
				</div>
			</div>

			<!-- Timer progress bar -->
			<div
				class="pptx-ng-presenter-progress"
				role="progressbar"
				[attr.aria-valuenow]="progressValue()"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-label="Presentation timer"
			>
				<div class="pptx-ng-presenter-progress-fill" [style.width.%]="timerPercent()"></div>
			</div>
		} @else {
			<div class="pptx-ng-presenter-empty">No slides to present.</div>
		}
	`,
})
export class PresenterViewComponent {
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
