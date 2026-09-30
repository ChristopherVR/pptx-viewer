import type { PptxPresentationProperties } from 'pptx-viewer-core';
import type { ToolbarActionId } from 'pptx-viewer-shared';

import type { CustomShowsControlsProps } from './ribbon-types';

export interface SlideShowSectionProps {
	onPresent: () => void;
	/** Start > From Beginning: the show's first slide, unconditionally. */
	onPresentFromBeginning: () => void;
	onEnterPresenterView: () => void;
	onEnterRehearsalMode: () => void;
	onOpenSetUpSlideShow: () => void;
	/**
	 * PowerPoint's Hide Slide toggle: marks the ACTIVE slide to be skipped during
	 * the show while leaving it in the deck, the thumbnail rail and the sorter.
	 */
	onToggleHideSlide: () => void;
	/** Whether the active slide is hidden, for the toggle's pressed state. */
	activeSlideHidden: boolean;
	onOpenBroadcastDialog: () => void;
	onToggleSubtitles: () => void;
	showSubtitles: boolean;
	/** Everything the custom-show picker needs; see `CustomShowsControls.vue`. */
	customShowControls: CustomShowsControlsProps;
	/** Toolbar buttons the host has asked to hide (gates the Broadcast button below). */
	hiddenActions?: ToolbarActionId[];
	/** Deck presentation properties backing the Options checkboxes. */
	presentationProperties?: PptxPresentationProperties;
	/** Commit an Options checkbox onto the deck's presentation properties. */
	onPresentationPropertiesChange?: (updates: Partial<PptxPresentationProperties>) => void;
}
