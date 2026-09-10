import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	effect,
	inject,
	input,
	output,
} from '@angular/core';
import type { PptxElement, PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import { applySlideTransitionSound, buildMorphScopedCss } from '../internal/shared';
import { playAnimationSound, stopAnimationSound } from './animation-sound';
import { FragmentedTransitionLayerComponent } from './fragmented-transition-layer.component';
import { MorphExtraLayersComponent } from './morph-extra-layers.component';
import { createTransitionOverlayState } from './presentation-transition-overlay-state';
import { SlideCanvasComponent } from './slide-canvas.component';
import { ensureTransitionKeyframes } from './transition-keyframes';

export {
	classicIncomingLayerSlide,
	morphCrossfadeGroupSlides,
	morphLiftedSlide,
} from './presentation-transition-overlay-morph';
export type { MorphCrossfadeGroupSlides } from './presentation-transition-overlay-morph';

/** Safety margin (ms) added to the animation duration before firing complete. */
const COMPLETE_MARGIN_MS = 50;

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
 *   - `zoom`            : the stage's live zoom, so the outgoing slide animates
 *                         at the same size as the incoming one
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
	imports: [
		NgStyle,
		SlideCanvasComponent,
		FragmentedTransitionLayerComponent,
		MorphExtraLayersComponent,
	],
	styleUrl: './presentation-transition-overlay.component.css',
	templateUrl: './presentation-transition-overlay.component.html',
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
	/**
	 * The stage's live zoom (the same value the underlying `pptx-slide-canvas`
	 * renders at). The outgoing layer MUST use it: left at 1 the leaving slide
	 * animates out at its intrinsic size over a full-screen incoming slide,
	 * which reads as the slide snapping small the instant a transition starts.
	 */
	readonly zoom = input<number>(1);
	/**
	 * The arriving slide. Required only for Morph, which has to match shapes
	 * across both slides; every other transition ignores it.
	 */
	readonly incomingSlide = input<PptxSlide | undefined>(undefined);

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
	/** Whether `complete` has already fired for the current run. */
	private fired = false;

	constructor() {
		ensureTransitionKeyframes();

		// Re-arm the completion timer + sound whenever the transition or its
		// resolved duration changes.
		effect(() => {
			const ms = this.resolvedDurationMs();
			this.applyTransitionSound(this.transition());
			this.armCompletion(ms);
		});

		// Morph keyframes + per-element rules. They must reach the LIVE stage,
		// which is a sibling component, so they are injected at document level.
		// Element ids embed their slide path, so unscoped rules cannot leak onto
		// another slide's elements.
		effect(() => {
			const plan = this.morphPlan();
			this.applyMorphStyle(
				plan
					? [
							buildMorphScopedCss(plan, '', 'incoming'),
							buildMorphScopedCss(plan, 'data-pptx-morph-outgoing', 'outgoing'),
							// Scoped, so it outranks the unscoped `incoming` rule that holds
							// the stage's copy of the same element invisible.
							buildMorphScopedCss(plan, 'data-pptx-morph-lifted', 'lifted'),
						].join('\n')
					: null,
			);
		});

		this.destroyRef.onDestroy(() => {
			this.clearTimer();
			stopAnimationSound();
			this.applyMorphStyle(null);
		});
	}

	/** Owned `<style>` element carrying the active morph rules, if any. */
	private morphStyle: HTMLStyleElement | null = null;

	private applyMorphStyle(css: string | null): void {
		if (typeof document === 'undefined') {
			return;
		}
		if (css === null) {
			this.morphStyle?.remove();
			this.morphStyle = null;
			return;
		}
		if (!this.morphStyle) {
			this.morphStyle = document.createElement('style');
			document.head.appendChild(this.morphStyle);
		}
		this.morphStyle.textContent = css;
	}

	// ------------------------------------------------------------------
	// Derived state (see `presentation-transition-overlay-state.ts`)
	// ------------------------------------------------------------------

	private readonly state = createTransitionOverlayState({
		outgoingSlide: this.outgoingSlide,
		incomingSlide: this.incomingSlide,
		canvasSize: this.canvasSize,
		transition: this.transition,
		templateElements: this.templateElements,
		durationMs: this.durationMs,
		zoom: this.zoom,
	});

	protected readonly resolvedDurationMs = this.state.resolvedDurationMs;
	protected readonly animations = this.state.animations;
	protected readonly fragmented = this.state.fragmented;
	protected readonly fragmentedOutgoing = this.state.fragmentedOutgoing;
	protected readonly fragmentedIncoming = this.state.fragmentedIncoming;
	protected readonly fragmentedOutgoingZIndex = this.state.fragmentedOutgoingZIndex;
	protected readonly fragmentedIncomingZIndex = this.state.fragmentedIncomingZIndex;
	protected readonly incomingFragmentSlide = this.state.incomingFragmentSlide;
	protected readonly morphPlan = this.state.morphPlan;
	protected readonly isMorph = this.state.isMorph;
	protected readonly layerSlide = this.state.layerSlide;
	protected readonly liftedSlide = this.state.liftedSlide;
	protected readonly crossfadeGroups = this.state.crossfadeGroups;
	protected readonly layerStyle = this.state.layerStyle;
	protected readonly incomingLayerSlide = this.state.incomingLayerSlide;
	protected readonly incomingLayerStyle = this.state.incomingLayerStyle;
	protected readonly slideBoxStyle = this.state.slideBoxStyle;

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

	/**
	 * Play or stop this transition's sound action (`p:sndAc/p:stSnd`/`p:endSnd`).
	 *
	 * `transition.soundPath` is a raw in-archive path (e.g. `ppt/media/media3.wav`)
	 * that a bare `Audio` element constructed straight from it cannot fetch; it
	 * must be resolved through `mediaDataUrls()`, the same Blob-URL cache
	 * `load-content.service.ts`
	 * pre-populates via `collectAnimationSoundPaths` (extended to also collect
	 * `slide.transition?.soundPath` alongside per-effect animation sounds).
	 * Reuses the shared per-effect sound singleton (`animation-sound.ts`) rather
	 * than a private `Audio` element, so a transition sound and an animation
	 * sound cannot talk over each other, matching PowerPoint's "one sound plays
	 * at a time" behaviour.
	 */
	private applyTransitionSound(transition: PptxSlideTransition): void {
		applySlideTransitionSound(transition, (soundPath) => this.mediaDataUrls().get(soundPath), {
			play: playAnimationSound,
			stop: stopAnimationSound,
		});
	}
}
