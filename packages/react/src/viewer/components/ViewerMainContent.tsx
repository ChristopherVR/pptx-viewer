/**
 * ViewerMainContent: The primary content area containing sidebars,
 * canvas, context menu, and side panels.
 */
import { setMasterViewBackgroundColor } from 'pptx-viewer-shared';
import { useMemo, useRef, useState } from 'react';

import { SlidesPaneSidebar, MasterViewSidebar } from '.';
import { useLayoutPreviews } from '../hooks/useLayoutPreviews';
import { AiChangeOverlay, AiFocusHighlightOverlay } from './ai';
import { ChartPartSelectionProvider } from './chart-part-selection';
import { ResizeHandle } from './ResizeHandle';
import { LayoutGalleryMenu } from './toolbar/LayoutGalleryMenu';
import type { ViewerMainContentProps } from './viewer-main-content-types';
import { ViewerCanvasArea } from './ViewerCanvasArea';
import { ViewerContextMenus } from './ViewerContextMenus';
import { ViewerSidePanels } from './ViewerSidePanels';

export type { ViewerMainContentProps } from './viewer-main-content-types';

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
		tableOps,
		slideOps,
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

	return (
		<ChartPartSelectionProvider>
			<div data-pptx-chrome='body' className='relative z-10 flex flex-1 min-h-0'>
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
							onAddSlideAfter={slideOps.handleAddSlideAfter}
							onDuplicateSlides={slideOps.handleDuplicateSlides}
							onDeleteSlides={slideOps.handleDeleteSlides}
							onHideSlides={slideOps.handleToggleHideSlides}
							onOpenLayoutForSlide={(index, x, y) => {
								state.setActiveSlideIndex(index);
								setLayoutGalleryAnchor({ x, y });
							}}
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

				<ViewerContextMenus {...props} setLayoutGalleryAnchor={setLayoutGalleryAnchor} />

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
