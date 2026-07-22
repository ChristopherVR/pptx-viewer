/**
 * The AI change animator: the framework-agnostic bus that carries "these
 * elements just changed, animate them" from the AI apply path to whichever
 * binding is rendering the canvas. The AI write choke points call
 * {@link AiChangeAnimator.publish} with the slides before and after an edit; the
 * binding subscribes, reveals the affected slide, and plays the motion + glow
 * for {@link ResolvedAiChangeAnimationConfig.durationMs}, then the batch clears.
 *
 * Timing (setTimeout) and the frame clock live here so bindings stay thin. A
 * `schedule` hook is injectable so tests can drive time deterministically.
 */

import type { PptxSlide } from 'pptx-viewer-core';

import type { AiElementChange } from './change-diff';
import { diffChangedElements } from './change-diff';

/** Host-tunable options for how AI edits are animated on the canvas. */
export interface AiChangeAnimationConfig {
	/** Master switch. Default true. */
	enabled?: boolean;
	/** How long the motion + glow plays, in ms. Default 900. */
	durationMs?: number;
	/** Draw the pulsing glow highlight on changed elements. Default true. */
	glow?: boolean;
	/** Glide old->new bounds and cross-fade colours. Default true. */
	tween?: boolean;
	/** Accent colour (any CSS colour) for the glow/ghosts. Default a blue. */
	color?: string;
}

/** Config with every field resolved to a concrete value. */
export interface ResolvedAiChangeAnimationConfig {
	enabled: boolean;
	durationMs: number;
	glow: boolean;
	tween: boolean;
	color: string;
}

const DEFAULTS: ResolvedAiChangeAnimationConfig = {
	enabled: true,
	durationMs: 900,
	glow: true,
	tween: true,
	color: 'rgba(59,130,246,1)',
};

/** Fill defaults into a partial change-animation config. */
export function resolveChangeAnimationConfig(
	config?: AiChangeAnimationConfig,
): ResolvedAiChangeAnimationConfig {
	return {
		enabled: config?.enabled ?? DEFAULTS.enabled,
		durationMs: config?.durationMs ?? DEFAULTS.durationMs,
		glow: config?.glow ?? DEFAULTS.glow,
		tween: config?.tween ?? DEFAULTS.tween,
		color: config?.color ?? DEFAULTS.color,
	};
}

/** One batch of changes to animate, plus the slide to reveal for it. */
export interface AiChangeBatch {
	changes: AiElementChange[];
	/** Slide index the first change lives on (reveal this to show the edit). */
	slideIndex: number;
	/** Monotonic id so a binding can restart its animation on each new batch. */
	nonce: number;
	config: ResolvedAiChangeAnimationConfig;
}

/** Subscribe/publish bus for AI change animations. */
export interface AiChangeAnimator {
	/**
	 * Diff `before` -> `after` and, when something visible changed and animations
	 * are enabled, broadcast a batch and schedule its clear. Returns the batch
	 * (so the caller can also navigate to `slideIndex`), or null on a no-op.
	 */
	publish(before: PptxSlide[], after: PptxSlide[]): AiChangeBatch | null;
	subscribe(listener: (batch: AiChangeBatch | null) => void): () => void;
	current(): AiChangeBatch | null;
	/** Update the resolved config (e.g. when the host toggles it live). */
	configure(config?: AiChangeAnimationConfig): void;
	dispose(): void;
}

/** A cancelable timer, so tests can inject a synchronous scheduler. */
export type ScheduleFn = (fn: () => void, ms: number) => () => void;

const defaultSchedule: ScheduleFn = (fn, ms) => {
	const id = setTimeout(fn, ms);
	return () => clearTimeout(id);
};

/**
 * Create an {@link AiChangeAnimator}. `schedule` defaults to setTimeout; pass a
 * synchronous stub in tests. The clear fires a short tail after `durationMs` so
 * the binding's exit transitions finish before the batch is dropped.
 */
export function createAiChangeAnimator(
	config?: AiChangeAnimationConfig,
	schedule: ScheduleFn = defaultSchedule,
): AiChangeAnimator {
	let resolved = resolveChangeAnimationConfig(config);
	let batch: AiChangeBatch | null = null;
	let nonce = 0;
	let cancelClear: (() => void) | null = null;
	const listeners = new Set<(b: AiChangeBatch | null) => void>();

	const emit = (): void => {
		for (const l of listeners) {
			l(batch);
		}
	};

	return {
		publish(before, after) {
			if (!resolved.enabled) {
				return null;
			}
			const changes = diffChangedElements(before, after);
			if (changes.length === 0) {
				return null;
			}
			cancelClear?.();
			nonce += 1;
			batch = { changes, slideIndex: changes[0].slideIndex, nonce, config: resolved };
			emit();
			cancelClear = schedule(() => {
				batch = null;
				cancelClear = null;
				emit();
			}, resolved.durationMs + 250);
			return batch;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		current: () => batch,
		configure(next) {
			resolved = resolveChangeAnimationConfig(next);
		},
		dispose() {
			cancelClear?.();
			cancelClear = null;
			listeners.clear();
			batch = null;
		},
	};
}
