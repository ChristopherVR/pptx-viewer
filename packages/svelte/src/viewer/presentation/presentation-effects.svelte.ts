import type { PptxSlide } from 'pptx-viewer-core';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import { attachPresentationVisibilityPause } from 'pptx-viewer-shared';
import { untrack } from 'svelte';

import { applyAnimationStyles } from './apply-animation-styles';
import { syncNativeAnimationKeyframes } from './keyframes';
import { resolveSlideAutoAdvanceMs, ShowAutoAdvanceTimer } from './presentation-auto-advance';
import type { PresentationController } from './presentation-controller.svelte';
import { attachPresentationTriggerListeners } from './presentation-triggers';

/**
 * `usePresentationEffects`: the `$effect`-based wiring that drives the Svelte
 * viewer's presentation mode from its reactive state. Extracted from
 * `PowerPointViewer.svelte` (mirroring `useViewerEffects`) so the SFC stays thin
 * and this logic is lintable; runs during the component's setup exactly as if
 * inlined, since Svelte 5 effects only require synchronous registration.
 *
 * Two effects:
 *  1. Drive the {@link PresentationController} lifecycle from the fullscreen flag
 *     and current slide: `start()` on enter, `stop()` on exit, `onSlideChange()`
 *     on every in-presentation navigation (resets builds + plays the incoming
 *     slide's transition).
 *  2. Push each element's native-animation state (visibility, CSS animation,
 *     trigger-shape cursor) onto the live stage after every DOM update (slide
 *     change / build advance / auto-advance) and keep the per-slide native
 *     `@keyframes` injected. When not presenting it clears the managed
 *     properties so the windowed / editing canvas never carries animation state.
 *     Structural reveals (chart / SmartArt build, `p:animClr` fill / stroke) are
 *     applied declaratively by the renderers via the element-states context.
 *  3. Route interactive / hover trigger events on the live stage.
 *  4. Arm the current slide's authored `p:transition/@advTm` auto-advance.
 */
export interface PresentationEffectsDeps {
	controller: PresentationController;
	/** True while the viewer is the fullscreen (presentation) element. */
	getPresenting(): boolean;
	/** The active slide index (0-based). */
	getCurrentIndex(): number;
	/** The active slide (read so the style effect re-runs after it re-renders). */
	getActiveSlide(): PptxSlide | undefined;
	/** The live presentation stage root (`.pptx-svelte-stage`), or null. */
	getStageRoot(): HTMLElement | null;
	/**
	 * False when the show is set to advance manually
	 * (`PptxPresentationProperties.advanceMode === 'manual'`). Defaults to true,
	 * matching PowerPoint's "Using timings, if present".
	 */
	getUseTimings?(): boolean;
}

const EMPTY_STATES: Map<string, ElementAnimationState> = new Map();

export function usePresentationEffects(deps: PresentationEffectsDeps): void {
	// (1) Lifecycle: enter/exit presentation and in-presentation slide changes.
	let lastIndex = -1;
	let wasPresenting = false;
	$effect(() => {
		const presenting = deps.getPresenting();
		const index = deps.getCurrentIndex();
		if (!presenting) {
			if (wasPresenting) {
				wasPresenting = false;
				untrack(() => deps.controller.stop());
			}
			lastIndex = index;
			return;
		}
		if (!wasPresenting) {
			wasPresenting = true;
			lastIndex = index;
			untrack(() => deps.controller.start());
			return;
		}
		if (index !== lastIndex) {
			const previous = lastIndex;
			lastIndex = index;
			untrack(() => deps.controller.onSlideChange(previous, index));
		}
	});

	// (2) Apply each element's native-animation state to the live stage after each
	// DOM update, and keep the per-slide native `@keyframes` injected.
	$effect(() => {
		const presenting = deps.getPresenting();
		// Track slide identity so this re-runs after the stage re-renders its
		// (freshly-keyed) element nodes on navigation.
		void deps.getActiveSlide();
		const states = deps.controller.elementStates;
		const interactiveIds = deps.controller.interactiveTriggerShapeIds;
		const hoverIds = deps.controller.hoverTriggerShapeIds;
		syncNativeAnimationKeyframes(presenting ? deps.controller.keyframesCss : '');
		const root = deps.getStageRoot();
		if (!root) {
			return;
		}
		if (!presenting) {
			applyAnimationStyles(root, EMPTY_STATES);
			return;
		}
		applyAnimationStyles(root, states, interactiveIds, hoverIds);
	});

	// (3) Route interactive (onShapeClick) + hover (onHover) trigger events on the
	// live stage to their animation sequences. Non-trigger clicks still bubble to
	// the holder's tap-to-advance. Re-attached after the stage re-renders on
	// navigation; cleaned up on exit / slide change.
	$effect(() => {
		if (!deps.getPresenting()) {
			return;
		}
		// Re-run after the stage re-renders its (freshly-keyed) nodes on navigation.
		void deps.getActiveSlide();
		const root = deps.getStageRoot();
		if (!root) {
			return;
		}
		return attachPresentationTriggerListeners(root, deps.controller);
	});

	// (4) PowerPoint's "Advance slide: After <n>" timing (`p:transition/@advTm`).
	// Re-armed on every slide change; the effect's own cleanup cancels the
	// previous slide's pending timer first, so a manual advance can never leave a
	// stale timer running that skips the slide the presenter just moved to.
	//
	// Nothing is scheduled outside the show, on the end-of-show screen, or when
	// the show advances manually. Reading `endOfShowVisible` here is what makes
	// the end screen cancel the timer rather than tick past it. The timer itself
	// lives in `ShowAutoAdvanceTimer` so the visibility handler below can cancel
	// and re-arm it from outside this effect.
	const autoAdvance = new ShowAutoAdvanceTimer(() => {
		// Same contract as a Next press: reveal the slide's remaining animation
		// builds first, and only then step to the next slide.
		deps.controller.advance();
	});
	$effect(() => {
		autoAdvance.schedule(
			resolveSlideAutoAdvanceMs({
				presenting: deps.getPresenting(),
				slide: deps.getActiveSlide(),
				useTimings: deps.getUseTimings?.() ?? true,
				endOfShow: deps.controller.endOfShowVisible,
			}),
		);
		return () => autoAdvance.cancel();
	});

	// (5) A hidden tab is a paused show: the shared handler pauses the stage's
	// playing media and the cross-slide persistent audio while `document.hidden`,
	// and this wiring also cancels the pending auto-advance so the deck does not
	// run on unseen; everything resumes (and the current slide's timing re-arms
	// from scratch) when the tab is visible again. Attached only while the show
	// runs; the effect's cleanup detaches it on exit.
	$effect(() => {
		if (!deps.getPresenting()) {
			return;
		}
		return attachPresentationVisibilityPause({
			root: deps.getStageRoot() ?? undefined,
			onHidden: () => autoAdvance.cancel(),
			onVisible: () => autoAdvance.arm(),
		});
	});
}
