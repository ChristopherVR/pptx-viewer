/**
 * ViewerMainContent: The primary content area containing sidebars,
 * canvas, context menu, and side panels.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { setMasterViewBackgroundColor } from 'pptx-viewer-shared';
import type { ToolbarActionId } from 'pptx-viewer-shared';
import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { useMemo } from 'react';

import { SlidesPaneSidebar, MasterViewSidebar, ContextMenu } from '.';
import type { AiPanelController } from '../hooks/ai/useAiPanelController';
import type { UseCommentsResult } from '../hooks/useComments-helpers';
import type { EditorHistoryResult } from '../hooks/useEditorHistory';
import type { EditorOperationsResult } from '../hooks/useEditorOperations';
import type { UseMasterViewCrudResult } from '../hooks/useMasterViewCrud';
import type { UsePresentationAnnotationsResult } from '../hooks/usePresentationAnnotations';
import type { UsePresentationModeResult } from '../hooks/usePresentationMode';
import type { PropertyHandlersResult } from '../hooks/usePropertyHandlers';
import type { ThemeHandlersResult } from '../hooks/useThemeHandlers';
import type { ViewerDialogsResult } from '../hooks/useViewerDialogs';
import type { ViewerState } from '../hooks/useViewerState';
import type { UseZoomViewportResult } from '../hooks/useZoomViewport';
import type { CanvasSize, SlideSectionGroup } from '../types';
import type { ViewerMode } from '../types-core';
import { AiChangeOverlay, AiFocusHighlightOverlay } from './ai';
import { ChartPartSelectionProvider } from './chart-part-selection';
import { ResizeHandle } from './ResizeHandle';
import { ViewerCanvasArea } from './ViewerCanvasArea';
import { ViewerSidePanels } from './ViewerSidePanels';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewerMainContentProps {
	mode: ViewerMode;
	canEdit: boolean;
	slides: PptxSlide[];
	activeSlide: PptxSlide | undefined;
	masterPseudoSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	canvasSize: CanvasSize;
	gridSpacingPx: number;
	slideSectionGroups: SlideSectionGroup[];
	showSlidesPane: boolean;
	showMasterPane: boolean;
	selectedElement: PptxElement | null;
	state: ViewerState;
	editorOps: EditorOperationsResult;
	dialogs: ViewerDialogsResult;
	presentation: UsePresentationModeResult;
	annotations: UsePresentationAnnotationsResult;
	propertyHandlers: PropertyHandlersResult;
	themeHandlers: ThemeHandlersResult;
	history: EditorHistoryResult;
	comments: UseCommentsResult;
	/** Slide Master view sidebar CRUD (Insert/Duplicate/Delete/Rename). */
	masterViewCrud: UseMasterViewCrudResult;
	zoom: UseZoomViewportResult;
	/** Whether the viewport is mobile-sized (<768px). */
	isMobile?: boolean;
	/** Whether the device supports touch input. */
	isTouchDevice?: boolean;
	/** Called when the user clicks "end presentation" in the slide show toolbar. */
	onEndPresentation?: () => void;
	/** Width of the left slides pane in pixels. */
	leftPanelWidth?: number;
	/** Callback to resize the left panel. */
	onResizeLeft?: (delta: number) => void;
	/** Width of the right inspector panel in pixels. */
	rightPanelWidth?: number;
	/** Callback to resize the right panel. */
	onResizeRight?: (delta: number) => void;
	/** Host-supplied list of toolbar buttons/ribbon tabs to hide. */
	hiddenActions?: readonly ToolbarActionId[];
	/** AI assistant config (present only when the host passes the `ai` prop). */
	aiConfig?: PptxAiConfig;
	/** Bridge exposing the live deck to the AI core. */
	aiBridge?: PptxAiBridge;
	/** AI panel open state + focus/prefill controller (present when `ai` is set). */
	aiPanel?: AiPanelController;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewerMainContent(props: ViewerMainContentProps) {
	const {
		mode,
		canEdit,
		slides,
		activeSlide,
		masterPseudoSlide,
		activeSlideIndex,
		canvasSize,
		gridSpacingPx,
		slideSectionGroups,
		showSlidesPane,
		showMasterPane,
		selectedElement,
		state,
		editorOps,
		dialogs,
		presentation,
		annotations,
		propertyHandlers,
		themeHandlers,
		history,
		comments,
		masterViewCrud,
		zoom,
		isMobile: _isMobile = false,
		isTouchDevice: _isTouchDevice = false,
		onEndPresentation,
		leftPanelWidth,
		onResizeLeft,
		rightPanelWidth,
		onResizeRight,
		hiddenActions,
		aiConfig,
		aiBridge,
		aiPanel,
	} = props;

	const {
		ops,
		sectionOps,
		canvasHandlers,
		insertHandlers,
		manipulation,
		slideOps,
		tableOps,
		findReplace,
	} = editorOps;

	// Presentation-wide field/table context so sidebar thumbnails substitute
	// fields and resolve table theme colours identically to the canvas. Kept
	// stable so the memoised SlideThumbnails don't re-render every frame.
	const hf = state.headerFooter;
	const thumbnailFieldContext = useMemo(
		() => ({
			dateTimeText: hf.dateTimeText,
			dateFormat: hf.dateFormat,
			footerText: hf.footerText,
			headerText: hf.headerText,
			customProperties: state.customProperties.map((p) => ({ name: p.name, value: p.value })),
		}),
		[hf.dateTimeText, hf.dateFormat, hf.footerText, hf.headerText, state.customProperties],
	);
	const thumbnailTableStyleContext = useMemo(
		() =>
			state.theme || state.tableStyleMap
				? { theme: state.theme, tableStyleMap: state.tableStyleMap }
				: undefined,
		[state.theme, state.tableStyleMap],
	);

	// Recent-colours ("Most Recently Used") support, shared by every colour
	// picker in BOTH the ribbon toolbar and the inspector via context, is
	// provided by `PowerPointViewer` above `ViewerToolbarSection` and this
	// component (siblings in that tree), not here: a provider nested only
	// inside this component would leave the ribbon reading the context's
	// empty default (see `RecentColorsContext`'s doc).

	return (
		<ChartPartSelectionProvider>
			<div className='relative z-10 flex flex-1 min-h-0'>
				{showSlidesPane && (
					<>
						<SlidesPaneSidebar
							slides={slides}
							templateElementsBySlideId={state.templateElementsBySlideId}
							activeSlideIndex={activeSlideIndex}
							canvasSize={canvasSize}
							sectionGroups={slideSectionGroups}
							isOpen={state.isSlidesPaneOpen}
							canEdit={canEdit}
							onSelectSlide={state.setActiveSlideIndex}
							onSlideContextMenu={slideOps.handleSlideContextMenu}
							onMoveSlide={slideOps.handleMoveSlide}
							onAddSlide={slideOps.handleAddSlide}
							onCollapse={() => state.setIsSlidesPaneOpen(false)}
							onAddSection={sectionOps.addSection}
							onRenameSection={sectionOps.renameSection}
							onDeleteSection={sectionOps.deleteSection}
							onMoveSectionUp={sectionOps.moveSectionUp}
							onMoveSectionDown={sectionOps.moveSectionDown}
							onToggleSectionCollapse={sectionOps.toggleSectionCollapse}
							rehearsalTimings={
								Object.keys(presentation.recordedTimings).length > 0
									? presentation.recordedTimings
									: undefined
							}
							panelWidth={leftPanelWidth}
							fieldContext={thumbnailFieldContext}
							tableStyleContext={thumbnailTableStyleContext}
						/>
						{onResizeLeft && <ResizeHandle direction='horizontal' onResize={onResizeLeft} />}
					</>
				)}
				{showMasterPane && (
					<MasterViewSidebar
						slideMasters={state.slideMasters}
						activeMasterIndex={state.activeMasterIndex}
						activeLayoutIndex={state.activeLayoutIndex}
						canvasSize={canvasSize}
						masterViewTab={state.masterViewTab}
						notesMaster={state.notesMaster}
						handoutMaster={state.handoutMaster}
						handoutSlidesPerPage={state.handoutMaster?.slidesPerPage ?? state.handoutSlidesPerPage}
						onSelectMaster={dialogs.handleSelectMaster}
						onSelectLayout={dialogs.handleSelectLayout}
						onCollapse={dialogs.handleCloseMasterView}
						onTabChange={state.setMasterViewTab}
						crudActions={masterViewCrud.crudActions}
						onCrudAction={masterViewCrud.handleCrudAction}
						onHandoutSlidesPerPageChange={(count) => {
							state.setHandoutSlidesPerPage(count);
							state.setHandoutMaster((master) =>
								master ? { ...master, slidesPerPage: count } : master,
							);
							state.setIsDirty(true);
						}}
						onNotesMasterBackgroundChange={(backgroundColor) => {
							state.setNotesMaster((master) => (master ? { ...master, backgroundColor } : master));
							state.setIsDirty(true);
						}}
						onHandoutMasterBackgroundChange={(backgroundColor) => {
							state.setHandoutMaster((master) =>
								master ? { ...master, backgroundColor } : master,
							);
							state.setIsDirty(true);
						}}
						canEdit={canEdit}
						onSlidesBackgroundChange={(backgroundColor) => {
							const write = setMasterViewBackgroundColor(
								{ slideMasters: state.slideMasters },
								{
									tab: 'slides',
									masterIndex: state.activeMasterIndex,
									layoutIndex: state.activeLayoutIndex,
								},
								backgroundColor,
							);
							if (write?.slideMasters) {
								state.setSlideMasters(write.slideMasters);
								state.setIsDirty(true);
							}
						}}
					/>
				)}

				<ViewerCanvasArea
					onUpdateSlideAnimations={(animations) =>
						propertyHandlers.handleUpdateSlide({ animations })
					}
					mode={mode}
					canEdit={canEdit}
					slides={slides}
					activeSlide={activeSlide}
					masterPseudoSlide={masterPseudoSlide}
					templateElements={state.templateElements}
					canvasSize={canvasSize}
					activeSlideIndex={activeSlideIndex}
					gridSpacingPx={gridSpacingPx}
					zoom={zoom}
					state={state}
					selectedElement={selectedElement}
					canvasHandlers={canvasHandlers}
					insertHandlers={insertHandlers}
					tableOps={tableOps}
					annotations={annotations}
					presentation={presentation}
					onEndPresentation={onEndPresentation}
					findReplace={findReplace}
					hiddenActions={hiddenActions}
					aiPickMode={aiPanel?.pickMode}
					onAiPickElement={aiPanel ? aiPanel.addPick : undefined}
					aiCanvasActive={aiPanel?.canvasAnimating}
					aiHighlightOverlay={
						aiPanel ? (
							<>
								<AiFocusHighlightOverlay
									highlights={aiPanel.canvasHighlights}
									elements={activeSlide?.elements ?? []}
									activeSlideIndex={activeSlideIndex}
								/>
								<AiChangeOverlay batch={aiPanel.changeBatch} activeSlideIndex={activeSlideIndex} />
							</>
						) : undefined
					}
				/>

				{state.contextMenuState && (
					<ContextMenu
						contextMenuState={state.contextMenuState}
						mode={mode}
						selectedElement={selectedElement}
						tableEditorState={state.tableEditorState}
						hasMultiSelection={state.effectiveSelectedIds.length > 1}
						onAction={manipulation.handleContextMenuAction}
						onInsertTableRow={tableOps.handleInsertTableRow}
						onDeleteTableRow={tableOps.handleDeleteTableRow}
						onInsertTableColumn={tableOps.handleInsertTableColumn}
						onDeleteTableColumn={tableOps.handleDeleteTableColumn}
						onMergeCellRight={tableOps.handleMergeCellRight}
						onMergeCellDown={tableOps.handleMergeCellDown}
						onMergeSelectedCells={tableOps.handleMergeSelectedCells}
						onSplitCell={tableOps.handleSplitCell}
						onAskAi={
							aiPanel && selectedElement
								? () => {
										aiPanel.askAboutSelection();
										state.setContextMenuState(null);
									}
								: undefined
						}
						onFixAi={
							aiPanel && selectedElement
								? () => {
										aiPanel.fixSelection();
										state.setContextMenuState(null);
									}
								: undefined
						}
						onClose={() => state.setContextMenuState(null)}
					/>
				)}

				<ViewerSidePanels
					mode={mode}
					canEdit={canEdit}
					activeSlide={activeSlide}
					masterPseudoSlide={masterPseudoSlide}
					slides={slides}
					canvasSize={canvasSize}
					activeSlideIndex={activeSlideIndex}
					selectedElement={selectedElement}
					state={state}
					comments={comments}
					ops={ops}
					manipulation={manipulation}
					propertyHandlers={propertyHandlers}
					themeHandlers={themeHandlers}
					history={history}
					panelWidth={rightPanelWidth}
					onResizeRight={onResizeRight}
					aiConfig={aiConfig}
					aiBridge={aiBridge}
					aiPanel={aiPanel}
				/>
			</div>
		</ChartPartSelectionProvider>
	);
}
