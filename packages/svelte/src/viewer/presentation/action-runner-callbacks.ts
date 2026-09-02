import type { PresentationActionRunner } from 'pptx-viewer-shared';
import {
	applyMediaCommandVerb,
	findMediaElementByElementId,
	firstShowSlideIndex,
	resolveShowSlideIndexes,
	safeOpenUrl,
} from 'pptx-viewer-shared';

import type { PresentationControllerDeps } from './presentation-controller.svelte';

/** Set while a `ppaction://customshow?...&return=true` sub-show is running. */
export interface CustomShowReturnState {
	previousId: string | null;
	originIndex: number;
}

/**
 * Builds the wave-4 B7 half of `PresentationActionRunner` (`lastViewed`,
 * `customShow`, `openFile`, `openPresentation`, `playMedia`, `oleVerb`):
 * split out of `PresentationController.handleStageClick` to keep that file
 * under the repo's file-size budget. Pure glue over `deps` plus the small bit
 * of cross-click state (`getLastViewedIndex`, `getCustomShowReturn` /
 * `setCustomShowReturn`) the controller owns, since a `return=true` sub-show
 * has to be restored by a LATER `advance()` call, not by this click itself.
 */
export function buildWaveFourActionCallbacks(
	deps: PresentationControllerDeps,
	getLastViewedIndex: () => number | undefined,
	setCustomShowReturn: (next: CustomShowReturnState | null) => void,
): Pick<
	PresentationActionRunner,
	'lastViewed' | 'customShow' | 'openFile' | 'openPresentation' | 'playMedia' | 'oleVerb'
> {
	return {
		lastViewed: () => {
			const lastViewed = getLastViewedIndex();
			if (lastViewed !== undefined) {
				deps.navigate(lastViewed);
			}
		},
		customShow: (customShowId, returnAfter) => {
			const show = deps.getCustomShows?.().find((entry) => entry.id === customShowId);
			if (!show) {
				return;
			}
			if (returnAfter) {
				setCustomShowReturn({
					previousId: deps.getActiveCustomShowId?.() ?? null,
					originIndex: deps.getCurrentIndex(),
				});
			}
			deps.setActiveCustomShowId?.(customShowId);
			const first = firstShowSlideIndex(resolveShowSlideIndexes(deps.getSlides(), show));
			if (first !== undefined) {
				deps.navigate(first);
			}
		},
		// `openFile` / `openPresentation` both open an external target the same
		// way an on-slide text hyperlink does: a new tab, gated by the same
		// safety check, `noopener`.
		openFile: (fileTarget) => safeOpenUrl(fileTarget),
		openPresentation: (presentationTarget) => safeOpenUrl(presentationTarget),
		playMedia: (elementId) => {
			if (!elementId) {
				return;
			}
			const el = findMediaElementByElementId(elementId, deps.getFrameRoot?.() ?? null);
			if (el) {
				applyMediaCommandVerb(el, { verb: 'togglePlay' });
			}
		},
		// No general-purpose "activate an embedded OLE object" action exists on
		// the live show stage in this binding (OleView's own Download/Open
		// affordance is editor-canvas-only), so this stays a documented no-op
		// rather than throwing.
		oleVerb: () => undefined,
	};
}
