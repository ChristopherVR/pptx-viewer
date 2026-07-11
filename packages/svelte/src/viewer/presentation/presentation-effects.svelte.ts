import type { PptxSlide } from 'pptx-viewer-core';
import type { CSSProperties } from 'pptx-viewer-shared';
import { untrack } from 'svelte';

import { applyAnimationStyles } from './apply-animation-styles';
import type { PresentationController } from './presentation-controller.svelte';

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
 *  2. Push the current build styles onto the live stage after every DOM update
 *     (slide change / build advance). When not presenting it clears the managed
 *     properties so the windowed / editing canvas never carries animation state.
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
}

const EMPTY_STYLES: Map<string, CSSProperties> = new Map();

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

	// (2) Apply the current build styles to the live stage after each DOM update.
	$effect(() => {
		const presenting = deps.getPresenting();
		// Track slide identity so this re-runs after the stage re-renders its
		// (freshly-keyed) element nodes on navigation.
		void deps.getActiveSlide();
		const revealed = deps.controller.elementStyles;
		const pending = deps.controller.pendingStyles;
		const root = deps.getStageRoot();
		if (!root) {
			return;
		}
		if (!presenting) {
			applyAnimationStyles(root, EMPTY_STYLES, EMPTY_STYLES);
			return;
		}
		applyAnimationStyles(root, revealed, pending);
	});
}
