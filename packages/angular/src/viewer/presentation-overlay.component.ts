import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	HostListener,
	OnDestroy,
	OnInit,
	computed,
	input,
	output,
	signal,
} from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import {
	clampIndex,
	fitZoom,
	nextVisibleIndex,
	prevVisibleIndex,
} from './presentation-overlay-helpers';
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
 * Click on the overlay body → advance to next visible slide.
 */
@Component({
	selector: 'pptx-presentation-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SlideCanvasComponent],
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
	`,
	template: `
		<div
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
			/>
		</div>

		<div class="pptx-ng-presentation-hud" [ngStyle]="hudStyle">
			<button
				type="button"
				class="pptx-ng-presentation-close"
				[ngStyle]="closeButtonStyle"
				(click)="onClose($event)"
				aria-label="Exit presentation"
			>
				&#x2715;
			</button>
			<span class="pptx-ng-presentation-counter" [ngStyle]="counterStyle">
				{{ counterLabel() }}
			</span>
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
	// Static HUD styles (no dynamic data → plain objects, not computed)
	// ------------------------------------------------------------------

	protected readonly hudStyle: Record<string, string> = {
		position: 'fixed',
		top: '0',
		right: '0',
		display: 'flex',
		'align-items': 'center',
		gap: '0.75rem',
		padding: '0.5rem 0.75rem',
		background: 'rgba(0,0,0,0.55)',
		'border-bottom-left-radius': '6px',
		'z-index': '10001',
		color: '#fff',
		'font-family': 'system-ui, sans-serif',
		'font-size': '0.875rem',
		'pointer-events': 'none',
	};

	protected readonly closeButtonStyle: Record<string, string> = {
		background: 'none',
		border: 'none',
		color: '#fff',
		cursor: 'pointer',
		'font-size': '1rem',
		padding: '0.25rem 0.5rem',
		'border-radius': '4px',
		'pointer-events': 'auto',
		'line-height': '1',
	};

	protected readonly counterStyle: Record<string, string> = {
		'pointer-events': 'none',
	};

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
		this.navigate('next');
	}

	/** Close button click — stop propagation so it does not also advance. */
	protected onClose(event: MouseEvent): void {
		event.stopPropagation();
		this.emitClosed();
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
			this.currentIndex.set(next);
			this.indexChange.emit(next);
		}
	}

	private emitClosed(): void {
		this.closed.emit();
	}
}
