import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	computed,
	effect,
	inject,
	input,
	output,
} from '@angular/core';
import type { PptxElement, PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import type { StyleMap } from './element-style';
import { SlideCanvasComponent } from './slide-canvas.component';
import {
	SLIDE_TRANSITION_KEYFRAMES,
	getSlideTransitionAnimations,
	resolveTransitionDuration,
} from './transition-helpers';
import type { SlideTransitionAnimations } from './transition-helpers';

/** DOM id of the singleton <style> tag holding the transition keyframes. */
const KEYFRAMES_STYLE_ID = 'pptx-ng-slide-transition-keyframes';

/** Safety margin (ms) added to the animation duration before firing complete. */
const COMPLETE_MARGIN_MS = 50;

/**
 * Ensure the slide-transition `@keyframes` are present in the document head
 * exactly once. SSR/test-safe (no-op when there is no `document`).
 */
function ensureTransitionKeyframes(): void {
	if (typeof document === 'undefined') {
		return;
	}
	if (document.getElementById(KEYFRAMES_STYLE_ID)) {
		return;
	}
	const style = document.createElement('style');
	style.id = KEYFRAMES_STYLE_ID;
	style.textContent = SLIDE_TRANSITION_KEYFRAMES;
	document.head.appendChild(style);
}

/**
 * PresentationTransitionOverlayComponent: plays a PowerPoint slide transition
 * over the presentation stage.
 *
 * Renders the *outgoing* (previous) slide as an absolutely-positioned layer
 * with the resolved CSS exit animation; the *incoming* slide is rendered by the
 * underlying stage (the existing `pptx-presentation-overlay`). The `outgoingOnTop`
 * descriptor controls whether the outgoing layer sits above or below the stage,
 * letting cover/uncover/push read correctly. Fires `complete` once the animation
 * finishes so the orchestrator can tear the overlay down.
 *
 * Selector: `pptx-presentation-transition-overlay`
 *
 * Inputs:
 *   - `outgoingSlide`    (required): the leaving slide to animate
 *   - `canvasSize`       (required): logical slide dimensions (px)
 *   - `transition`       (required): the transition definition (from the slide)
 *   - `templateElements`: master/layout elements behind the outgoing slide
 *   - `mediaDataUrls`   : data-URL map for media assets
 *   - `durationMs`      : explicit override; otherwise derived from `transition`
 *
 * Outputs:
 *   - `complete`: emits void when the transition animation completes
 *
 * Designed to compose with `PresentationOverlayComponent` WITHOUT editing it:
 * the orchestrator stacks this overlay on top of the stage while a transition
 * is in flight and removes it on `complete`.
 */
@Component({
	selector: 'pptx-presentation-transition-overlay',
	host: { 'data-pptx-transition-overlay': '' },
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, SlideCanvasComponent],
	styles: `
		:host {
			display: block;
			position: absolute;
			inset: 0;
			overflow: hidden;
			pointer-events: none;
		}

		.pptx-ng-transition-layer {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	`,
	template: `
		<div
			class="pptx-ng-transition-layer"
			data-pptx-transition-layer="outgoing"
			[ngStyle]="layerStyle()"
		>
			<div [ngStyle]="slideBoxStyle()">
				<pptx-slide-canvas
					[slide]="layerSlide()"
					[canvasSize]="canvasSize()"
					[mediaDataUrls]="mediaDataUrls()"
					[zoom]="1"
					[interactive]="false"
				/>
			</div>
		</div>
	`,
})
export class PresentationTransitionOverlayComponent {
	// ------------------------------------------------------------------
	// Inputs
	// ------------------------------------------------------------------

	readonly outgoingSlide = input.required<PptxSlide>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly transition = input.required<PptxSlideTransition>();
	readonly templateElements = input<readonly PptxElement[]>([]);
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	/** Explicit duration override (ms). When omitted, derived from `transition`. */
	readonly durationMs = input<number | undefined>(undefined);

	// ------------------------------------------------------------------
	// Outputs
	// ------------------------------------------------------------------

	readonly complete = output<void>();

	// ------------------------------------------------------------------
	// Internal
	// ------------------------------------------------------------------

	private readonly destroyRef = inject(DestroyRef);
	/** Active completion timer handle, so re-running re-arms cleanly. */
	private completeTimer: ReturnType<typeof setTimeout> | null = null;
	/** Active transition-sound element, paused on teardown. */
	private audio: HTMLAudioElement | null = null;
	/** Whether `complete` has already fired for the current run. */
	private fired = false;

	constructor() {
		ensureTransitionKeyframes();

		// Re-arm the completion timer + sound whenever the transition or its
		// resolved duration changes.
		effect(() => {
			const ms = this.resolvedDurationMs();
			const soundPath = this.transition().soundPath;
			this.playSound(soundPath);
			this.armCompletion(ms);
		});

		this.destroyRef.onDestroy(() => {
			this.clearTimer();
			this.stopSound();
		});
	}

	// ------------------------------------------------------------------
	// Derived state
	// ------------------------------------------------------------------

	/** Effective transition duration (ms), floored/defaulted. */
	protected readonly resolvedDurationMs = computed<number>(() => {
		const override = this.durationMs();
		if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
			return override;
		}
		return resolveTransitionDuration(this.transition().durationMs);
	});

	/** Resolved CSS animation descriptors for the outgoing/incoming layers. */
	protected readonly animations = computed<SlideTransitionAnimations>(() => {
		const tr = this.transition();
		return getSlideTransitionAnimations(
			tr.type,
			this.resolvedDurationMs(),
			tr.direction,
			tr.orient,
			tr.spokes,
		);
	});

	/** The slide rendered in the animated layer (outgoing + its template). */
	protected readonly layerSlide = computed<PptxSlide>(() => {
		const slide = this.outgoingSlide();
		const template = this.templateElements();
		if (template.length === 0) {
			return slide;
		}
		return { ...slide, elements: [...template, ...slide.elements] };
	});

	/** Layer container style: animation + stacking relative to the stage. */
	protected readonly layerStyle = computed<StyleMap>(() => {
		const anims = this.animations();
		const style: StyleMap = {
			'z-index': anims.outgoingOnTop ? '40' : '20',
		};
		if (anims.outgoing !== 'none') {
			style['animation'] = anims.outgoing;
		}
		return style;
	});

	/** Fixed-size slide box (the SlideCanvas auto-fits within it). */
	protected readonly slideBoxStyle = computed<StyleMap>(() => {
		const size = this.canvasSize();
		return {
			width: `${Math.max(size.width, 1)}px`,
			height: `${Math.max(size.height, 1)}px`,
			'transform-origin': 'center',
		};
	});

	// ------------------------------------------------------------------
	// Completion timing + sound
	// ------------------------------------------------------------------

	private armCompletion(durationMs: number): void {
		this.clearTimer();
		this.fired = false;
		if (typeof setTimeout === 'undefined') {
			return;
		}
		this.completeTimer = setTimeout(() => {
			this.completeTimer = null;
			if (this.fired) {
				return;
			}
			this.fired = true;
			this.complete.emit();
		}, durationMs + COMPLETE_MARGIN_MS);
	}

	private clearTimer(): void {
		if (this.completeTimer !== null) {
			clearTimeout(this.completeTimer);
			this.completeTimer = null;
		}
	}

	private playSound(soundPath: string | undefined): void {
		this.stopSound();
		if (!soundPath || typeof Audio === 'undefined') {
			return;
		}
		const audio = new Audio(soundPath);
		this.audio = audio;
		// Browser autoplay policy may reject; ignore silently.
		void audio.play().catch(() => {});
	}

	private stopSound(): void {
		if (this.audio) {
			this.audio.pause();
			this.audio.src = '';
			this.audio = null;
		}
	}
}
