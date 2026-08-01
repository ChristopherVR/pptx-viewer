import type { PptxAction } from 'pptx-viewer-core';
import { runPresentationAction } from 'pptx-viewer-shared';

import type { ViewerMode } from '../../types';

// ---------------------------------------------------------------------------
// Presentation action handler
// ---------------------------------------------------------------------------

export interface PresentationActionDeps {
	movePresentationSlide: (direction: 1 | -1) => void;
	navigateToSlide: (slideIndex: number) => void;
	onPlayActionSound?: (soundPath: string, options?: { loop?: boolean }) => void;
	onSetMode: (mode: ViewerMode) => void;
	slidesLength: number;
}

/**
 * Handle a presentation action (action buttons, hyperlinks, slide jumps).
 *
 * The verb table itself lives in `pptx-viewer-shared`
 * (`resolvePresentationAction`): it used to live here, which is why the other
 * four bindings had no way to follow an on-slide action at all. This is now
 * only the React-flavoured wiring of that decision onto the show's navigation.
 */
export function handlePresentationActionImpl(
	action: PptxAction,
	deps: PresentationActionDeps,
): void {
	runPresentationAction(
		action,
		{ slideCount: deps.slidesLength },
		{
			goToSlide: (slideIndex) => {
				deps.navigateToSlide(slideIndex);
			},
			move: (direction) => {
				deps.movePresentationSlide(direction);
			},
			endShow: () => {
				deps.onSetMode('edit');
			},
			playSound: deps.onPlayActionSound
				? (soundPath) => deps.onPlayActionSound?.(soundPath)
				: undefined,
		},
	);
}
