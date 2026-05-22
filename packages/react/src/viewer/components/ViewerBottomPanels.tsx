/**
 * ViewerBottomPanels — SlideNotesPanel + StatusBar wrapper.
 *
 * Renders the bottom section of the viewer (notes panel and status bar)
 * when the viewer is not in presentation mode.
 */
import type { PptxSlide, TextSegment } from 'pptx-viewer-core';

import type { AutosaveStatus } from '../hooks/useAutosave';
import type { ViewerMode } from '../types-core';
import { ResizeHandle } from './ResizeHandle';
import { SlideNotesPanel } from './SlideNotesPanel';
import { StatusBar } from './StatusBar';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface ViewerBottomPanelsProps {
	activeSlide: PptxSlide | undefined;
	allSlides?: PptxSlide[];
	isSlideNotesCollapsed: boolean;
	canEdit: boolean;
	slideCount: number;
	activeSlideIndex: number;
	isDirty: boolean;
	autosaveStatus?: AutosaveStatus;
	onToggleNotes: () => void;
	onUpdateNotes: (text: string, segments?: TextSegment[]) => void;
	/** Optional collaboration status indicator rendered in the status bar row. */
	collaborationSlot?: React.ReactNode;
	/** Height of the notes panel in pixels (for resizable panels). */
	notesPanelHeight?: number;
	/** Callback to resize the bottom panel. */
	onResizeBottom?: (delta: number) => void;
	/** Current zoom scale. */
	scale?: number;
	/** Zoom in callback. */
	onZoomIn?: () => void;
	/** Zoom out callback. */
	onZoomOut?: () => void;
	/** Zoom to fit callback. */
	onZoomToFit?: () => void;
	/** Current viewer mode. */
	mode?: ViewerMode;
	/** Switch viewer mode. */
	onSetMode?: (mode: ViewerMode) => void;
	/** Toggle slide sorter view. */
	onToggleSlideSorter?: () => void;
	/** When true, the StatusBar row is omitted (mobile uses MobileBottomBar instead). */
	hideStatusBar?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ViewerBottomPanels({
	activeSlide,
	allSlides,
	isSlideNotesCollapsed,
	canEdit,
	slideCount,
	activeSlideIndex,
	isDirty,
	autosaveStatus,
	onToggleNotes,
	onUpdateNotes,
	collaborationSlot,
	notesPanelHeight,
	onResizeBottom,
	scale,
	onZoomIn,
	onZoomOut,
	onZoomToFit,
	mode,
	onSetMode,
	onToggleSlideSorter,
	hideStatusBar = false,
}: ViewerBottomPanelsProps): React.ReactElement {
	return (
		<>
			{onResizeBottom && !isSlideNotesCollapsed && (
				<ResizeHandle direction='vertical' onResize={onResizeBottom} />
			)}
			<SlideNotesPanel
				activeSlide={activeSlide}
				allSlides={allSlides}
				isExpanded={!isSlideNotesCollapsed}
				canEdit={canEdit}
				onToggle={onToggleNotes}
				onUpdateNotes={onUpdateNotes}
				panelHeight={notesPanelHeight}
			/>
			{!hideStatusBar && (
				<StatusBar
					slideCount={slideCount}
					activeSlideIndex={activeSlideIndex}
					isDirty={isDirty}
					autosaveStatus={autosaveStatus}
					scale={scale}
					onZoomIn={onZoomIn}
					onZoomOut={onZoomOut}
					onZoomToFit={onZoomToFit}
					isNotesExpanded={!isSlideNotesCollapsed}
					onToggleNotes={onToggleNotes}
					mode={mode}
					onSetMode={onSetMode as ((mode: 'edit' | 'present') => void) | undefined}
					onToggleSlideSorter={onToggleSlideSorter}
					collaborationSlot={collaborationSlot}
				/>
			)}
		</>
	);
}
