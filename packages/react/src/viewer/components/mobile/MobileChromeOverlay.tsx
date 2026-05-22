import type { PptxSlide } from 'pptx-viewer-core';
import React from 'react';

import type { EditorOperationsResult } from '../../hooks/useEditorOperations';
import type { UsePresentationModeResult } from '../../hooks/usePresentationMode';
import type { ViewerState } from '../../hooks/useViewerState';
import type { CanvasSize, SlideSectionGroup } from '../../types';
import { MobileBottomBar } from './MobileBottomBar';
import { MobileSlidesSheet } from './MobileSlidesSheet';

export interface MobileChromeOverlayProps {
	state: ViewerState;
	editorOps: EditorOperationsResult;
	presentation: UsePresentationModeResult;
	slides: PptxSlide[];
	activeSlideIndex: number;
	canvasSize: CanvasSize;
	slideSectionGroups: SlideSectionGroup[];
	canEdit: boolean;
	commentCount?: number;
}

/**
 * Mobile-only floating chrome that owns the bottom action bar and the slide
 * pane sheet. The inspector / comments / notes already render as bottom
 * sheets via `max-md:` styling on their existing components, so this overlay
 * only needs to manage the slides pane (which is hidden inline on mobile).
 */
export function MobileChromeOverlay(props: MobileChromeOverlayProps): React.ReactElement {
	const {
		state: s,
		editorOps,
		presentation,
		slides,
		activeSlideIndex,
		canvasSize,
		slideSectionGroups,
		canEdit,
		commentCount,
	} = props;

	// Determine which mobile sheet is currently active for bar highlighting.
	const activeSheet: 'slides' | 'inspector' | 'comments' | 'notes' | null = s.isSlidesPaneOpen
		? 'slides'
		: s.isInspectorPaneOpen
			? s.sidebarPanelMode === 'comments'
				? 'comments'
				: 'inspector'
			: !s.isSlideNotesCollapsed
				? 'notes'
				: null;

	const closeAllSheets = () => {
		s.setIsSlidesPaneOpen(false);
		s.setIsInspectorPaneOpen(false);
		s.setIsSlideNotesCollapsed(true);
	};

	const openSheet = (which: 'slides' | 'inspector' | 'comments' | 'notes') => {
		closeAllSheets();
		switch (which) {
			case 'slides':
				s.setIsSlidesPaneOpen(true);
				break;
			case 'inspector':
				s.setSidebarPanelMode('properties');
				s.setIsInspectorPaneOpen(true);
				break;
			case 'comments':
				s.setSidebarPanelMode('comments');
				s.setIsInspectorPaneOpen(true);
				break;
			case 'notes':
				s.setIsSlideNotesCollapsed(false);
				break;
		}
	};

	return (
		<>
			<MobileSlidesSheet
				open={s.isSlidesPaneOpen}
				onClose={() => s.setIsSlidesPaneOpen(false)}
				slides={slides}
				activeSlideIndex={activeSlideIndex}
				canvasSize={canvasSize}
				sectionGroups={slideSectionGroups}
				isOpen
				canEdit={canEdit}
				onSelectSlide={(index) => {
					s.setActiveSlideIndex(index);
					s.setIsSlidesPaneOpen(false);
				}}
				onSlideContextMenu={editorOps.slideOps.handleSlideContextMenu}
				onMoveSlide={editorOps.slideOps.handleMoveSlide}
				onAddSlide={editorOps.slideOps.handleAddSlide}
				onCollapse={() => s.setIsSlidesPaneOpen(false)}
				onAddSection={editorOps.sectionOps.addSection}
				onRenameSection={editorOps.sectionOps.renameSection}
				onDeleteSection={editorOps.sectionOps.deleteSection}
				onMoveSectionUp={editorOps.sectionOps.moveSectionUp}
				onMoveSectionDown={editorOps.sectionOps.moveSectionDown}
				rehearsalTimings={
					Object.keys(presentation.recordedTimings).length > 0
						? presentation.recordedTimings
						: undefined
				}
			/>

			<MobileBottomBar
				activeSheet={activeSheet}
				commentCount={commentCount}
				onOpenSlides={() =>
					s.isSlidesPaneOpen ? s.setIsSlidesPaneOpen(false) : openSheet('slides')
				}
				onOpenInsert={() => {
					// Quick-insert: a text box is the most common starter element
					// on mobile. Full Insert section lives in the top-bar menu.
					editorOps.insertHandlers.handleAddTextBox();
				}}
				onOpenInspector={() =>
					s.isInspectorPaneOpen && s.sidebarPanelMode !== 'comments'
						? s.setIsInspectorPaneOpen(false)
						: openSheet('inspector')
				}
				onOpenComments={() =>
					s.isInspectorPaneOpen && s.sidebarPanelMode === 'comments'
						? s.setIsInspectorPaneOpen(false)
						: openSheet('comments')
				}
				onToggleNotes={() =>
					!s.isSlideNotesCollapsed ? s.setIsSlideNotesCollapsed(true) : openSheet('notes')
				}
			/>
		</>
	);
}
