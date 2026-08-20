import type { PptxSlide } from 'pptx-viewer-core';
import { toggleSheet } from 'pptx-viewer-shared';
import React from 'react';

import type { EditorOperationsResult } from '../../hooks/useEditorOperations';
import { useKeyboardInsets } from '../../hooks/useKeyboardInsets';
import type { UsePresentationModeResult } from '../../hooks/usePresentationMode';
import type { ViewerState } from '../../hooks/useViewerState';
import type { CanvasSize, SlideSectionGroup } from '../../types';
import { MobileBottomBar } from './MobileBottomBar';
import { MobileSlidesSheet } from './MobileSlidesSheet';

/** The mobile sheets this overlay toggles; a subset of shared's `MobileSheetKey`. */
export type MobileChromeSheet = 'slides' | 'inspector' | 'comments' | 'notes';

/**
 * Decide the next active sheet for a bottom-bar tap, delegating to shared's
 * `toggleSheet` so React follows the same open/close priority every binding
 * uses: tapping the open sheet closes it, tapping a different one switches to
 * it. Exported (rather than left as an inline closure) so the priority order
 * itself is directly testable without mounting the whole overlay.
 */
export function nextMobileSheet(
	current: MobileChromeSheet | null,
	tapped: MobileChromeSheet,
): MobileChromeSheet | null {
	const next = toggleSheet(current, tapped);
	return next === tapped ? tapped : null;
}

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
	// Track the on-screen-keyboard inset so the fixed bottom bar can lift above
	// the keyboard (and the focused field is scrolled into view by the hook),
	// determine which mobile sheet is currently active for bar highlighting,
	// and build the sheet-toggle helpers the bar and sheets below call into.
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
		} = props,
		{ keyboardInset, isKeyboardOpen } = useKeyboardInsets(),
		activeSheet: MobileChromeSheet | null = s.isSlidesPaneOpen
			? 'slides'
			: s.isInspectorPaneOpen
				? s.sidebarPanelMode === 'comments'
					? 'comments'
					: 'inspector'
				: !s.isSlideNotesCollapsed
					? 'notes'
					: null,
		closeAllSheets = () => {
			s.setIsSlidesPaneOpen(false);
			s.setIsInspectorPaneOpen(false);
			s.setIsSlideNotesCollapsed(true);
		},
		openSheet = (which: MobileChromeSheet) => {
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
		},
		// Bottom-bar taps decide their next sheet through `nextMobileSheet`
		// (shared's `toggleSheet`). Each binding's underlying storage differs
		// (here, inspector/comments share one `isInspectorPaneOpen` flag split
		// by `sidebarPanelMode`), so only the decision comes from shared;
		// `openSheet` above still owns mapping it onto this binding's own state.
		applySheetTap = (tapped: MobileChromeSheet) => {
			const next = nextMobileSheet(activeSheet, tapped);
			closeAllSheets();
			if (next) {
				openSheet(next);
			}
		};

	return (
		<>
			<MobileSlidesSheet
				open={s.isSlidesPaneOpen}
				onClose={() => s.setIsSlidesPaneOpen(false)}
				slides={slides}
				templateElementsBySlideId={s.templateElementsBySlideId}
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
				onToggleSectionCollapse={editorOps.sectionOps.toggleSectionCollapse}
				rehearsalTimings={
					Object.keys(presentation.recordedTimings).length > 0
						? presentation.recordedTimings
						: undefined
				}
			/>

			{/* Lift the fixed bottom bar above the on-screen keyboard so its
			    actions stay reachable instead of sitting under the keyboard. */}
			<div
				className='contents'
				style={
					keyboardInset > 0
						? {
								display: 'block',
								transform: `translateY(-${keyboardInset}px)`,
								transition: 'transform 150ms ease-out',
								willChange: 'transform',
							}
						: undefined
				}
				data-keyboard-open={isKeyboardOpen ? 'true' : undefined}
			>
				<MobileBottomBar
					slideCount={slides.length}
					activeSheet={activeSheet}
					commentCount={commentCount}
					onOpenSlides={() => applySheetTap('slides')}
					onOpenInsert={() => {
						// Quick-insert: a text box is the most common starter element
						// on mobile. Full Insert section lives in the top-bar menu.
						editorOps.insertHandlers.handleAddTextBox();
					}}
					onOpenInspector={() => applySheetTap('inspector')}
					onOpenComments={() => applySheetTap('comments')}
					onToggleNotes={() => applySheetTap('notes')}
				/>
			</div>
		</>
	);
}
