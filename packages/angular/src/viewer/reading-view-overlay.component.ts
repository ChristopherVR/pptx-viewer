/**
 * reading-view-overlay.component.ts: PowerPoint's Reading View, Angular binding.
 *
 * Deliberately NOT built on {@link PresentationOverlayComponent}. Reading View
 * is the deck at full WINDOW size with the editor chrome cut back to a nav bar:
 * reusing the slide-show overlay would drag the Fullscreen API, the pointer
 * tools, blackout and the presenter console in with it, which is exactly the
 * weight a reader asked to escape. `position: fixed; inset: 0` fills the browser
 * window without requesting fullscreen, matching PowerPoint and the sibling
 * {@link SlideSorterOverlayComponent}.
 *
 * Every navigation rule (what Page Down does, when advancing past the last
 * slide closes the view, whether Previous is live) comes from
 * `render/reading-view` in `pptx-viewer-shared`, so the five bindings cannot
 * drift apart. Nothing in this file decides which slide comes next.
 *
 * Reference binding: packages/react/src/viewer/components/ReadingViewOverlay.tsx
 */
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	OnDestroy,
	OnInit,
	computed,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import {
	CLOSED_READING_VIEW,
	applyReadingViewCommand,
	canGoNext,
	canGoPrevious,
	createPresentationKeyBuffer,
	formatSlideCounter,
	handleReadingViewKey,
	openReadingView,
	readingViewFitScale,
} from '../internal/shared';
import type { CanvasSize, ReadingViewCommand, ReadingViewState } from '../internal/shared';
import { READING_VIEW_OVERLAY_STYLES } from './reading-view-overlay.styles';
import { SlideCanvasComponent } from './slide-canvas.component';

/** Breathing room between the slide and the window edge, in CSS pixels. */
const READING_VIEW_PADDING = 24;

@Component({
	selector: 'pptx-reading-view-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [SlideCanvasComponent, TranslatePipe, LucideChevronLeft, LucideChevronRight, LucideX],
	styles: READING_VIEW_OVERLAY_STYLES,
	template: `
		@if (visibleSlide(); as slide) {
			<div
				class="pptx-ng-reading-root"
				data-pptx-reading-view="true"
				role="region"
				[attr.aria-label]="'pptx.view.readingView' | translate"
			>
				<div #viewport class="pptx-ng-reading-viewport">
					@if (scale() > 0) {
						<div
							class="pptx-ng-reading-stage"
							data-pptx-reading-view-stage="true"
							aria-roledescription="slide"
							[style.width.px]="stageWidth()"
							[style.height.px]="stageHeight()"
						>
							<pptx-slide-canvas
								[slide]="slide"
								[canvasSize]="canvasSize()"
								[mediaDataUrls]="mediaDataUrls()"
								[zoom]="scale()"
								[autoFit]="false"
								[interactive]="false"
							/>
						</div>
					}
				</div>
				<div class="pptx-ng-reading-nav">
					<button
						type="button"
						class="pptx-ng-reading-btn"
						[attr.aria-label]="'pptx.common.previous' | translate"
						[title]="'pptx.common.previous' | translate"
						[disabled]="!canPrevious()"
						(click)="run({ command: 'previous' })"
					>
						<svg lucideChevronLeft class="h-4 w-4"></svg>
					</button>
					<span class="pptx-ng-reading-counter" data-pptx-reading-view-counter="true">{{
						counter()
					}}</span>
					<button
						type="button"
						class="pptx-ng-reading-btn"
						[attr.aria-label]="'pptx.common.next' | translate"
						[title]="'pptx.common.next' | translate"
						[disabled]="!canNext()"
						(click)="run({ command: 'next' })"
					>
						<svg lucideChevronRight class="h-4 w-4"></svg>
					</button>
					<button
						type="button"
						class="pptx-ng-reading-btn"
						[attr.aria-label]="'pptx.statusBar.normalView' | translate"
						[title]="'pptx.statusBar.normalView' | translate"
						(click)="run({ command: 'exit' })"
					>
						<svg lucideX class="h-4 w-4"></svg>
					</button>
				</div>
			</div>
		}
	`,
})
export class ReadingViewOverlayComponent implements OnInit, AfterViewInit, OnDestroy {
	/**
	 * The deck to read, template (master/layout) elements already merged in. The
	 * host passes its merged display deck rather than a separate template layer:
	 * the reader navigates inside this overlay, so a single "active slide's
	 * template elements" array would paint slide 1's master over slide 2.
	 */
	readonly slides = input<readonly PptxSlide[]>([]);
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	/** Slide the editor was on when Reading View was entered. */
	readonly activeSlideIndex = input<number>(0);

	/** Emits the slide the reader ended on, so the editor lands there. */
	readonly exit = output<number>();

	/** Whether the view is on screen and which slide it shows (shared state). */
	protected readonly state = signal<ReadingViewState>(CLOSED_READING_VIEW);

	private readonly viewportRef = viewChild<ElementRef<HTMLElement>>('viewport');
	/** Measured size of the area the slide is fitted into, in CSS pixels. */
	private readonly viewport = signal<{ width: number; height: number }>({ width: 0, height: 0 });

	/**
	 * PowerPoint's "type a slide number, then Enter" jump. One buffer per open
	 * session, and every key mapped through it EXACTLY once: mapping mutates the
	 * buffer, so a second call would swallow the digit it just accumulated.
	 */
	private readonly keyBuffer = createPresentationKeyBuffer();

	/** Bound once so the capture-phase listener can be removed again. */
	private readonly keyListener = (event: KeyboardEvent): void => this.onKeyDown(event);
	private resizeObserver: ResizeObserver | null = null;

	ngOnInit(): void {
		// Inputs are only bound by now, so the opening slide cannot be read in a
		// field initializer. Clamping lives in the shared opener.
		this.state.set(openReadingView(this.activeSlideIndex(), this.slides().length));
		// Capture phase on `window`, which is why this cannot be a @HostListener
		// (those can only register in the bubble phase). The editor is still mounted
		// and still listening underneath this overlay, and until the reader's keys
		// were swallowed first an arrow key both turned the page AND nudged the
		// selected shape behind it, so merely reading a deck edited it.
		window.addEventListener('keydown', this.keyListener, true);
	}

	ngAfterViewInit(): void {
		const element = this.viewportRef()?.nativeElement;
		if (!element || typeof ResizeObserver === 'undefined') {
			return;
		}
		this.resizeObserver = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect) {
				this.viewport.set({ width: rect.width, height: rect.height });
			}
		});
		this.resizeObserver.observe(element);
	}

	ngOnDestroy(): void {
		window.removeEventListener('keydown', this.keyListener, true);
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
	}

	/** The slide on screen, or undefined when closed or the deck is empty. */
	protected readonly visibleSlide = computed<PptxSlide | undefined>(() => {
		const state = this.state();
		return state.open ? this.slides()[state.slideIndex] : undefined;
	});

	/** Fit scale for the slide; 0 before the first layout pass. */
	protected readonly scale = computed(() =>
		readingViewFitScale(this.canvasSize(), this.viewport(), READING_VIEW_PADDING),
	);

	protected readonly stageWidth = computed(() => this.canvasSize().width * this.scale());
	protected readonly stageHeight = computed(() => this.canvasSize().height * this.scale());

	protected readonly counter = computed(() =>
		formatSlideCounter(this.state().slideIndex, this.slides().length),
	);

	protected readonly canPrevious = computed(() => canGoPrevious(this.state()));
	protected readonly canNext = computed(() => canGoNext(this.state(), this.slides().length));

	/** Apply a navigation intent, handing the reader back to the editor on close. */
	protected run(command: ReadingViewCommand): void {
		const previous = this.state();
		const next = applyReadingViewCommand(previous, command, this.slides().length);
		this.state.set(next);
		if (previous.open && !next.open) {
			// Leaving a PowerPoint view returns the editor to the slide that was on
			// screen, not the one it was on before.
			this.exit.emit(previous.slideIndex);
		}
	}

	/**
	 * Window-level so no element has to hold focus, matching the slide show.
	 * Writing {@link state} marks this `OnPush` view dirty and notifies Angular's
	 * change-detection scheduler, so no manual `markForCheck` is needed even
	 * though the listener is not a host binding.
	 */
	protected onKeyDown(event: KeyboardEvent): void {
		if (!this.state().open) {
			return;
		}
		// Handled exactly once: the call mutates `keyBuffer` to accumulate a typed
		// slide number, so handling twice would swallow every digit.
		const { command, swallow, preventDefault } = handleReadingViewKey(event, this.keyBuffer);
		if (swallow) {
			event.stopPropagation();
		}
		if (preventDefault) {
			// Space and the arrows would otherwise scroll the editor underneath.
			event.preventDefault();
		}
		if (command.command !== 'none') {
			this.run(command);
		}
	}
}
