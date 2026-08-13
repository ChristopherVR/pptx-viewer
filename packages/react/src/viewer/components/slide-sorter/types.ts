import type { PptxSlide } from 'pptx-viewer-core';
import { SORTER_MAX_ZOOM, SORTER_MIN_ZOOM, SORTER_ZOOM_STEP } from 'pptx-viewer-shared';

import type { CanvasSize, SlideSectionGroup } from '../../types';

// ---------------------------------------------------------------------------
// Props for SlideSorterOverlay
// ---------------------------------------------------------------------------

export interface SlideSorterOverlayProps {
	slides: PptxSlide[];
	activeSlideIndex: number;
	canvasSize: CanvasSize;
	canEdit: boolean;
	sectionGroups: SlideSectionGroup[];
	onSelectSlide: (index: number) => void;
	onMoveSlide: (fromIndex: number, toIndex: number) => void;
	onDeleteSlides: (indexes: number[]) => void;
	onDuplicateSlides: (indexes: number[]) => void;
	onToggleHideSlides: (indexes: number[]) => void;
	onClose: () => void;
}

// ---------------------------------------------------------------------------
// Context menu state
// ---------------------------------------------------------------------------

export interface SorterContextMenuState {
	x: number;
	y: number;
	slideIndex: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// The zoom range and step are the shared sorter keymap's, not React's: the
// Ctrl+plus / Ctrl+minus chords clamp against them, so a local copy would let
// the keyboard and the zoom slider disagree about the bounds.
export const MIN_ZOOM = SORTER_MIN_ZOOM;
export const MAX_ZOOM = SORTER_MAX_ZOOM;
export const DEFAULT_ZOOM = 100;
export const ZOOM_STEP = SORTER_ZOOM_STEP;
