import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	HostListener,
	OnInit,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import {
	LucideChevronLeft,
	LucideChevronRight,
	LucideEraser,
	LucideHighlighter,
	LucideMousePointer2,
	LucidePenTool,
	LucideTrash2,
	LucideX,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import { mayLeaveSlideShow } from '../internal/shared';
import { AnimationPlaybackService } from './animation-playback.service';
import { PresentationAnnotationOverlayComponent } from './presentation-annotation-overlay.component';
import { PresentationAnnotationsService } from './presentation-annotations.service';
import type { SlideAnnotationMap } from './presentation-annotations.service';
import { hasExitedFullscreen } from './presentation-fullscreen';
import { PresentationInputController } from './presentation-input-controller';
import {
	createSlideKeyframesStyle,
	ensurePresetAnimationKeyframes,
} from './presentation-keyframes';
import type { SlideKeyframesStyle } from './presentation-keyframes';
import {
	OVERLAY_CLOSE_BUTTON_STYLE,
	OVERLAY_COUNTER_STYLE,
	OVERLAY_NEXT_BUTTON_STYLE,
	OVERLAY_PREV_BUTTON_STYLE,
} from './presentation-overlay-chrome-styles';
import { clampIndex, fitZoom, resolveSlideAutoAdvanceMs } from './presentation-overlay-helpers';
import {
	setupPresentationFullscreen,
	setupPresentationTouchGestures,
} from './presentation-overlay-shell';
import { PresentationShowNavigator } from './presentation-show-navigator';
import { PresentationStageAnimator } from './presentation-stage-animator';
import { PresentationSubtitleBarComponent } from './presentation-subtitle-bar.component';
import { PresentationTransitionOverlayComponent } from './presentation-transition-overlay.component';
import { PresenterWindowService } from './presenter-window.service';
import { SlideCanvasComponent } from './slide-canvas.component';
import { ZoomNavigationService } from './zoom-navigation.service';

/**
 * PresentationOverlayComponent: full-viewport black overlay that renders
 * slides in presentation (kiosk) mode.
 *
 * Selector: `pptx-presentation-overlay`
 *
 * This class is the VIEW and the wiring; the show's behaviour lives in four
 * siblings, each documented at its own definition (the per-input/output notes
 * below used to be repeated up here and had drifted, so they are not repeated
 * again):
 *
 *   - `presentation-show-navigator.ts`   which slide is up, and why
 *   - `presentation-input-controller.ts` keyboard + pointer rules
 *   - `presentation-stage-animator.ts`   element animation applied to the DOM
 *   - `presentation-overlay-shell.ts`    touch gestures + real Fullscreen API
 *
 * Beyond the CSS-fixed full-viewport overlay, a `fullscreenchange` listener
 * syncs back to `closed` when fullscreen is exited from OUTSIDE this
 * component's own close/Escape handling (browser UI, the Android back gesture),
 * which would otherwise leave the host stuck believing it is still presenting.
 */
@Component({
	selector: 'pptx-presentation-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NgStyle,
		SlideCanvasComponent,
		PresentationTransitionOverlayComponent,
		PresentationAnnotationOverlayComponent,
		PresentationSubtitleBarComponent,
		TranslatePipe,
		LucidePenTool,
		LucideHighlighter,
		LucideEraser,
		LucideMousePointer2,
		LucideTrash2,
		LucideX,
		LucideChevronLeft,
		LucideChevronRight,
	],
	providers: [AnimationPlaybackService, PresentationAnnotationsService, ZoomNavigationService],
	styleUrl: './presentation-overlay.component.css',
	templateUrl: './presentation-overlay.component.html',
})
export class PresentationOverlayComponent implements OnInit {
	protected readonly presenterWindow = inject(PresenterWindowService);
	// ------------------------------------------------------------------
	// Inputs
	// ------------------------------------------------------------------

	readonly slides = input.required<PptxSlide[]>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly startIndex = input<number>(0);
	readonly showWithAnimation = input<boolean | undefined>(undefined);
	/**
	 * Whether authored slide timings (`p:transition/@advTm`) advance the show on
	 * their own. False is PowerPoint's "Advance slides: Manually"
	 * (`PptxPresentationProperties.advanceMode === 'manual'`); the default keeps
	 * timings, matching "Using timings, if present".
	 */
	readonly useTimings = input<boolean>(true);
	readonly subtitlesVisible = input<boolean>(false);
	/**
	 * Set by an audience display when the presenter ends the session and the
	 * browser refuses to close the tab. It raises the black end-of-slide-show
	 * screen so the room never sees the editing chrome.
	 */
	readonly sessionEnded = input<boolean>(false);
	/**
	 * File > Options > Advanced > "End with black slide". PowerPoint's default is
	 * ON: advancing past the last slide raises the black "End of slide show"
	 * screen and only the NEXT forward input ends the show. Off ends the show at
	 * once instead of sitting on the last slide swallowing every advance.
	 */
	readonly endWithBlackSlide = input<boolean>(true);

	// ------------------------------------------------------------------
	// Outputs
	// ------------------------------------------------------------------

	readonly indexChange = output<number>();
	readonly closed = output<void>();
	readonly subtitlesChange = output<boolean>();
	/**
	 * Fired just before `closed` when the show carries ink annotations, so the
	 * host can offer the keep/discard prompt (mirrors React's exit flow).
	 */
	readonly annotationsExit = output<SlideAnnotationMap>();

	// ------------------------------------------------------------------
	// Internal state
	// ------------------------------------------------------------------

	/** PowerPoint's Ctrl+M: hide ink markup without discarding the strokes. */
	protected readonly inkMarkupVisible = signal(true);

	/** Click-stepped element-animation playback for the current slide. */
	protected readonly playback = inject(AnimationPlaybackService);

	/** Ink-annotation state (pen/highlighter/eraser/laser) for the show. */
	protected readonly annotations = inject(PresentationAnnotationsService);

	/**
	 * The show's navigation state machine (index, end-of-show screen, slide
	 * transition, timed auto-advance). See `presentation-show-navigator.ts`.
	 */
	protected readonly navigator: PresentationShowNavigator = new PresentationShowNavigator({
		slides: () => this.slides(),
		currentSlide: () => this.currentSlide(),
		showWithAnimation: () => this.showWithAnimation(),
		playback: this.playback,
		annotations: this.annotations,
		emitIndex: (index) => this.indexChange.emit(index),
		requestClose: () => this.emitClosed(),
		endWithBlackSlide: () => this.endWithBlackSlide(),
	});

	/**
	 * Keyboard / pointer rules for the running show. See
	 * `presentation-input-controller.ts`.
	 */
	protected readonly input: PresentationInputController = new PresentationInputController({
		slides: () => this.slides(),
		currentSlide: () => this.currentSlide(),
		root: () => this.rootRef()?.nativeElement,
		navigator: this.navigator,
		playback: this.playback,
		annotations: this.annotations,
		presenterWindow: this.presenterWindow,
		toggleInkMarkup: () => this.inkMarkupVisible.update((visible) => !visible),
		requestClose: () => this.emitClosed(),
	});

	/** Template aliases for the navigator's state. */
	protected readonly currentIndex = this.navigator.currentIndex;
	protected readonly endOfShow = this.navigator.endOfShow;
	protected readonly activeTransition = this.navigator.activeTransition;

	/** Mirror the host's audience "session ended" flag onto the end screen. */
	private readonly syncSessionEnded = effect(() => {
		if (this.sessionEnded()) {
			this.endOfShow.set(true);
		}
	});

	/** Adopt an index the host pushed in (an audience display mirrors one). */
	private readonly syncExternalIndex = effect(() => {
		this.navigator.syncFromHost(this.startIndex());
	});

	/**
	 * Zoom-navigation context (provided at this component level). The handler is
	 * registered in the constructor so a descendant zoom tile can jump to its
	 * target slide on click. Descendants resolve this same instance.
	 */
	private readonly zoomNavigation = inject(ZoomNavigationService);

	/** The slide stage root; animation styles are applied to its elements. */
	private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stage');

	/**
	 * Applies the playback service's per-element animation state to the rendered
	 * stage, and owns the hover-trigger state machine (see
	 * `presentation-stage-animator.ts`).
	 */
	private readonly stageAnimator = new PresentationStageAnimator(
		() => this.stageRef()?.nativeElement,
		this.playback,
	);

	/**
	 * The overlay root; the shared touch-gesture recogniser attaches here, and
	 * it is the element the real Fullscreen API is requested on (see
	 * {@link setupFullscreen}).
	 */
	private readonly rootRef = viewChild<ElementRef<HTMLElement>>('root');

	/**
	 * Guards against handling the same exit twice: e.g. Escape both reaches our
	 * own `keydown` handler AND causes the browser to natively exit fullscreen
	 * (firing `fullscreenchange`), or the close button's `click` and `touchend`
	 * both fire for one tap.
	 */
	private closing = false;

	/**
	 * Managed per-slide keyframes `<style>` element (colour animations + staged
	 * text builds). The static preset keyframe library is injected once per
	 * document by {@link ensurePresetAnimationKeyframes}.
	 */
	private readonly slideKeyframes: SlideKeyframesStyle = createSlideKeyframesStyle();

	constructor() {
		setupPresentationTouchGestures(() => this.rootRef()?.nativeElement, {
			onSwipeForward: () => this.input.advanceFromClick(),
			onSwipeBackward: () => this.navigator.navigate('prev'),
		});
		setupPresentationFullscreen(() => this.rootRef()?.nativeElement);

		ensurePresetAnimationKeyframes();
		inject(DestroyRef).onDestroy(() => {
			this.slideKeyframes.dispose();
			this.navigator.clearAutoAdvance();
		});

		// PowerPoint's "Advance slide: After <n>" timing (`p:transition/@advTm`).
		// Re-armed on every slide change; the previous slide's pending timer is
		// always cancelled first so a manual advance can never leave a stale timer
		// running that skips the slide the presenter just moved to.
		//
		// Without this the show is not merely missing an auto-advance: a slide
		// authored `advClick="0" advTm="…"` (PowerPoint's "on click OFF, after N")
		// is advanced ONLY by this timer, and `shouldBlockClickAdvance` correctly
		// swallows every click on it. The show then sits on that slide for ever
		// with no visible response to input, which reads as "presentation mode
		// does nothing at all".
		effect(() => {
			this.navigator.armAutoAdvance(
				resolveSlideAutoAdvanceMs(this.currentSlide(), this.useTimings(), this.endOfShow()),
			);
		});

		// Scope media-command (`p:cmd`) target lookups to the slide stage.
		this.playback.setFrameRoot(() => this.stageRef()?.nativeElement ?? null);

		// Wire the zoom-navigation context to this overlay's slide navigation so a
		// descendant zoom tile can jump to its target slide on click.
		this.zoomNavigation.setHandler((index) => this.navigator.goToSlide(index));

		// Rebuild the native-animation controller for the current slide (seeds the
		// pre-build state so entrance-animated elements start hidden) and publish its
		// per-slide keyframes CSS.
		effect(() => {
			const completed = this.navigator.takePendingCompletedEntry();
			this.playback.setSlide(this.currentSlide(), this.showWithAnimation(), { completed });
			this.slideKeyframes.set(this.playback.keyframesCss());
		});

		// Apply each element's native-animation state (visibility, CSS animation,
		// interactive/hover cursor) to its rendered node whenever the state map or
		// the slide changes. Deferred to an animation frame so the new slide's
		// `[data-element-id]` nodes are in the DOM first. Structural reveals (chart /
		// SmartArt build, fill / stroke inherit) are applied declaratively by the
		// renderers themselves via the injected AnimationPlaybackService.
		effect(() => {
			// Register reactive dependencies.
			this.playback.presentationElementStates();
			this.playback.interactiveTriggerShapeIds();
			this.playback.hoverTriggerShapeIds();
			this.currentSlide();
			if (typeof requestAnimationFrame === 'function') {
				requestAnimationFrame(() => this.stageAnimator.applyAnimationStyles());
			} else {
				this.stageAnimator.applyAnimationStyles();
			}
		});
	}

	/**
	 * Stage-hover forwarding. The animator owns the "which shape is hovered"
	 * state machine; the template only needs the two DOM events.
	 */
	protected onStageHover(event: MouseEvent): void {
		this.stageAnimator.handleHover(event);
	}

	protected onStageHoverEnd(event: MouseEvent): void {
		this.stageAnimator.handleHoverEnd(event);
	}

	/** Viewport dimensions, updated on resize. */
	private readonly viewportW = signal(0);
	private readonly viewportH = signal(0);

	// ------------------------------------------------------------------
	// Derived signals
	// ------------------------------------------------------------------

	protected readonly currentSlide = computed<PptxSlide | undefined>(
		() => this.slides()[this.currentIndex()],
	);

	/** Zoom level that fits the canvas into the current viewport. */
	protected readonly zoom = computed<number>(() => {
		const size = this.canvasSize();
		return fitZoom(size.width, size.height, this.viewportW(), this.viewportH());
	});

	/** Centre the scaled slide in the viewport. */
	protected readonly stageContainerStyle = computed<Record<string, string>>(() => {
		const size = this.canvasSize();
		const z = this.zoom();
		return {
			position: 'absolute',
			top: '50%',
			left: '50%',
			width: `${size.width * z}px`,
			height: `${size.height * z}px`,
			transform: 'translate(-50%, -50%)',
			// Motion-path keyframes translate by a fraction of the SLIDE (see
			// `slideOffset` in the shared timeline helpers), so the presentation
			// stage publishes the slide size the same way the editing stage does.
			// Without it every parsed path falls back to the 1280x720 default and a
			// deck authored at another size under-travels.
			'--pptx-slide-w': `${size.width}px`,
			'--pptx-slide-h': `${size.height}px`,
		};
	});

	/** "3 / 12" label. */
	protected readonly counterLabel = computed<string>(() => {
		const count = this.slides().length;
		return count === 0 ? '0 / 0' : `${this.currentIndex() + 1} / ${count}`;
	});

	// ------------------------------------------------------------------
	// Static control styles (no dynamic data, see
	// `presentation-overlay-chrome-styles.ts`)
	// ------------------------------------------------------------------

	protected readonly closeButtonStyle = OVERLAY_CLOSE_BUTTON_STYLE;
	protected readonly prevButtonStyle = OVERLAY_PREV_BUTTON_STYLE;
	protected readonly nextButtonStyle = OVERLAY_NEXT_BUTTON_STYLE;
	protected readonly counterStyle = OVERLAY_COUNTER_STYLE;

	/**
	 * Sync back to `closed` when fullscreen is exited from OUTSIDE this
	 * component's own close/Escape handling: the browser's native Esc handling
	 * can beat (or replace) our `keydown` listener, and mobile back
	 * gestures/browser-UI exits never reach it at all. Without this, `presenting`
	 * would stay stuck true while the app has silently fallen back to the plain
	 * CSS overlay. `emitClosed()` is itself guarded against double-firing, so it
	 * is safe if our own close flow *also* triggers this event.
	 */
	@HostListener('document:fullscreenchange')
	protected onFullscreenChange(): void {
		if (hasExitedFullscreen(typeof document === 'undefined' ? null : document)) {
			this.emitClosed();
		}
	}

	// ------------------------------------------------------------------
	// Lifecycle
	// ------------------------------------------------------------------

	ngOnInit(): void {
		// Initialise the current index from the startIndex input (clamped).
		const initial = clampIndex(this.startIndex(), this.slides().length);
		this.currentIndex.set(initial);

		// Snapshot the viewport dimensions on mount (SSR-safe guard).
		this.snapViewport();
	}

	// ------------------------------------------------------------------
	// Resize awareness
	// ------------------------------------------------------------------

	@HostListener('window:resize')
	onWindowResize(): void {
		this.snapViewport();
	}

	private snapViewport(): void {
		if (typeof window === 'undefined') {
			return;
		}
		this.viewportW.set(window.innerWidth);
		this.viewportH.set(window.innerHeight);
	}

	// ------------------------------------------------------------------
	// Input (delegated to `presentation-input-controller.ts`)
	// ------------------------------------------------------------------

	/**
	 * `@HostListener` must sit on the component class, so these two stay here and
	 * forward; the rules they implement live in the input controller.
	 */
	@HostListener('document:keydown', ['$event'])
	onKeyDown(event: KeyboardEvent): void {
		this.input.handleKeyDown(event);
	}

	protected onBodyClick(event: MouseEvent): void {
		this.input.handleBodyClick(event);
	}

	/** Click on the end screen: exit the show, like PowerPoint's "click to exit". */
	protected onEndScreenClick(event: MouseEvent): void {
		event.stopPropagation();
		this.endOfShow.set(false);
		this.emitClosed();
	}

	/** Toggle an annotation tool (clicking the active one disarms it). */
	protected selectTool(tool: 'pen' | 'highlighter' | 'eraser' | 'laser'): void {
		this.annotations.setTool(tool);
	}

	/** Toggle the live-caption (subtitle) bar. */
	protected toggleSubtitles(): void {
		this.subtitlesChange.emit(!this.subtitlesVisible());
	}

	/**
	 * Overlay-chrome buttons (close / previous / next). Each is bound for both
	 * `click` and `touchend`: the touch path additionally prevents the browser's
	 * synthesized click so one tap does not fire the action twice, and every one
	 * of them stops propagation so the press never also reaches the stage's
	 * tap-to-advance handler.
	 */
	protected onChromeButton(event: MouseEvent, action: 'close' | 'prev' | 'next'): void {
		event.stopPropagation();
		this.runChromeAction(action);
	}

	protected onChromeButtonTouch(event: TouchEvent, action: 'close' | 'prev' | 'next'): void {
		event.stopPropagation();
		event.preventDefault();
		this.runChromeAction(action);
	}

	private runChromeAction(action: 'close' | 'prev' | 'next'): void {
		if (action === 'close') {
			this.emitClosed();
		} else {
			this.navigator.navigate(action);
		}
	}

	private emitClosed(): void {
		// An audience display mirrors the presenter's screen: Escape, leaving
		// fullscreen and the advance past the end screen must never hand the room
		// the editing chrome.
		if (!mayLeaveSlideShow()) {
			return;
		}
		if (this.closing) {
			return;
		}
		this.closing = true;
		if (this.annotations.hasAnyAnnotations()) {
			this.annotationsExit.emit(this.annotations.getAllSlideAnnotations());
		}
		this.closed.emit();
	}
}
