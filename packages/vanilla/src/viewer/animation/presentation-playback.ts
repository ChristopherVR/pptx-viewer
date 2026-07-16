import type { PptxSlide } from 'pptx-viewer-core';
import {
	buildPresentationClickGroups,
	pendingElementStyles,
	revealedElementStyles,
} from 'pptx-viewer-shared';
import type { AnimationClickGroup } from 'pptx-viewer-shared';

import { applyAnimationStyles, ensurePresentationKeyframes } from './animation-dom';
import { playTransitionOverlay } from './transition-overlay';

/** Everything the controller needs after a stage (re)render. */
export interface SyncStageParams {
	doc: Document;
	/** The stage host (position: relative), for layering a transition overlay. */
	stageWrap: HTMLElement;
	/** The freshly rendered, fully-visible main stage node. */
	stage: HTMLElement;
	/** The slide the stage renders, or `undefined` when empty. */
	slide: PptxSlide | undefined;
	/** Zero-based index of the rendered slide. */
	slideIndex: number;
	/** True only when the live (fullscreen) presentation stage is active. */
	presenting: boolean;
	/** Presentation-level switch parsed from `p:showPr`. */
	showWithAnimation?: boolean;
}

/**
 * The presentation-mode playback state machine for the vanilla binding.
 *
 * It owns the click-stepped animation cursor and the slide-transition overlay,
 * both driven by the shared framework-agnostic helpers. It is consulted from
 * two seams in the rebuild-per-change render flow:
 *
 *  - {@link PresentationPlayback.syncStage} runs after every stage render:
 *    on a slide entry it rebuilds the click groups, resets the step, hides
 *    pending entrances, and (when the slide changed mid-show) plays the
 *    incoming slide's transition over a snapshot of the outgoing stage.
 *  - {@link PresentationPlayback.advance} runs on each forward navigation
 *    key/tap while presenting: it reveals the next animation build in place
 *    (no rebuild) and reports whether a build remained, so the caller only
 *    advances the slide once the timeline is exhausted.
 */
export interface PresentationPlayback {
	/**
	 * Reveal the next on-click animation build for the current slide. Returns
	 * `true` if a build was revealed (stay on the slide); `false` when the
	 * slide's builds are exhausted (the caller should advance to the next slide).
	 */
	advance(): boolean;
	/** True when every click group on the current slide has been revealed. */
	isComplete(): boolean;
	/** Sync playback + transitions after a stage (re)render. */
	syncStage(params: SyncStageParams): void;
	/** Cancel any running transition and forget all per-slide state. */
	reset(): void;
}

export function createPresentationPlayback(): PresentationPlayback {
	let groups: AnimationClickGroup[] = [];
	let step = 0;
	let currentStage: HTMLElement | null = null;
	// The last presented stage node, kept as the outgoing snapshot for the next
	// slide's transition (detached by `replaceChildren`, re-attached on demand).
	let previousStage: HTMLElement | null = null;
	let lastIndex = -1;
	let wasPresenting = false;
	let cancelTransition: (() => void) | null = null;

	const stopTransition = (): void => {
		if (cancelTransition) {
			cancelTransition();
			cancelTransition = null;
		}
	};

	const applyCurrentStep = (stage: HTMLElement): void => {
		applyAnimationStyles(
			stage,
			revealedElementStyles(groups, step),
			pendingElementStyles(groups, step),
		);
	};

	return {
		advance() {
			if (step >= groups.length) {
				return false;
			}
			step += 1;
			if (currentStage) {
				applyCurrentStep(currentStage);
			}
			return true;
		},

		isComplete() {
			return step >= groups.length;
		},

		syncStage(params) {
			// The old stage DOM is gone (rebuilt); cancel any overlay bound to it.
			stopTransition();

			if (!params.presenting) {
				groups = [];
				step = 0;
				currentStage = null;
				previousStage = null;
				lastIndex = params.slideIndex;
				wasPresenting = false;
				return;
			}

			ensurePresentationKeyframes(params.doc);

			const entering = !wasPresenting;
			const slideChanged = params.slideIndex !== lastIndex;

			if (entering || slideChanged) {
				groups = buildPresentationClickGroups(
					params.slide?.animations ?? [],
					params.showWithAnimation,
				);
				step = 0;
			}

			// Play the incoming slide's transition when the slide changed during a
			// running show (never on the initial enter, and only with a snapshot of
			// the outgoing stage to animate away).
			const transition = params.slide?.transition;
			if (
				!entering &&
				slideChanged &&
				previousStage &&
				transition &&
				transition.type &&
				transition.type !== 'none'
			) {
				// Clone the incoming stage while it is still fully visible, before the
				// step-0 pending styles hide its entrance elements underneath.
				const incoming = params.stage.cloneNode(true) as HTMLElement;
				cancelTransition = playTransitionOverlay({
					doc: params.doc,
					stageWrap: params.stageWrap,
					outgoing: previousStage,
					incoming,
					transition,
					onDone: () => {
						cancelTransition = null;
					},
				});
			}

			applyCurrentStep(params.stage);

			currentStage = params.stage;
			previousStage = params.stage;
			lastIndex = params.slideIndex;
			wasPresenting = true;
		},

		reset() {
			stopTransition();
			groups = [];
			step = 0;
			currentStage = null;
			previousStage = null;
			lastIndex = -1;
			wasPresenting = false;
		},
	};
}
