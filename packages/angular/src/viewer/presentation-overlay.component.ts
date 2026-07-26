import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	HostListener,
	OnInit,
	afterNextRender,
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
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import {
	acceptsPresentationInput,
	createPresentationKeyBuffer,
	mapPresentationKey,
	mayLeaveSlideShow,
} from '../internal/shared';
import { AnimationPlaybackService } from './animation-playback.service';
import { PresentationAnnotationOverlayComponent } from './presentation-annotation-overlay.component';
import { PresentationAnnotationsService } from './presentation-annotations.service';
import type { SlideAnnotationMap } from './presentation-annotations.service';
import {
	exitPresentationFullscreen,
	hasExitedFullscreen,
	requestPresentationFullscreen,
} from './presentation-fullscreen';
import {
	createSlideKeyframesStyle,
	ensurePresetAnimationKeyframes,
} from './presentation-keyframes';
import type { SlideKeyframesStyle } from './presentation-keyframes';
import {
	clampIndex,
	fitZoom,
	hasVisibleSlideAfter,
	nextVisibleIndex,
	prevVisibleIndex,
	shouldBlockClickAdvance,
} from './presentation-overlay-helpers';
import { PresentationSubtitleBarComponent } from './presentation-subtitle-bar.component';
import { PresentationTransitionOverlayComponent } from './presentation-transition-overlay.component';
import { PresenterWindowService } from './presenter-window.service';
import { SlideCanvasComponent } from './slide-canvas.component';
import { attachTouchGestures } from './touch-gestures';
import { ZoomNavigationService } from './zoom-navigation.service';

/**
 * PresentationOverlayComponent: full-viewport black overlay that renders
 * slides in presentation (kiosk) mode.
 *
 * Selector: `pptx-presentation-overlay`
 *
 * Inputs:
 *   - `slides`         (required): all slides in the deck
 *   - `canvasSize`     (required): logical canvas dimensions in pixels
 *   - `mediaDataUrls` : data-URL map for media assets (default: empty Map)
 *   - `startIndex`    : zero-based slide to show first (default: 0)
 *
 * Outputs:
 *   - `indexChange`: emits the new index on every navigation
 *   - `closed`     : emits void when the overlay should be dismissed
 *
 * Keyboard bindings (document-level so no focusable element is required):
 *   ArrowRight / Space / PageDown → next visible slide
 *   ArrowLeft  / PageUp           → previous visible slide
 *   Home                          → first slide
 *   End                           → last slide
 *   Escape                        → emit `closed`
 *
 * Touch bindings (mobile has no keyboard):
 *   Always-visible ✕ button (top-right) → emit `closed`
 *   ‹ / › edge buttons                  → previous / next visible slide
 *   Horizontal swipe                    → left → next, right → previous
 *
 * Click on the overlay body → advance to next visible slide.
 *
 * Fullscreen (mirrors the React `usePresentationMode` / Vue `PresentationMode.vue`
 * behavior, on top of the CSS-fixed full-viewport overlay above): the real
 * Fullscreen API is requested on this component's root element once it mounts,
 * and released again on destroy, so the browser chrome (address bar, etc.) gets
 * out of the way on mobile the same way it does for React/Vue. A
 * `fullscreenchange` listener syncs back to `closed` when fullscreen is exited
 * from outside this component's own close/Escape handling (browser UI, the
 * Android back gesture, etc.). Environments without Fullscreen API support
 * (iOS Safari's partial support, `jsdom` in tests) degrade silently to the
 * plain CSS overlay.
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
	styles: `
		:host {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 10000;
			background: #000;
			cursor: pointer;
			user-select: none;
		}

		.pptx-ng-presentation-root {
			position: absolute;
			inset: 0;
			/* Allow vertical scrolling/pinch but let us interpret horizontal swipes. */
			touch-action: pan-y;
		}

		.pptx-ng-presentation-close:hover,
		.pptx-ng-presentation-nav:hover {
			background: rgba(0, 0, 0, 0.75);
		}

		.pptx-ng-presentation-tools {
			position: absolute;
			bottom: max(1rem, env(safe-area-inset-bottom));
			/* Bottom-left, clear of the centred slide counter (mirrors React, which
			   keeps the bottom-centre reserved for the counter). */
			left: 1rem;
			display: flex;
			gap: 0.25rem;
			padding: 0.25rem;
			border-radius: 0.5rem;
			background: rgba(0, 0, 0, 0.55);
			z-index: 80;
		}

		.pptx-ng-presentation-tools button {
			width: 2rem;
			height: 2rem;
			border: none;
			border-radius: 0.35rem;
			background: transparent;
			color: #fff;
			font-size: 1rem;
			cursor: pointer;
		}

		.pptx-ng-presentation-tools button:hover {
			background: rgba(255, 255, 255, 0.15);
		}

		.pptx-ng-presentation-tools button.is-active {
			background: rgba(255, 255, 255, 0.3);
		}
		.presenter-blank {
			position: absolute;
			inset: 0;
			z-index: 75;
		}
		.pptx-ng-presentation-end {
			position: absolute;
			inset: 0;
			z-index: 90;
			display: flex;
			align-items: flex-start;
			border: 0;
			padding: 0;
			background: #000;
			text-align: left;
			cursor: default;
		}
		.pptx-ng-presentation-end span {
			padding: 0.75rem 1rem;
			color: rgba(255, 255, 255, 0.7);
			font-size: 12px;
		}
		.presenter-laser {
			position: absolute;
			z-index: 76;
			width: 20px;
			height: 20px;
			transform: translate(-50%, -50%);
			border-radius: 50%;
			background: #ef4444;
			box-shadow: 0 0 20px 8px #ef444488;
			pointer-events: none;
		}
		.presenter-caption {
			position: absolute;
			z-index: 77;
			left: 10%;
			right: 10%;
			bottom: 2rem;
			padding: 0.75rem 1.5rem;
			border-radius: 0.5rem;
			background: #000c;
			color: #fff;
			text-align: center;
			font-size: 1.25rem;
			pointer-events: none;
		}
	`,
	template: `
		<div #root class="pptx-ng-presentation-root">
			<!--
				Slide counter, rendered first in DOM (before slide content) so a
				generic "N / M" text query resolves to it rather than to any slide-text
				run that happens to read like "24 / 7". Position is fixed, so DOM order
				does not affect its on-screen placement.
			-->
			<span class="pptx-ng-presentation-counter" [ngStyle]="counterStyle">
				{{ counterLabel() }}
			</span>

			<!-- Black "End of slide show" screen: the show has run past its last
			     slide. It MUST be visible - while it is up the next input either
			     goes nowhere (backward) or ends the show (forward), so a deck that
			     kept painting the last slide looked stuck and swallowed advances. -->
			@if (endOfShow()) {
				<button
					type="button"
					class="pptx-ng-presentation-end"
					data-pptx-end-of-show
					(click)="onEndScreenClick($event)"
				>
					<span>{{ 'pptx.presentation.endOfSlideShow' | translate }}</span>
				</button>
			}

			<div
				#stage
				class="pptx-ng-presentation-stage"
				[ngStyle]="stageContainerStyle()"
				(click)="onBodyClick($event)"
				(mouseover)="onStageHover($event)"
				(mouseout)="onStageHoverEnd($event)"
				(contextmenu)="$event.preventDefault()"
			>
				<pptx-slide-canvas
					[slide]="currentSlide()"
					[canvasSize]="canvasSize()"
					[mediaDataUrls]="mediaDataUrls()"
					[zoom]="zoom()"
					[autoFit]="false"
					[interactive]="false"
					[presenting]="true"
				/>

				@if (activeTransition(); as t) {
					<pptx-presentation-transition-overlay
						[outgoingSlide]="t.outgoing"
						[canvasSize]="canvasSize()"
						[transition]="t.transition"
						[mediaDataUrls]="mediaDataUrls()"
						[zoom]="zoom()"
						(complete)="activeTransition.set(null)"
					/>
				}

				<!-- Ink annotation overlay (pen/highlighter/eraser/laser). Ctrl+M
				     hides the markup without discarding the strokes. -->
				@if (inkMarkupVisible()) {
					<pptx-presentation-annotation-overlay [canvasSize]="canvasSize()" [zoom]="zoom()" />
				}
			</div>
			@if (presenterWindow.snapshot().blackout !== 'none') {
				<div class="presenter-blank" [style.background]="presenterWindow.snapshot().blackout"></div>
			}
			@if (presenterWindow.snapshot().pointer?.tool === 'laser') {
				<div
					class="presenter-laser"
					[style.left.%]="(presenterWindow.snapshot().pointer?.x ?? 0.5) * 100"
					[style.top.%]="(presenterWindow.snapshot().pointer?.y ?? 0.5) * 100"
				></div>
			}
			@if (presenterWindow.snapshot().subtitlesVisible && presenterWindow.snapshot().caption) {
				<div class="presenter-caption">{{ presenterWindow.snapshot().caption }}</div>
			}

			<!-- Live-caption (subtitle) bar. -->
			<pptx-presentation-subtitle-bar [visible]="subtitlesVisible()" />

			<!-- Annotation tool toolbar (bottom-centre). -->
			<div
				class="pptx-ng-presentation-tools"
				role="toolbar"
				[attr.aria-label]="'pptx.presentation.annotationTools' | translate"
			>
				<button
					type="button"
					[class.is-active]="annotations.tool() === 'pen'"
					(click)="selectTool('pen')"
					[attr.aria-label]="'pptx.presentation.pen' | translate"
				>
					<svg lucidePenTool class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					[class.is-active]="annotations.tool() === 'highlighter'"
					(click)="selectTool('highlighter')"
					[attr.aria-label]="'pptx.presentation.highlighter' | translate"
				>
					<svg lucideHighlighter class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					[class.is-active]="annotations.tool() === 'eraser'"
					(click)="selectTool('eraser')"
					[attr.aria-label]="'pptx.presentation.eraser' | translate"
				>
					<svg lucideEraser class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					[class.is-active]="annotations.tool() === 'laser'"
					(click)="selectTool('laser')"
					[attr.aria-label]="'pptx.presentation.laserPointer' | translate"
				>
					<svg lucideMousePointer2 class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					(click)="annotations.clearAnnotations()"
					[attr.aria-label]="'pptx.presentation.clearAnnotations' | translate"
				>
					<svg lucideTrash2 class="h-4 w-4"></svg>
				</button>
				<button
					type="button"
					[class.is-active]="subtitlesVisible()"
					(click)="toggleSubtitles()"
					[attr.aria-label]="'pptx.presentation.liveCaptions' | translate"
				>
					CC
				</button>
			</div>

			<!-- Always-visible close button (top-right, safe-area aware). -->
			<button
				type="button"
				class="pptx-ng-presentation-close"
				[ngStyle]="closeButtonStyle"
				(click)="onClose($event)"
				(touchend)="onCloseTouch($event)"
				[attr.aria-label]="'pptx.presenter.endPresentation' | translate"
			>
				<svg lucideX class="h-5 w-5"></svg>
			</button>

			<!-- Edge navigation buttons (vertically centred, touch-friendly). -->
			<button
				type="button"
				class="pptx-ng-presentation-nav pptx-ng-presentation-prev"
				[ngStyle]="prevButtonStyle"
				(click)="onPrev($event)"
				(touchend)="onPrevTouch($event)"
				[attr.aria-label]="'pptx.presenter.previousSlide' | translate"
			>
				<svg lucideChevronLeft class="h-6 w-6"></svg>
			</button>
			<button
				type="button"
				class="pptx-ng-presentation-nav pptx-ng-presentation-next"
				[ngStyle]="nextButtonStyle"
				(click)="onNext($event)"
				(touchend)="onNextTouch($event)"
				[attr.aria-label]="'pptx.presenter.nextSlide' | translate"
			>
				<svg lucideChevronRight class="h-6 w-6"></svg>
			</button>
		</div>
	`,
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
	readonly subtitlesVisible = input<boolean>(false);
	/**
	 * Set by an audience display when the presenter ends the session and the
	 * browser refuses to close the tab. It raises the black end-of-slide-show
	 * screen so the room never sees the editing chrome.
	 */
	readonly sessionEnded = input<boolean>(false);

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

	/** Zero-based index into `slides()`. */
	protected readonly currentIndex = signal(0);
	/** PowerPoint's Ctrl+M: hide ink markup without discarding the strokes. */
	protected readonly inkMarkupVisible = signal(true);
	/**
	 * True once the show has run past its last slide and the black "End of slide
	 * show" screen is up. It MUST be surfaced: while it is up the next input
	 * either goes nowhere (backward) or ends the show (forward), so a deck that
	 * kept painting its last slide looked stuck and swallowed every advance.
	 */
	protected readonly endOfShow = signal(false);
	/**
	 * Set just before a BACKWARD slide change so the slide effect seeds the
	 * incoming slide as fully built.
	 */
	private pendingCompletedEntry = false;
	/** Mirror the host's audience "session ended" flag onto the end screen. */
	private readonly syncSessionEnded = effect(() => {
		if (this.sessionEnded()) {
			this.endOfShow.set(true);
		}
	});
	private readonly syncExternalIndex = effect(() => {
		const count = this.slides().length;
		if (count === 0) {
			return;
		}
		const requested = clampIndex(this.startIndex(), count);
		if (requested !== this.currentIndex()) {
			this.currentIndex.set(requested);
			this.annotations.setActiveSlide(requested);
		}
	});

	/**
	 * Active slide-transition animation: the outgoing slide + the incoming
	 * slide's transition, played over the new slide. Cleared on completion.
	 */
	protected readonly activeTransition = signal<{
		outgoing: PptxSlide;
		transition: PptxSlideTransition;
	} | null>(null);

	/** Click-stepped element-animation playback for the current slide. */
	protected readonly playback = inject(AnimationPlaybackService);

	/** Ink-annotation state (pen/highlighter/eraser/laser) for the show. */
	protected readonly annotations = inject(PresentationAnnotationsService);

	/**
	 * Zoom-navigation context (provided at this component level). The handler is
	 * registered in the constructor so a descendant zoom tile can jump to its
	 * target slide on click. Descendants resolve this same instance.
	 */
	private readonly zoomNavigation = inject(ZoomNavigationService);

	/** The slide stage root; animation styles are applied to its elements. */
	private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stage');

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

	/** The hover-trigger shape the pointer is currently over (fires a sequence once). */
	private currentHoverTriggerId: string | undefined;

	constructor() {
		this.setupTouchGestures();
		this.setupFullscreen();

		ensurePresetAnimationKeyframes();
		inject(DestroyRef).onDestroy(() => this.slideKeyframes.dispose());

		// Scope media-command (`p:cmd`) target lookups to the slide stage.
		this.playback.setFrameRoot(() => this.stageRef()?.nativeElement ?? null);

		// Wire the zoom-navigation context to this overlay's slide navigation so a
		// descendant zoom tile can jump to its target slide on click.
		this.zoomNavigation.setHandler((index) => this.goToSlide(index));

		// Rebuild the native-animation controller for the current slide (seeds the
		// pre-build state so entrance-animated elements start hidden) and publish its
		// per-slide keyframes CSS.
		effect(() => {
			const completed = this.pendingCompletedEntry;
			this.pendingCompletedEntry = false;
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
				requestAnimationFrame(() => this.applyAnimationStyles());
			} else {
				this.applyAnimationStyles();
			}
		});
	}

	/**
	 * Imperatively apply each tracked element's native-animation state to its DOM
	 * wrapper: visibility (entrance hide-until-revealed / exit), the CSS-animation
	 * shorthand (entrance / emphasis / exit / colour keyframes), and a pointer
	 * cursor on interactive / hover trigger shapes. Mirrors the Vue
	 * `applyAnimationStyles`; every renderer emits a `data-element-id`, so this
	 * needs no per-element renderer plumbing.
	 */
	private applyAnimationStyles(): void {
		const root = this.stageRef()?.nativeElement;
		if (!root) {
			return;
		}
		const states = this.playback.presentationElementStates();
		const interactive = this.playback.interactiveTriggerShapeIds();
		const hover = this.playback.hoverTriggerShapeIds();
		const nodes = root.querySelectorAll<HTMLElement>('[data-element-id]');
		nodes.forEach((el) => {
			const id = el.dataset['elementId'];
			if (!id) {
				return;
			}
			const state = states.get(id);
			el.style.animation = state?.cssAnimation ?? '';
			el.style.visibility = state?.visible === false ? 'hidden' : '';
			el.style.cursor = interactive.has(id) || hover.has(id) ? 'pointer' : '';
		});
	}

	/** Resolve the nearest element id above a pointer target, if any. */
	private closestElementId(target: EventTarget | null): string | undefined {
		if (!(target instanceof Element)) {
			return undefined;
		}
		return target.closest<HTMLElement>('[data-element-id]')?.dataset['elementId'];
	}

	/**
	 * Pointer moved over the stage: (re)play a hover-trigger shape's sequence once
	 * on entering it (not on every descendant transition that `mouseover` bubbles
	 * up), resetting the previous trigger on leaving it.
	 */
	protected onStageHover(event: MouseEvent): void {
		const id = this.closestElementId(event.target);
		const triggerId = id && this.playback.hoverTriggerShapeIds().has(id) ? id : undefined;
		if (triggerId === this.currentHoverTriggerId) {
			return;
		}
		if (this.currentHoverTriggerId) {
			this.playback.handleHoverEnd(this.currentHoverTriggerId);
		}
		this.currentHoverTriggerId = triggerId;
		if (triggerId) {
			this.playback.handleHoverStart(triggerId);
		}
	}

	/** Pointer left the stage subtree entirely: reset any active hover trigger. */
	protected onStageHoverEnd(event: MouseEvent): void {
		const related = event.relatedTarget;
		if (related instanceof Node && this.stageRef()?.nativeElement.contains(related)) {
			return;
		}
		if (this.currentHoverTriggerId) {
			this.playback.handleHoverEnd(this.currentHoverTriggerId);
			this.currentHoverTriggerId = undefined;
		}
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
		};
	});

	/** "3 / 12" label. */
	protected readonly counterLabel = computed<string>(() => {
		const count = this.slides().length;
		return count === 0 ? '0 / 0' : `${this.currentIndex() + 1} / ${count}`;
	});

	// ------------------------------------------------------------------
	// Static control styles (no dynamic data → plain objects, not computed)
	// ------------------------------------------------------------------

	/**
	 * Always-visible close button, fixed at the top-right and offset by the
	 * device safe-area insets so it clears notches / rounded corners. Sits on a
	 * higher z-index than the stage so taps never fall through to tap-advance.
	 */
	protected readonly closeButtonStyle: Record<string, string> = {
		position: 'fixed',
		top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)',
		right: 'calc(env(safe-area-inset-right, 0px) + 0.5rem)',
		display: 'flex',
		'align-items': 'center',
		'justify-content': 'center',
		width: '44px',
		height: '44px',
		'min-width': '44px',
		'min-height': '44px',
		background: 'rgba(0,0,0,0.55)',
		border: 'none',
		'border-radius': '50%',
		color: '#fff',
		cursor: 'pointer',
		'font-size': '1.25rem',
		'line-height': '1',
		'pointer-events': 'auto',
		'z-index': '10002',
		'touch-action': 'manipulation',
	};

	/** Shared geometry for the left/right edge navigation buttons. */
	private readonly navButtonBase: Record<string, string> = {
		position: 'fixed',
		top: '50%',
		transform: 'translateY(-50%)',
		display: 'flex',
		'align-items': 'center',
		'justify-content': 'center',
		width: '44px',
		height: '44px',
		'min-width': '44px',
		'min-height': '44px',
		background: 'rgba(0,0,0,0.45)',
		border: 'none',
		'border-radius': '50%',
		color: '#fff',
		cursor: 'pointer',
		'font-size': '1.75rem',
		'line-height': '1',
		'pointer-events': 'auto',
		'z-index': '10001',
		'touch-action': 'manipulation',
	};

	protected readonly prevButtonStyle: Record<string, string> = {
		...this.navButtonBase,
		left: 'calc(env(safe-area-inset-left, 0px) + 0.5rem)',
	};

	protected readonly nextButtonStyle: Record<string, string> = {
		...this.navButtonBase,
		right: 'calc(env(safe-area-inset-right, 0px) + 0.5rem)',
	};

	protected readonly counterStyle: Record<string, string> = {
		position: 'fixed',
		bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)',
		left: '50%',
		transform: 'translateX(-50%)',
		padding: '0.25rem 0.75rem',
		background: 'rgba(0,0,0,0.55)',
		'border-radius': '999px',
		color: '#fff',
		'font-family': 'system-ui, sans-serif',
		'font-size': '0.875rem',
		'line-height': '1.4',
		'pointer-events': 'none',
		'z-index': '10001',
	};

	// ------------------------------------------------------------------
	// Touch / swipe handling (delegated to the shared gesture recogniser)
	// ------------------------------------------------------------------

	/**
	 * Wire the shared touch-gesture recogniser to the overlay root so a
	 * horizontal swipe navigates: swipe left (direction -1) advances to the
	 * next visible slide, swipe right (direction 1) returns to the previous,
	 * matching the prior bespoke handler's semantics. Pinch is made inert
	 * (equal min/max scale, no-op getScale) and there is no long-press in
	 * presentation mode. Attach happens once the root node is live
	 * (afterNextRender) and is torn down on destroy.
	 */
	private setupTouchGestures(): void {
		const destroyRef = inject(DestroyRef);
		afterNextRender(() => {
			const el = this.rootRef()?.nativeElement;
			if (!el) {
				return;
			}
			const teardown = attachTouchGestures(el, {
				getScale: () => 1,
				callbacks: {
					onSwipe: (direction) => {
						// direction 1 = swipe right (previous), -1 = swipe left (next). A
						// swipe is PowerPoint's on-click advance, so the forward case is
						// gated by the current slide's advanceOnClick flag; a backward
						// swipe is explicit navigation and never gated.
						if (direction === 1) {
							this.navigate('prev');
						} else {
							this.advanceFromClick();
						}
					},
				},
			});
			destroyRef.onDestroy(teardown);
		});
	}

	// ------------------------------------------------------------------
	// Real Fullscreen API (layered on top of the CSS-fixed overlay)
	// ------------------------------------------------------------------

	/**
	 * Request real fullscreen on the overlay root once it mounts, and release
	 * it again when the overlay is destroyed (`presenting` flips back to
	 * false, closing this `@if` block). Mirrors Vue's `onMounted` /
	 * `onBeforeUnmount` pair on its own overlay root; feature-detected so
	 * unsupported environments just keep the CSS overlay.
	 */
	private setupFullscreen(): void {
		const destroyRef = inject(DestroyRef);
		afterNextRender(() => {
			requestPresentationFullscreen(this.rootRef()?.nativeElement);
		});
		destroyRef.onDestroy(() => {
			exitPresentationFullscreen(typeof document === 'undefined' ? null : document);
		});
	}

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
	// Keyboard navigation (document-level: works even when nothing is focused)
	// ------------------------------------------------------------------

	/** Digit buffer backing PowerPoint's "type a slide number, then Enter" jump. */
	private readonly keyBuffer = createPresentationKeyBuffer();

	@HostListener('document:keydown', ['$event'])
	onKeyDown(event: KeyboardEvent): void {
		// An audience display mirrors the presenter's screen. If its own keyboard
		// navigated, a stray key moved it off the presenter's slide and the next
		// snapshot yanked it back, which reads as the display refusing to advance.
		if (!acceptsPresentationInput()) {
			return;
		}
		const mapped = mapPresentationKey(event, this.keyBuffer);
		if (mapped.action === 'none') {
			return;
		}
		event.preventDefault();

		switch (mapped.action) {
			case 'next':
				this.navigate('next');
				break;
			case 'previous':
				this.navigate('prev');
				break;
			case 'first':
				this.navigate('first');
				break;
			case 'last':
				this.navigate('last');
				break;
			case 'goto': {
				const index = mapped.slideNumber - 1;
				if (index >= 0 && index < this.slides().length) {
					this.goToSlide(index);
				}
				break;
			}
			case 'end':
				this.emitClosed();
				break;
			case 'pointerTool':
				// PowerPoint's Ctrl+A "arrow" is the plain pointer: no active tool.
				this.annotations.setTool(mapped.tool === 'arrow' ? 'none' : mapped.tool);
				break;
			case 'eraseAnnotations':
				this.annotations.clearAnnotations();
				break;
			case 'toggleInkMarkup':
				this.inkMarkupVisible.update((visible) => !visible);
				break;
			case 'toggleBlackScreen':
				this.toggleBlank('black');
				break;
			case 'toggleWhiteScreen':
				this.toggleBlank('white');
				break;
			default:
				break;
		}
	}

	/** Toggle PowerPoint's blank black/white screen (B/W, or `.`/`,`). */
	private toggleBlank(value: 'black' | 'white'): void {
		const current = this.presenterWindow.snapshot().blackout;
		this.presenterWindow.updateSnapshot({ blackout: current === value ? 'none' : value });
	}

	// ------------------------------------------------------------------
	// Click handling
	// ------------------------------------------------------------------

	/** Left-click on the slide area advances to the next visible slide. */
	protected onBodyClick(event: MouseEvent): void {
		if (typeof document !== 'undefined' && !document.fullscreenElement) {
			requestPresentationFullscreen(this.rootRef()?.nativeElement);
		}
		// button 0 = primary (left); right-click / middle-click are ignored.
		if (event.button !== 0) {
			return;
		}
		// A drawing tool owns pointer gestures; don't hijack them to advance.
		if (this.annotations.tool() !== 'none') {
			return;
		}
		// Interactive (`onShapeClick`) trigger shape: play its sequence instead of
		// advancing the slide (mirrors the Vue `onFrameClick`).
		const id = this.closestElementId(event.target);
		if (id && this.playback.interactiveTriggerShapeIds().has(id)) {
			if (this.playback.handleInteractiveShapeClick(id)) {
				return;
			}
		}
		this.advanceFromClick();
	}

	/**
	 * Click/tap/swipe advance. Like every forward step it first reveals the
	 * current slide's next animation build; only once the builds are exhausted
	 * does it advance the slide, and then only when the slide's transition allows
	 * click-advance (advanceOnClick !== false). Keyboard and the on-screen
	 * next/prev buttons call navigate() directly and are never gated.
	 */
	private advanceFromClick(): void {
		// An audience display never drives itself: a tap or swipe of its own would
		// move it off the presenter's slide, and the next snapshot would drag it back.
		if (!acceptsPresentationInput()) {
			return;
		}
		if (shouldBlockClickAdvance(this.playback.isComplete(), this.currentSlide())) {
			return;
		}
		this.navigate('next');
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

	/** Close button click: stop propagation so it does not also advance. */
	protected onClose(event: MouseEvent): void {
		event.stopPropagation();
		this.emitClosed();
	}

	/**
	 * Close button touch: stop propagation and prevent the synthesized click
	 * so a tap exits without bubbling to the tap-advance handler.
	 */
	protected onCloseTouch(event: TouchEvent): void {
		event.stopPropagation();
		event.preventDefault();
		this.emitClosed();
	}

	/** Previous-edge button: stop propagation so the tap does not double-fire. */
	protected onPrev(event: MouseEvent): void {
		event.stopPropagation();
		this.navigate('prev');
	}

	protected onPrevTouch(event: TouchEvent): void {
		event.stopPropagation();
		event.preventDefault();
		this.navigate('prev');
	}

	/** Next-edge button: stop propagation so the tap does not double-fire. */
	protected onNext(event: MouseEvent): void {
		event.stopPropagation();
		this.navigate('next');
	}

	protected onNextTouch(event: TouchEvent): void {
		event.stopPropagation();
		event.preventDefault();
		this.navigate('next');
	}

	// ------------------------------------------------------------------
	// Navigation helpers
	// ------------------------------------------------------------------

	private navigate(direction: 'next' | 'prev' | 'first' | 'last'): void {
		const slides = this.slides();
		const count = slides.length;
		if (count === 0) {
			return;
		}

		// While the end screen is up a forward input ends the show (PowerPoint's
		// "click to exit") and a backward input just dismisses it.
		if (this.endOfShow()) {
			this.endOfShow.set(false);
			if (direction === 'next') {
				this.emitClosed();
			}
			return;
		}

		// On forward navigation, first reveal the next click-group of element
		// animations; only advance the slide once the slide's builds are exhausted.
		if (direction === 'next' && this.playback.advance()) {
			return;
		}

		if (direction === 'prev') {
			// A slide entered backward shows its builds already complete. The next
			// back press replays them from the start rather than leaving the slide,
			// so a presenter who overshot can watch the build again (PowerPoint).
			if (this.playback.isSeededCompleted()) {
				this.playback.setSlide(this.currentSlide(), this.showWithAnimation());
				return;
			}
			// PowerPoint shows a slide you step BACK onto with its builds played.
			this.pendingCompletedEntry = true;
		}

		const current = this.currentIndex();
		let next: number;

		switch (direction) {
			case 'next':
				next = nextVisibleIndex(current, slides);
				break;
			case 'prev':
				next = prevVisibleIndex(current, slides);
				break;
			case 'first':
				next = clampIndex(0, count);
				break;
			case 'last':
				next = clampIndex(count - 1, count);
				break;
		}

		if (direction === 'next' && !hasVisibleSlideAfter(current, slides)) {
			// Nothing further to advance to. `nextVisibleIndex` would wrap back to
			// the first slide and loop for ever; PowerPoint only loops when "Loop
			// continuously until Esc" is set, so end the show instead.
			this.endOfShow.set(true);
			return;
		}

		if (next !== current) {
			// Play the incoming slide's transition (if any) over the new slide,
			// animating the outgoing slide out. Forward navigation only, matching
			// PowerPoint, which does not replay transitions when stepping back.
			const incoming = slides[next];
			const outgoing = slides[current];
			if ((direction === 'next' || direction === 'first') && incoming?.transition && outgoing) {
				this.activeTransition.set({ outgoing, transition: incoming.transition });
			} else {
				this.activeTransition.set(null);
			}
			this.currentIndex.set(next);
			this.annotations.setActiveSlide(next);
			this.indexChange.emit(next);
		}
	}

	/**
	 * Jump directly to `index` (clamped to the slide range), committing the same
	 * way `navigate()` does its final step. Used by the zoom-navigation context
	 * for a click-to-jump from a zoom tile: this is a transition-less jump, so it
	 * does NOT replay the target slide's transition.
	 */
	private goToSlide(index: number): void {
		const count = this.slides().length;
		if (count === 0) {
			return;
		}
		const next = clampIndex(index, count);
		if (next === this.currentIndex()) {
			return;
		}
		this.activeTransition.set(null);
		this.currentIndex.set(next);
		this.annotations.setActiveSlide(next);
		this.indexChange.emit(next);
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
