/**
 * animation-playback.service.ts: Angular port of the Vue
 * `useAnimationPlayback` composable and the React `useAnimationPlayback` hook.
 *
 * Drives click-stepped animation playback for presentation mode. A slide's
 * ordered {@link PptxElementAnimation} list is split into "click groups"
 * (see {@link buildClickGroups}); advancing one step reveals one more group.
 *
 * The service is signal-based:
 *   - {@link setAnimations} feeds the current slide's animations.
 *   - {@link setExternalIndex} keeps playback in sync with a parent click index
 *     (e.g. the presentation overlay's per-slide build counter); calling
 *     {@link advance} / {@link play} / {@link reset} records a manual override.
 *   - {@link elementStyles} / {@link pendingStyles} are derived `Map`s of the
 *     CSS to apply (revealed) and to pre-seed-hidden (pending) per element id.
 *
 * Optional auto-play (e.g. for `afterPrevious` chains or kiosk timing) is driven
 * by `requestAnimationFrame`, cleaned up via `DestroyRef.onDestroy`.
 *
 * Provide it at the component level so its lifetime tracks the host overlay:
 * `@Component({ providers: [AnimationPlaybackService] })`.
 */

import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { PptxElementAnimation } from 'pptx-viewer-core';

import type { AnimationClickGroup, CSSProperties } from './animation-playback-helpers';
import {
	advanceStep,
	buildClickGroups,
	clampStep,
	pendingElementStyles,
	revealedElementStyles,
} from './animation-playback-helpers';

@Injectable()
export class AnimationPlaybackService {
	private readonly destroyRef = inject(DestroyRef);

	// ------------------------------------------------------------------
	// Inputs (set by the host)
	// ------------------------------------------------------------------

	/** The current slide's animations, in document/timeline order. */
	private readonly animations = signal<readonly PptxElementAnimation[]>([]);

	/**
	 * Externally-controlled playback step (e.g. derived from a parent click
	 * counter). `undefined` means there is no external driver. The internal
	 * manual step (set via advance/play/reset) takes precedence when present.
	 */
	private readonly externalIndex = signal<number | undefined>(undefined);

	/**
	 * Internal, unclamped step. `null` means "follow the external index"; any
	 * number means the host has taken manual control via advance/play/reset.
	 */
	private readonly manualStep = signal<number | null>(null);

	// ------------------------------------------------------------------
	// Derived state
	// ------------------------------------------------------------------

	/** Click groups for the current slide's animations. */
	readonly groups = computed<AnimationClickGroup[]>(() => buildClickGroups(this.animations()));

	/** Number of click groups on this slide (i.e. how many `advance()` steps). */
	readonly groupCount = computed<number>(() => this.groups().length);

	/**
	 * The current playback step: how many click groups have been revealed.
	 * Always clamped to the current group count. The manual override wins;
	 * otherwise it follows the external index, defaulting to 0.
	 */
	readonly step = computed<number>(() => {
		const manual = this.manualStep();
		const base = manual ?? this.externalIndex() ?? 0;
		return clampStep(base, this.groupCount());
	});

	/** True when every click group has been revealed. */
	readonly isComplete = computed<boolean>(() => this.step() >= this.groupCount());

	/**
	 * Reactive map of `elementId → CSS properties` to apply for the current step.
	 * Only elements in revealed click groups appear.
	 */
	readonly elementStyles = computed<Map<string, CSSProperties>>(() =>
		revealedElementStyles(this.groups(), this.step()),
	);

	/**
	 * Reactive map of `elementId → CSS properties` for elements whose entrance
	 * has not yet been revealed (they should be hidden so they don't flash
	 * visible before their group plays).
	 */
	readonly pendingStyles = computed<Map<string, CSSProperties>>(() =>
		pendingElementStyles(this.groups(), this.step()),
	);

	// ------------------------------------------------------------------
	// Auto-play (rAF) bookkeeping
	// ------------------------------------------------------------------

	/** Handle of the scheduled rAF auto-advance, or null when idle. */
	private rafHandle: number | null = null;

	constructor() {
		this.destroyRef.onDestroy(() => this.cancelAutoPlay());
	}

	// ------------------------------------------------------------------
	// Input setters
	// ------------------------------------------------------------------

	/** Feed the current slide's animation list. Resets manual control. */
	setAnimations(animations: readonly PptxElementAnimation[] | undefined): void {
		this.cancelAutoPlay();
		this.manualStep.set(null);
		this.animations.set(animations ?? []);
	}

	/** Update the external playback index (parent-driven build counter). */
	setExternalIndex(index: number | undefined): void {
		this.externalIndex.set(index);
	}

	// ------------------------------------------------------------------
	// Playback controls
	// ------------------------------------------------------------------

	/**
	 * Reveal the next click group. Returns `true` if a group was revealed,
	 * `false` if playback was already complete (so the caller can fall through
	 * to slide navigation).
	 */
	advance(): boolean {
		const count = this.groupCount();
		const current = this.step();
		if (current >= count) {
			return false;
		}
		this.manualStep.set(advanceStep(current, count));
		return true;
	}

	/** Reveal every click group at once (jump to the slide's final state). */
	play(): void {
		this.cancelAutoPlay();
		this.manualStep.set(this.groupCount());
	}

	/** Reset playback to before the first click group. */
	reset(): void {
		this.cancelAutoPlay();
		this.manualStep.set(0);
	}

	/**
	 * Jump directly to a given step (clamped to the group count) and take manual
	 * control. Useful for scrubbing.
	 */
	setStep(step: number): void {
		this.manualStep.set(clampStep(step, this.groupCount()));
	}

	/**
	 * Auto-advance through every remaining click group on the animation frame,
	 * one group per frame. Stops automatically once playback completes or the
	 * service is destroyed. A no-op when already complete or when
	 * `requestAnimationFrame` is unavailable (SSR).
	 */
	autoPlay(): void {
		this.cancelAutoPlay();
		if (typeof requestAnimationFrame === 'undefined') {
			// SSR / non-DOM: fall back to revealing everything synchronously.
			this.play();
			return;
		}
		const tick = (): void => {
			if (!this.advance()) {
				this.rafHandle = null;
				return;
			}
			this.rafHandle = requestAnimationFrame(tick);
		};
		this.rafHandle = requestAnimationFrame(tick);
	}

	/** Cancel any in-flight rAF auto-advance. */
	cancelAutoPlay(): void {
		if (this.rafHandle !== null && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(this.rafHandle);
		}
		this.rafHandle = null;
	}
}
