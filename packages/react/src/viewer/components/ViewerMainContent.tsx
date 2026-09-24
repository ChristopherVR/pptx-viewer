/**
 * ViewerMainContent: The primary content area containing sidebars,
 * canvas, context menu, and side panels.
 */
import type { PptxElement, PptxLayoutPreview, PptxSlide } from 'pptx-viewer-core';
import { resetSlideLayoutPath, setMasterViewBackgroundColor } from 'pptx-viewer-shared';
import type { ToolbarActionId } from 'pptx-viewer-shared';
import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { SlidesPaneSidebar, MasterViewSidebar, ContextMenu, CanvasContextMenu } from '.';
import type { AiPanelController } from '../hooks/ai/useAiPanelController';
import type { UseCommentsResult } from '../hooks/useComments-helpers';
import type { EditorHistoryResult } from '../hooks/useEditorHistory';
import type { EditorOperationsResult } from '../hooks/useEditorOperations';
import { useLayoutPreviews } from '../hooks/useLayoutPreviews';
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
import { LayoutGalleryMenu } from './toolbar/LayoutGalleryMenu';
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
	/** Show chrome mounted inside the fullscreen stage; see `ViewerCanvasArea`. */
	presentationOverlay?: ReactNode;
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
	/** Applies a layout to the active slide; used by the canvas context menu's Layout entry. */
	onApplyLayout?: (path: string) => void;
	/** Fetches layout artwork for the canvas context menu's Layout gallery. */
	loadLayoutPreviews?: () => Promise<PptxLayoutPreview[]>;
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
		presentationOverlay,
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
		onApplyLayout,
		loadLayoutPreviews,
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

	// The canvas context menu's "Layout" entry opens the same gallery the
	// ribbon's Home > Layout button does, anchored at the click point instead
	// of the ribbon button: an invisible zero-size anchor positioned at the
	// click coordinates gives `LayoutGalleryMenu` (which anchors off a rect,
	// not a point) somewhere to hang from.
	const [layoutGalleryAnchor, setLayoutGalleryAnchor] = useState<{ x: number; y: number } | null>(
		null,
	);
	const layoutGalleryAnchorRef = useRef<HTMLDivElement>(null);
	const layoutGalleryPreviews = useLayoutPreviews(loadLayoutPreviews, layoutGalleryAnchor !== null);

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
					presentationOverlay={presentationOverlay}
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
						selectionGroupable={manipulation.selectionGroupable}
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

				{state.canvasContextMenuState && (
					<CanvasContextMenu
						canvasContextMenuState={state.canvasContextMenuState}
						mode={mode}
						hasClipboard={Boolean(state.clipboardPayload)}
						showGrid={state.showGrid}
						showRulers={state.showRulers}
						onPaste={() => manipulation.handlePaste()}
						onOpenLayoutGallery={() => {
							const pos = state.canvasContextMenuState;
							if (pos) {
								setLayoutGalleryAnchor(pos);
							}
						}}
						onResetSlide={() => {
							const path = resetSlideLayoutPath(activeSlide);
							if (path) {
								onApplyLayout?.(path);
							}
						}}
						onOpenFormatBackground={() => {
							state.setSelectedElementId(null);
							state.setSelectedElementIds([]);
							state.setSidebarPanelMode('properties');
							state.setIsInspectorPaneOpen(true);
						}}
						onToggleGrid={() => state.setShowGrid((v) => !v)}
						onToggleRulers={() => state.setShowRulers((v) => !v)}
						onClose={() => state.setCanvasContextMenuState(null)}
					/>
				)}

				{layoutGalleryAnchor && (
					<>
						<div
							ref={layoutGalleryAnchorRef}
							style={{
								position: 'fixed',
								left: layoutGalleryAnchor.x,
								top: layoutGalleryAnchor.y,
								width: 0,
								height: 0,
							}}
						/>
						<div className='fixed inset-0 z-[119]' onClick={() => setLayoutGalleryAnchor(null)} />
						<LayoutGalleryMenu
							anchorRef={layoutGalleryAnchorRef}
							layoutOptions={state.layoutOptions}
							previews={layoutGalleryPreviews}
							currentLayoutPath={activeSlide?.layoutPath}
							onSelect={(layout) => {
								onApplyLayout?.(layout.path);
								setLayoutGalleryAnchor(null);
							}}
						/>
					</>
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
