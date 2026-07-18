import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type React from 'react';

import type { CanvasSize, SlideSectionGroup } from '../../types';
import type { TableStyleContext } from '../../utils/table-band-style';
import type { FieldSubstitutionContext } from '../../utils/text-field-substitution';

// ---------------------------------------------------------------------------
// SlidesPaneSidebar props
// ---------------------------------------------------------------------------

export interface SlidesPaneSidebarProps {
	slides: PptxSlide[];
	templateElementsBySlideId: Record<string, PptxElement[]>;
	activeSlideIndex: number;
	canvasSize: CanvasSize;
	sectionGroups: SlideSectionGroup[];
	isOpen: boolean;
	canEdit: boolean;
	onSelectSlide: (index: number) => void;
	onSlideContextMenu: (e: React.MouseEvent, index: number) => void;
	onMoveSlide: (fromIndex: number, toIndex: number) => void;
	onAddSlide: () => void;
	onCollapse: () => void;
	onAddSection?: (name: string, afterSlideIndex: number) => void;
	onRenameSection?: (sectionId: string, newName: string) => void;
	onDeleteSection?: (sectionId: string) => void;
	onMoveSectionUp?: (sectionId: string) => void;
	onMoveSectionDown?: (sectionId: string) => void;
	/** Recorded rehearsal timings in ms, keyed by slide index. */
	rehearsalTimings?: Record<number, number>;
	/** Width of the panel in pixels (for resizable panels). */
	panelWidth?: number;
	/**
	 * Presentation-wide field context (date/header/footer/custom props) so
	 * thumbnails substitute the same field placeholders as the canvas.
	 */
	fieldContext?: FieldSubstitutionContext;
	/** Theme + table style map so thumbnails resolve table band/header colours. */
	tableStyleContext?: TableStyleContext;
}

// ---------------------------------------------------------------------------
// Context-menu state shapes
// ---------------------------------------------------------------------------

export interface SectionContextMenuState {
	x: number;
	y: number;
	sectionId: string;
	sectionIndex: number;
	totalSections: number;
}

export interface SlideContextMenuState {
	x: number;
	y: number;
	slideIndex: number;
}
