import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	HostListener,
	OnDestroy,
	OnInit,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import { AnimationPlaybackService } from './animation-playback.service';
import { PresentationAnnotationOverlayComponent } from './presentation-annotation-overlay.component';
import { PresentationAnnotationsService } from './presentation-annotations.service';
import {
	clampIndex,
	fitZoom,
	nextVisibleIndex,
	prevVisibleIndex,
} from './presentation-overlay-helpers';
import { PresentationSubtitleBarComponent } from './presentation-subtitle-bar.component';
import { PresentationTransitionOverlayComponent } from './presentation-transition-overlay.component';
import { SlideCanvasComponent } from './slide-canvas.component';

/**
 * PresentationOverlayComponent — full-viewport black overlay that renders
 * slides in presentation (kiosk) mode.
 *
 * Selector: `pptx-presentation-overlay`
 *
 * Inputs:
 *   - `slides`         (required) — all slides in the deck
 *   - `canvasSize`     (required) — logical canvas dimensions in pixels
 *   - `mediaDataUrls`  — data-URL map for media assets (default: empty Map)
 *   - `startIndex`     — zero-based slide to show first (default: 0)
 *
 * Outputs:
 *   - `indexChange` — emits the new index on every navigation
 *   - `closed`      — emits void when the overlay should be dismissed
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
	],
	providers: [AnimationPlaybackService, PresentationAnnotationsService],
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
	`,
	template: `
		<div
			class="pptx-ng-presentation-root"
			(touchstart)="onTouchStart($event)"
			(touchmove)="onTouchMove($event)"
			(touchend)="onTouchEnd($event)"
		>
			<!--
				Slide counter — rendered first in DOM (before slide content) so a
				generic "N / M" text query resolves to it rather than to any slide-text
				run that happens to read like "24 / 7". Position is fixed, so DOM order
				does not affect its on-screen placement.
			-->
			<span class="pptx-ng-presentation-counter" [ngStyle]="counterStyle">
				{{ counterLabel() }}
			</span>

			<div
				#stage
				class="pptx-ng-presentation-stage"
				[ngStyle]="stageContainerStyle()"
				(click)="onBodyClick($event)"
				(contextmenu)="$event.preventDefault()"
			>
				<pptx-slide-canvas
					[slide]="currentSlide()"
					[canvasSize]="canvasSize()"
					[mediaDataUrls]="mediaDataUrls()"
					[zoom]="zoom()"
					[autoFit]="false"
					[interactive]="false"
				/>

				@if (activeTransition(); as t) {
					<pptx-presentation-transition-overlay
						[outgoingSlide]="t.outgoing"
						[canvasSize]="canvasSize()"
						[transition]="t.transition"
						[mediaDataUrls]="mediaDataUrls()"
						(complete)="activeTransition.set(null)"
					/>
				}

				<!-- Ink annotation overlay (pen/highlighter/eraser/laser). -->
				<pptx-presentation-annotation-overlay [canvasSize]="canvasSize()" [zoom]="zoom()" />
			</div>

			<!-- Live-caption (subtitle) bar. -->
			<pptx-presentation-subtitle-bar [visible]="subtitlesVisible()" />

			<!-- Annotation tool toolbar (bottom-centre). -->
			<div class="pptx-ng-presentation-tools" role="toolbar" aria-label="Annotation tools">
				<button
					type="button"
					[class.is-active]="annotations.tool() === 'pen'"
					(click)="selectTool('pen')"
					aria-label="Pen"
				>
					✎
				</button>
				<button
					type="button"
					[class.is-active]="annotations.tool() === 'highlighter'"
					(click)="selectTool('highlighter')"
					aria-label="Highlighter"
				>
					▭
				</button>
				<button
					type="button"
					[class.is-active]="annotations.tool() === 'eraser'"
					(click)="selectTool('eraser')"
					aria-label="Eraser"
				>
					⌫
				</button>
				<button
					type="button"
					[class.is-active]="annotations.tool() === 'laser'"
					(click)="selectTool('laser')"
					aria-label="Laser pointer"
				>
					•
				</button>
				<button type="button" (click)="annotations.clearAnnotations()" aria-label="Clear ink">
					🗑
				</button>
				<button
					type="button"
					[class.is-active]="subtitlesVisible()"
					(click)="toggleSubtitles()"
					aria-label="Live captions"
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
				aria-label="End presentation"
			>
				&#x2715;
			</button>

			<!-- Edge navigation buttons (vertically centred, touch-friendly). -->
			<button
				type="button"
				class="pptx-ng-presentation-nav pptx-ng-presentation-prev"
				[ngStyle]="prevButtonStyle"
				(click)="onPrev($event)"
				(touchend)="onPrevTouch($event)"
				aria-label="Previous slide"
			>
				&#x2039;
			</button>
			<button
				type="button"
				class="pptx-ng-presentation-nav pptx-ng-presentation-next"
				[ngStyle]="nextButtonStyle"
				(click)="onNext($event)"
				(touchend)="onNextTouch($event)"
				aria-label="Next slide"
			>
				&#x203A;
			</button>
		</div>
	`,
})
export class PresentationOverlayComponent implements OnInit, OnDestroy {
	// ------------------------------------------------------------------
	// Inputs
	// ------------------------------------------------------------------

	readonly slides = input.required<PptxSlide[]>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly startIndex = input<number>(0);

	// ------------------------------------------------------------------
	// Outputs
	// ------------------------------------------------------------------

	readonly indexChange = output<number>();
	readonly closed = output<void>();

	// ------------------------------------------------------------------
	// Internal state
	// ------------------------------------------------------------------

	/** Zero-based index into `slides()`. */
	protected readonly currentIndex = signal(0);

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
	/** Whether the live-caption bar is shown. */
	protected readonly subtitlesVisible = signal(false);

	/** The slide stage root — animation styles are applied to its elements. */
	private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stage');

	constructor() {
		// Feed the current slide's element animations into playback (resets to the
		// pre-build state so entrance-animated elements start hidden).
		effect(() => {
			this.playback.setAnimations(this.currentSlide()?.animations);
		});

		// Apply the reveal / pending styles to the rendered elements whenever the
		// playback step or the slide changes. Deferred to an animation frame so the
		// new slide's `[data-element-id]` nodes are in the DOM first.
		effect(() => {
			// Register reactive dependencies.
			this.playback.elementStyles();
			this.playback.pendingStyles();
			this.currentSlide();
			if (typeof requestAnimationFrame === 'function') {
				requestAnimationFrame(() => this.applyAnimationStyles());
			} else {
				this.applyAnimationStyles();
			}
		});
	}

	/**
	 * Imperatively apply animation reveal / pending CSS to the slide's element
	 * nodes (mirrors the Vue `applyAnimationStyles`). Every renderer emits a
	 * `data-element-id`, so this needs no per-element renderer plumbing.
	 */
	private applyAnimationStyles(): void {
		const root = this.stageRef()?.nativeElement;
		if (!root) {
			return;
		}
		const revealed = this.playback.elementStyles();
		const pending = this.playback.pendingStyles();
		const nodes = root.querySelectorAll<HTMLElement>('[data-element-id]');
		nodes.forEach((el) => {
			const id = el.dataset['elementId'];
			if (!id) {
				return;
			}
			el.style.removeProperty('animation');
			el.style.removeProperty('opacity');
			el.style.removeProperty('visibility');
			const active = revealed.get(id) ?? pending.get(id);
			if (active) {
				for (const [prop, value] of Object.entries(active)) {
					el.style.setProperty(prop, value);
				}
			}
		});
	}

	/** Viewport dimensions — updated on resize. */
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
	// Touch / swipe tracking
	// ------------------------------------------------------------------

	/** Horizontal swipe distance (px) required to trigger navigation. */
	private static readonly SWIPE_THRESHOLD = 50;

	/** X coordinate captured on touchstart, or null when no swipe is active. */
	private touchStartX: number | null = null;
	private touchStartY: number | null = null;
	/**
	 * Last position seen during the gesture (updated on every touchmove). Some
	 * touch dispatchers (e.g. CDP `Input.dispatchTouchEvent`) fire `touchEnd`
	 * with an empty `changedTouches` list, so we fall back to the final move
	 * coordinates to compute the swipe delta.
	 */
	private touchLastX: number | null = null;
	private touchLastY: number | null = null;

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

	ngOnDestroy(): void {
		// Nothing to clean up; HostListeners are removed automatically.
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
	// Keyboard navigation (document-level — works even when nothing is focused)
	// ------------------------------------------------------------------

	@HostListener('document:keydown', ['$event'])
	onKeyDown(event: KeyboardEvent): void {
		switch (event.key) {
			case 'ArrowRight':
			case ' ':
			case 'PageDown':
				event.preventDefault();
				this.navigate('next');
				break;
			case 'ArrowLeft':
			case 'PageUp':
				event.preventDefault();
				this.navigate('prev');
				break;
			case 'Home':
				event.preventDefault();
				this.navigate('first');
				break;
			case 'End':
				event.preventDefault();
				this.navigate('last');
				break;
			case 'Escape':
				event.preventDefault();
				this.emitClosed();
				break;
			default:
				break;
		}
	}

	// ------------------------------------------------------------------
	// Click handling
	// ------------------------------------------------------------------

	/** Left-click on the slide area advances to the next visible slide. */
	protected onBodyClick(event: MouseEvent): void {
		// button 0 = primary (left); right-click / middle-click are ignored.
		if (event.button !== 0) {
			return;
		}
		// A drawing tool owns pointer gestures — don't hijack them to advance.
		if (this.annotations.tool() !== 'none') {
			return;
		}
		this.navigate('next');
	}

	/** Toggle an annotation tool (clicking the active one disarms it). */
	protected selectTool(tool: 'pen' | 'highlighter' | 'eraser' | 'laser'): void {
		this.annotations.setTool(tool);
	}

	/** Toggle the live-caption (subtitle) bar. */
	protected toggleSubtitles(): void {
		this.subtitlesVisible.update((v) => !v);
	}

	/** Close button click — stop propagation so it does not also advance. */
	protected onClose(event: MouseEvent): void {
		event.stopPropagation();
		this.emitClosed();
	}

	/**
	 * Close button touch — stop propagation and prevent the synthesized click
	 * so a tap exits without bubbling to the tap-advance handler.
	 */
	protected onCloseTouch(event: TouchEvent): void {
		event.stopPropagation();
		event.preventDefault();
		this.emitClosed();
	}

	/** Previous-edge button — stop propagation so the tap does not double-fire. */
	protected onPrev(event: MouseEvent): void {
		event.stopPropagation();
		this.navigate('prev');
	}

	protected onPrevTouch(event: TouchEvent): void {
		event.stopPropagation();
		event.preventDefault();
		this.navigate('prev');
	}

	/** Next-edge button — stop propagation so the tap does not double-fire. */
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
	// Swipe handling (touch devices have no keyboard)
	// ------------------------------------------------------------------

	/** Record the initial touch position. */
	protected onTouchStart(event: TouchEvent): void {
		const touch = event.changedTouches[0];
		if (!touch) {
			this.touchStartX = null;
			this.touchStartY = null;
			this.touchLastX = null;
			this.touchLastY = null;
			return;
		}
		this.touchStartX = touch.clientX;
		this.touchStartY = touch.clientY;
		this.touchLastX = touch.clientX;
		this.touchLastY = touch.clientY;
	}

	/** Track the latest gesture position so touchend can compute the delta even
	 *  when the touchend event carries no `changedTouches`. */
	protected onTouchMove(event: TouchEvent): void {
		const touch = event.changedTouches[0] ?? event.touches[0];
		if (touch) {
			this.touchLastX = touch.clientX;
			this.touchLastY = touch.clientY;
		}
	}

	/**
	 * On touchend, treat a predominantly horizontal drag past the threshold as a
	 * swipe: left-swipe → next, right-swipe → prev.
	 */
	protected onTouchEnd(event: TouchEvent): void {
		const startX = this.touchStartX;
		const startY = this.touchStartY;
		const lastX = this.touchLastX;
		const lastY = this.touchLastY;
		this.touchStartX = null;
		this.touchStartY = null;
		this.touchLastX = null;
		this.touchLastY = null;
		if (startX === null || startY === null) {
			return;
		}
		// Prefer the touchend coordinates; fall back to the last touchmove
		// position (CDP dispatches touchEnd with an empty changedTouches list).
		const touch = event.changedTouches[0];
		const endX = touch ? touch.clientX : lastX;
		const endY = touch ? touch.clientY : lastY;
		if (endX === null || endY === null) {
			return;
		}
		const dx = endX - startX;
		const dy = endY - startY;
		// Require a mostly-horizontal gesture past the threshold.
		if (Math.abs(dx) < PresentationOverlayComponent.SWIPE_THRESHOLD) {
			return;
		}
		if (Math.abs(dx) <= Math.abs(dy)) {
			return;
		}
		if (dx < 0) {
			this.navigate('next');
		} else {
			this.navigate('prev');
		}
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

		// On forward navigation, first reveal the next click-group of element
		// animations; only advance the slide once the slide's builds are exhausted.
		if (direction === 'next' && this.playback.advance()) {
			return;
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

		if (next !== current) {
			// Play the incoming slide's transition (if any) over the new slide,
			// animating the outgoing slide out. Forward navigation only — matching
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

	private emitClosed(): void {
		this.closed.emit();
	}
}
