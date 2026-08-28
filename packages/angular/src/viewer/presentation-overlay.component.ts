import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	HostListener,
	Injector,
	OnInit,
	afterNextRender,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type {
	CanvasSize,
	PresentationContextMenuActionId,
	ShowOrderCustomShow,
} from '../internal/shared';
import { annotationOverlayZIndex, mayLeaveSlideShow } from '../internal/shared';
import { AnimationPlaybackService } from './animation-playback.service';
import { PresentationAnnotationOverlayComponent } from './presentation-annotation-overlay.component';
import { PresentationAnnotationsService } from './presentation-annotations.service';
import type { SlideAnnotationMap } from './presentation-annotations.service';
import { PresentationContextMenuComponent } from './presentation-context-menu.component';
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
import {
	attachShowVisibilityPause,
	clampIndex,
	fitZoom,
	presentationStageStyle,
	resolveSlideAutoAdvanceMs,
} from './presentation-overlay-helpers';
import {
	setupPresentationFullscreen,
	setupPresentationTouchGestures,
} from './presentation-overlay-shell';
import { PresentationShowNavigator } from './presentation-show-navigator';
import { PresentationStageAnimator } from './presentation-stage-animator';
import { PresentationSubtitleBarComponent } from './presentation-subtitle-bar.component';
import { PresentationToolbarComponent } from './presentation-toolbar.component';
import { PresentationTransitionOverlayComponent } from './presentation-transition-overlay.component';
import { PresenterSlideNavigatorComponent } from './presenter-slide-navigator.component';
import { PresenterWindowService } from './presenter-window.service';
import { SlideCanvasComponent } from './slide-canvas.component';
import { ViewerOptionsService } from './viewer-options.service';
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
		PresentationToolbarComponent,
		PresentationContextMenuComponent,
		PresenterSlideNavigatorComponent,
		TranslatePipe,
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
	/**
	 * Optional so this overlay still renders in isolation (Storybook-style
	 * usage, tests): outside a `PowerPointViewerComponent` host that provides
	 * it, external-hyperlink clicks are simply never confirmed.
	 */
	private readonly viewerOpts = inject(ViewerOptionsService, { optional: true });
	// ------------------------------------------------------------------
	// Inputs
	// ------------------------------------------------------------------

	readonly slides = input.required<PptxSlide[]>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly startIndex = input<number>(0);
	/**
	 * The running custom show, or null for the whole deck. `slides` stays the
	 * FULL deck either way: membership is applied by the shared show-order rule
	 * (see `presentation-overlay-helpers.ts`), so indexes remain deck indexes and
	 * hidden slides inside a show are still skipped.
	 */
	readonly activeCustomShow = input<ShowOrderCustomShow | null>(null);
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
	/** Whether presenter view is up (tints the toolbar's presenter-view toggle). */
	readonly presenterMode = input<boolean>(false);
	/**
	 * File > Options > Advanced > "Show menu on right mouse click". Off swallows
	 * right-click entirely (no browser menu either), matching React/Vue.
	 */
	readonly showMenuOnRightClick = input<boolean>(true);
	/** File > Options > Advanced > "Show popup toolbar" while presenting. */
	readonly showPopupToolbar = input<boolean>(true);

	// ------------------------------------------------------------------
	// Outputs
	// ------------------------------------------------------------------

	readonly indexChange = output<number>();
	readonly closed = output<void>();
	/** Live-caption preference; driven by the host's ribbon, not by show chrome. */
	readonly subtitlesChange = output<boolean>();
	/**
	 * The toolbar's presenter-view toggle was pressed. The host owns the swap
	 * (this overlay and the presenter console cannot both be on screen).
	 */
	readonly presenterViewToggle = output<void>();
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
		activeCustomShow: () => this.activeCustomShow(),
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
		// PowerPoint's bare `J`. The host owns the preference, so the key emits the
		// flipped value rather than mutating a local copy that would drift from the
		// ribbon's own captions toggle.
		toggleSubtitles: () => this.subtitlesChange.emit(!this.subtitlesVisible()),
		// PowerPoint's Ctrl+H ("hide UI"). It drives the toolbar's OWN visibility
		// flag rather than a second one here, so the shortcut and the auto-hide
		// countdown cannot disagree about whether the bar is up.
		toggleChrome: () => this.toolbarRef()?.toggleVisible(),
		// PowerPoint's Ctrl+S ("See All Slides"). Rendered over the show, as React
		// does it: the navigator is the presenter's way to jump to a backup slide
		// without leaving the show, so putting it behind presenter view would make
		// the shortcut mean something else.
		showAllSlides: () => this.allSlidesOpen.set(true),
		requestClose: () => this.emitClosed(),
		// Trust Center > "Confirm before opening external hyperlinks" (File >
		// Options), gating a slide's on-click `a:hlinkClick` action the same way
		// it gates a text-run hyperlink.
		confirmExternalHyperlink: (href) => this.viewerOpts?.confirmExternalHyperlink(href) ?? true,
	});

	/** Whether PowerPoint's "See All Slides" navigator is up (Ctrl+S). */
	protected readonly allSlidesOpen = signal(false);

	/** Slide-show right-click menu position, or null when closed. */
	protected readonly contextMenuState = signal<{ x: number; y: number } | null>(null);

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

	/**
	 * Adopt an index the host PUSHED in (an audience display mirrors one).
	 *
	 * `startIndex` is this effect's only dependency, deliberately. `syncFromHost`
	 * reads the navigator's own `currentIndex` to decide whether anything
	 * changed, and tracking that read made the effect re-run on the show's own
	 * advances: any host whose `startIndex` did not follow the show then re-armed
	 * itself and yanked the slide straight back. That is exactly what a running
	 * custom show used to do, and why Angular alone never left its first slide.
	 */
	private readonly syncExternalIndex = effect(() => {
		const requested = this.startIndex();
		untracked(() => this.navigator.syncFromHost(requested));
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

	/** The show toolbar, so Ctrl+H can flip the visibility flag it already owns. */
	private readonly toolbarRef = viewChild(PresentationToolbarComponent);

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

		// A hidden tab is a paused show: the shared handler pauses the stage's
		// playing media and the cross-slide persistent audio while the document is
		// hidden, and these callbacks cancel / re-arm the timed auto-advance so
		// the deck does not run on unseen. Attached once the overlay root exists;
		// the effect's cleanup detaches it when the overlay goes away.
		effect((onCleanup) => {
			const root = this.rootRef()?.nativeElement;
			if (!root) {
				return;
			}
			onCleanup(
				attachShowVisibilityPause({
					root,
					cancelAutoAdvance: () => this.navigator.clearAutoAdvance(),
					rearmAutoAdvance: () =>
						this.navigator.armAutoAdvance(
							resolveSlideAutoAdvanceMs(this.currentSlide(), this.useTimings(), this.endOfShow()),
						),
				}),
			);
		});

		// Scope media-command (`p:cmd`) target lookups to the slide stage.
		this.playback.setFrameRoot(() => this.stageRef()?.nativeElement ?? null);

		// Resolve a native-animation `p:stSnd` action sound's archive path to
		// its pre-resolved Blob/data URL and play it. Without this the service's
		// `onPlayActionSound` callback stayed unset and every animation sound
		// (and effect-sound cleanup) was silently dropped.
		this.playback.setActionSoundHandler((soundPath) => {
			const url = this.mediaDataUrls().get(soundPath);
			if (!url || typeof Audio === 'undefined') {
				return;
			}
			const audio = new Audio(url);
			void audio.play().catch(() => {
				/* ignore autoplay restrictions */
			});
		});

		// Stamp a playback step onto the DOM in the SAME task as the input that
		// caused it. The reactive path below (effect -> afterNextRender) is still
		// the applier for a slide change, but it lands ~24ms after a click-advance,
		// so the first frame of every entrance was dropped and the show visibly
		// lagged its own key press. `onlyWhenStaged` keeps this out of the slide
		// swap, where the states describe a slide the stage has not rendered yet.
		this.playback.setStyleApplier(() =>
			this.stageAnimator.applyAnimationStyles({ onlyWhenStaged: true }),
		);

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
		// the slide changes. Applied pre-paint (see the `afterNextRender` note
		// below). Structural reveals (chart / SmartArt build, fill / stroke
		// inherit) are applied declaratively by the renderers themselves via the
		// injected AnimationPlaybackService.
		const injector = inject(Injector);
		effect(() => {
			// Register reactive dependencies.
			this.playback.presentationElementStates();
			this.playback.interactiveTriggerShapeIds();
			this.playback.hoverTriggerShapeIds();
			this.currentSlide();
			// `afterNextRender` runs once the incoming slide's `[data-element-id]`
			// nodes are in the DOM but still BEFORE the browser paints, unlike the
			// `requestAnimationFrame` this used to use, which let a whole frame of
			// the new slide paint at its FINAL state first (the "end state flash",
			// issue #132). An `afterRenderEffect` would also be pre-paint but only
			// re-runs on a render pass, so a state change with no template change
			// (every build advance) would never reach the DOM.
			afterNextRender(() => this.stageAnimator.applyAnimationStyles(), { injector });
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

	/**
	 * Centre the scaled slide in the viewport. Numeric offsets, deliberately not
	 * a `translate(-50%, -50%)`: see {@link presentationStageStyle} for why a
	 * transform here broke the blackboard's ink layering.
	 */
	protected readonly stageContainerStyle = computed<Record<string, string>>(() =>
		presentationStageStyle(this.canvasSize(), this.zoom(), this.viewportW(), this.viewportH()),
	);

	/**
	 * Stacking level of the local ink overlay: raised above the blackout sheet
	 * while the screen is blanked (PowerPoint's blackboard), 60 otherwise. The
	 * decision lives in shared `annotationOverlayZIndex`; it only works because
	 * the stage above is no longer a stacking context.
	 */
	protected readonly annotationOverlayZ = computed<number>(() =>
		annotationOverlayZIndex(this.presenterWindow.snapshot().blackout),
	);

	/**
	 * Epoch ms the show opened, feeding the toolbar's elapsed readout. Captured
	 * at construction because this overlay is created exactly when the show
	 * starts, so the readout runs from 00:00 without the host tracking it.
	 */
	protected readonly showStartedAt = Date.now();

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
	/**
	 * PowerPoint navigates a running show on the wheel: down advances, up goes
	 * back. This overlay only exists while a show runs, so no extra mode gate is
	 * needed - the same reason its key handling lives here.
	 */
	@HostListener('document:wheel', ['$event'])
	protected onWheel(event: WheelEvent): void {
		this.input.handleWheel(event);
	}

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

	/**
	 * Options > Advanced > "Show menu on right mouse click": right-click opens
	 * a minimal Next/Previous/End Show menu (plus pointer tools, See All
	 * Slides, presenter view and the black/white blank screen); off swallows
	 * the click entirely, matching React/Vue.
	 */
	protected onStageContextMenu(event: MouseEvent): void {
		event.preventDefault();
		if (!this.showMenuOnRightClick()) {
			return;
		}
		this.contextMenuState.set({ x: event.clientX, y: event.clientY });
	}

	/** Route a chosen context-menu action onto this overlay's own handlers. */
	protected onContextMenuAction(id: PresentationContextMenuActionId): void {
		switch (id) {
			case 'next':
				this.navigator.navigate('next');
				break;
			case 'previous':
				this.navigator.navigate('prev');
				break;
			case 'seeAllSlides':
				this.allSlidesOpen.set(true);
				break;
			case 'presenterView':
				this.presenterViewToggle.emit();
				break;
			case 'pointerArrow':
				this.annotations.setTool('none');
				break;
			case 'pointerPen':
				this.annotations.setTool('pen');
				break;
			case 'pointerHighlighter':
				this.annotations.setTool('highlighter');
				break;
			case 'pointerLaser':
				this.annotations.setTool('laser');
				break;
			case 'eraseInk':
				this.annotations.clearAnnotations();
				break;
			case 'blankBlack':
				this.setBlankScreen('black');
				break;
			case 'blankWhite':
				this.setBlankScreen('white');
				break;
			case 'endShow':
				this.emitClosed();
				break;
		}
	}

	/** Set (or clear) the whole-screen blank, mirroring the keyboard B/W shortcuts. */
	private setBlankScreen(value: 'black' | 'white'): void {
		const current = this.presenterWindow.snapshot().blackout;
		this.presenterWindow.updateSnapshot({ blackout: current === value ? 'none' : value });
	}

	/** Click on the end screen: exit the show, like PowerPoint's "click to exit". */
	protected onEndScreenClick(event: MouseEvent): void {
		event.stopPropagation();
		this.endOfShow.set(false);
		this.emitClosed();
	}

	/** The show toolbar's end button: same exit path as Escape / the close button. */
	protected onToolbarEnd(): void {
		this.emitClosed();
	}

	/** A "See All Slides" tile: jump there and drop the navigator. */
	protected onNavigatorSelect(index: number): void {
		this.navigator.goToSlide(index);
		this.allSlidesOpen.set(false);
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
