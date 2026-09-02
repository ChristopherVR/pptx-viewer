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
	/** `ppaction://hlinkshowjump?jump=lastslideviewed`. */
	onLastViewed?: () => void;
	/** `ppaction://customshow?id=<id>[&return=true]`. */
	onCustomShow?: (customShowId: string, returnAfter: boolean) => void;
	/** `ppaction://hlinkfile`. */
	onOpenFile?: (target: string) => void;
	/** `ppaction://hlinkpres`. */
	onOpenPresentation?: (target: string) => void;
	/** `ppaction://media`: play/toggle the acting element's own embedded media. */
	onPlayMedia?: (elementId: string | undefined) => void;
	/** `ppaction://ole?verb=<n>`: open the acting element's recovered embedding. */
	onOleVerb?: (verb: number, elementId: string | undefined) => void;
	/**
	 * The element the action was clicked on, when known. `playMedia` and
	 * `oleVerb` act on THAT element rather than a navigation target, so
	 * dropping it (as the canvas click handler used to) turned both verbs into
	 * no-ops in this binding alone.
	 */
	elementId?: string;
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
		{ slideCount: deps.slidesLength, ...(deps.elementId ? { elementId: deps.elementId } : {}) },
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
			lastViewed: deps.onLastViewed,
			customShow: deps.onCustomShow,
			openFile: deps.onOpenFile,
			openPresentation: deps.onOpenPresentation,
			playMedia: deps.onPlayMedia,
			oleVerb: deps.onOleVerb,
		},
	);
}
