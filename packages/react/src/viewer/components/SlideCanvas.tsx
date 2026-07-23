import { getShapeAdjustmentHandleDescriptor } from '../utils';
import { getReactSlideBackgroundStyle } from '../utils/slide-background-style';
/** SlideCanvas: Central canvas area for the PowerPoint editor. */
import type { SlideCanvasProps } from './canvas/canvas-types';
import { CanvasGuides, MarqueeOverlay, SnapLinesOverlay } from './canvas/CanvasOverlays';
import { CommentMarkersOverlay } from './canvas/CommentMarkersOverlay';
import { ConnectorOverlay } from './canvas/ConnectorOverlay';
import { DrawingOverlaySvg } from './canvas/DrawingOverlaySvg';
import { GridOverlay } from './canvas/GridOverlay';
import { Ruler } from './canvas/Ruler';
import { RULER_THICKNESS } from './canvas/ruler-utils';
import { useCanvasEventHandlers } from './canvas/useCanvasEventHandlers';
import { useConnectorCreation } from './canvas/useConnectorCreation';
import { useDrawingOverlay } from './canvas/useDrawingOverlay';
import { useStableCallbacks } from './canvas/useStableCallbacks';
import { ElementRenderer } from './ElementRenderer';
import { ActiveXControlOverlay } from './elements/ActiveXControlOverlay';

export type { SlideCanvasProps } from './canvas/canvas-types';

export function SlideCanvas({
	activeSlide,
	templateElements,
	canvasSize,
	zoom,
	mode,
	canEdit,
	editTemplateMode,
	selectedElementIdSet,
	selectedElement,
	inlineEditingElementId,
	inlineEditingText,
	spellCheckEnabled,
	mediaDataUrls,
	tableEditorState,
	marqueeSelectionState,
	snapLines,
	showGrid,
	gridSpacingPx,
	showRulers,
	rulerUnit = 'inches',
	guides,
	presentationElementStates,
	presentationKeyframesCss,
	onClick,
	onDoubleClick,
	onMouseDown,
	onContextMenu,
	onCanvasMouseDown,
	onResizePointerDown,
	onAdjustmentPointerDown,
	onRotate,
	onInlineEditChange,
	onInlineEditCommit,
	onInlineEditCancel,
	onTableCellSelect,
	onCommitCellEdit,
	onUpdateSmartArtElement,
	onFormatText,
	onResizeTableColumns,
	onResizeTableRow,
	findResults,
	findResultIndex,
	activeSlideIndex,
	activeTool = 'select',
	drawingColor = '#000000',
	drawingWidth = 3,
	isDrawingRef,
	onAddInkElement,
	onAddFreeformShape,
	onEraseInkElement,
	onActionClick,
	onHyperlinkClick,
	comments,
	showCommentMarkers = false,
	onCommentMarkerClick,
	onMoveGuide,
	onDeleteGuide,
	onCreateGuideFromRuler,
	connectorCreationMode = false,
	onCreateConnector,
	allSlides,
	onZoomClick,
	sourceSlideIndex,
	fieldContext,
	tableStyleContext,
	collaborationOverlay,
	aiActive = false,
}: SlideCanvasProps) {
	// True when the stage is an interactive editing surface (drag/resize/marquee
	// are live). Drives touch-action: none and the touch pointer-down wiring so
	// finger gestures manipulate elements instead of scrolling the page.
	const isEditableCanvas = (mode === 'edit' || mode === 'master') && canEdit;

	/* ── Stable callback refs ──────────────────────────────────────── */
	const {
		cbRef,
		stableResizePointerDown,
		stableAdjustmentPointerDown,
		stableRotate,
		stableInlineEditChange,
		stableInlineEditCommit,
		stableInlineEditCancel,
		stableTableCellSelect,
		stableCommitCellEdit,
		stableUpdateSmartArtElement,
		stableFormatText,
		stableResizeTableColumns,
		stableResizeTableRow,
	} = useStableCallbacks({
		onClick,
		onDoubleClick,
		onMouseDown,
		onContextMenu,
		onResizePointerDown,
		onAdjustmentPointerDown,
		onRotate,
		onInlineEditChange,
		onInlineEditCommit,
		onInlineEditCancel,
		onTableCellSelect,
		onCommitCellEdit,
		onUpdateSmartArtElement,
		onFormatText,
		onResizeTableColumns,
		onResizeTableRow,
	});

	/* ── Canvas event handlers ─────────────────────────────────────── */
	const {
		elementFindHighlightsMap,
		selectedBounds,
		handleStageClick,
		handleStageDblClick,
		handleStageMouseDown,
		handleViewportMouseDown,
		handleStagePointerDown,
		handleStageContextMenu,
		setDraggingGuide,
		handleStagePointerMove,
		handleStagePointerUp,
	} = useCanvasEventHandlers({
		cbRef,
		onCanvasMouseDown,
		findResults,
		findResultIndex,
		activeSlideIndex,
		selectedElement,
		zoom,
		onMoveGuide,
	});

	/* ── Connector creation ────────────────────────────────────────── */
	const {
		connectorDragState,
		handleConnectionSiteDown,
		handleConnectorDragMove,
		handleConnectionSiteDrop,
		handleConnectorDragEnd,
	} = useConnectorCreation({ activeSlide, zoom, onCreateConnector });

	/* ── Drawing overlay ───────────────────────────────────────────── */
	const {
		isDrawing,
		isStrokeActive,
		liveStrokeD,
		handleDrawPointerDown,
		handleDrawPointerMove,
		handleDrawPointerUp,
	} = useDrawingOverlay({
		activeTool,
		activeSlide,
		zoom,
		drawingColor,
		drawingWidth,
		isDrawingRef,
		onAddInkElement,
		onAddFreeformShape,
		onEraseInkElement,
	});

	const rulerOffset = showRulers ? RULER_THICKNESS : 0;

	return (
		<div
			ref={zoom.canvasViewportRef}
			data-pptx-viewport
			className='flex-1 overflow-auto relative'
			style={{ touchAction: 'pan-x pan-y' }}
			onMouseDown={handleViewportMouseDown}
		>
			<div
				ref={zoom.editWrapperRef}
				className='relative mx-auto my-4'
				style={{
					width: canvasSize.width * zoom.editorScale + rulerOffset,
					height: canvasSize.height * zoom.editorScale + rulerOffset,
				}}
			>
				<Ruler
					canvasSize={canvasSize}
					editorScale={zoom.editorScale}
					unit={rulerUnit}
					visible={showRulers}
					selectedBounds={selectedBounds}
					onCreateGuideFromRuler={onCreateGuideFromRuler}
				/>
				{/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the slide stage is the primary pointer interaction surface (drag/marquee/select) */}
				<div
					ref={zoom.canvasStageRef}
					role='region'
					aria-label={`Slide ${(activeSlideIndex ?? 0) + 1}`}
					aria-roledescription='slide'
					data-pptx-ai-active={aiActive ? 'true' : undefined}
					className='relative shadow-2xl'
					style={{
						width: canvasSize.width,
						height: canvasSize.height,
						transform: `scale(${zoom.editorScale})`,
						transformOrigin: 'top left',
						marginTop: rulerOffset,
						marginLeft: rulerOffset,
						// In edit/master mode the stage must own all touch gestures so
						// drag/resize/marquee aren't stolen by the browser for panning or
						// pinch-zoom. View/present mode keeps the default so the slide can
						// still be scrolled and swipe-navigated.
						touchAction: isEditableCanvas ? 'none' : undefined,
						...getReactSlideBackgroundStyle(activeSlide),
					}}
					onClick={handleStageClick}
					onDoubleClick={handleStageDblClick}
					onMouseDown={handleStageMouseDown}
					onPointerDown={isEditableCanvas ? handleStagePointerDown : undefined}
					onContextMenu={handleStageContextMenu}
					onPointerMove={handleStagePointerMove}
					onPointerUp={handleStagePointerUp}
				>
					{presentationKeyframesCss && <style>{presentationKeyframesCss}</style>}
					<GridOverlay canvasSize={canvasSize} gridSpacingPx={gridSpacingPx} visible={showGrid} />
					<CanvasGuides
						guides={guides}
						onDeleteGuide={onDeleteGuide}
						onStartGuideDrag={setDraggingGuide}
					/>
					{/* Template elements */}
					{templateElements.map((element, index) => (
						<ElementRenderer
							key={`tpl-${element.id}`}
							element={element}
							activeSlide={activeSlide}
							isSelected={selectedElementIdSet.has(element.id)}
							isInlineEditing={inlineEditingElementId === element.id}
							inlineEditingText={inlineEditingText}
							canInteract={(mode === 'edit' || mode === 'master') && canEdit && editTemplateMode}
							spellCheckEnabled={spellCheckEnabled}
							mediaDataUrls={mediaDataUrls}
							selectionColorClass='blue-400'
							showHoverBorder={false}
							opacity={0.95}
							templateEditing={editTemplateMode}
							zIndex={index}
							imageAltText='Template element'
							showResizeHandles={
								isEditableCanvas &&
								selectedElementIdSet.has(element.id) &&
								selectedElementIdSet.size <= 1 &&
								!inlineEditingElementId
							}
							renderInk={false}
							renderGroups
							adjustmentHandleDescriptor={
								isEditableCanvas && selectedElement?.id === element.id
									? getShapeAdjustmentHandleDescriptor(element)
									: null
							}
							onResizePointerDown={stableResizePointerDown}
							onAdjustmentPointerDown={stableAdjustmentPointerDown}
							onRotate={stableRotate}
							onInlineEditChange={stableInlineEditChange}
							onInlineEditCommit={stableInlineEditCommit}
							onInlineEditCancel={stableInlineEditCancel}
							onUpdateSmartArtElement={stableUpdateSmartArtElement}
							onFormatText={stableFormatText}
							onActionClick={onActionClick}
							onHyperlinkClick={onHyperlinkClick}
							animationState={presentationElementStates?.get(element.id)}
							presentationElementStates={presentationElementStates}
							allSlides={allSlides}
							onZoomClick={onZoomClick}
							sourceSlideIndex={sourceSlideIndex}
							fieldContext={fieldContext}
							tableStyleContext={tableStyleContext}
						/>
					))}

					{/* Slide elements */}
					{activeSlide?.elements.map((element, index) => (
						<ElementRenderer
							key={element.id}
							element={element}
							activeSlide={activeSlide}
							isSelected={selectedElementIdSet.has(element.id)}
							isInlineEditing={inlineEditingElementId === element.id}
							inlineEditingText={inlineEditingText}
							canInteract={isEditableCanvas}
							spellCheckEnabled={spellCheckEnabled}
							mediaDataUrls={mediaDataUrls}
							tableEditorState={tableEditorState}
							selectionColorClass='blue-500'
							showHoverBorder
							zIndex={templateElements.length + index}
							imageAltText='Slide element'
							showResizeHandles={
								isEditableCanvas &&
								selectedElementIdSet.has(element.id) &&
								selectedElementIdSet.size <= 1 &&
								!inlineEditingElementId
							}
							renderInk
							renderGroups
							adjustmentHandleDescriptor={
								isEditableCanvas && selectedElement?.id === element.id
									? getShapeAdjustmentHandleDescriptor(element)
									: null
							}
							onResizePointerDown={stableResizePointerDown}
							onAdjustmentPointerDown={stableAdjustmentPointerDown}
							onRotate={stableRotate}
							onInlineEditChange={stableInlineEditChange}
							onInlineEditCommit={stableInlineEditCommit}
							onInlineEditCancel={stableInlineEditCancel}
							onUpdateSmartArtElement={stableUpdateSmartArtElement}
							onFormatText={stableFormatText}
							onTableCellSelect={stableTableCellSelect}
							onCommitCellEdit={stableCommitCellEdit}
							onResizeTableColumns={stableResizeTableColumns}
							onResizeTableRow={stableResizeTableRow}
							findHighlights={elementFindHighlightsMap.get(element.id)}
							onActionClick={onActionClick}
							onHyperlinkClick={onHyperlinkClick}
							animationState={presentationElementStates?.get(element.id)}
							presentationElementStates={presentationElementStates}
							allSlides={allSlides}
							onZoomClick={onZoomClick}
							sourceSlideIndex={sourceSlideIndex}
							fieldContext={fieldContext}
							tableStyleContext={tableStyleContext}
						/>
					))}

					<MarqueeOverlay marqueeSelectionState={marqueeSelectionState} />

					{activeSlide?.activeXControls && activeSlide.activeXControls.length > 0 && (
						<ActiveXControlOverlay controls={activeSlide.activeXControls} canvasSize={canvasSize} />
					)}

					{showCommentMarkers && comments && comments.length > 0 && (
						<CommentMarkersOverlay
							comments={comments}
							canvasSize={canvasSize}
							onCommentMarkerClick={onCommentMarkerClick}
						/>
					)}

					<SnapLinesOverlay snapLines={snapLines} />

					{connectorCreationMode && activeSlide && (
						<ConnectorOverlay
							activeSlide={activeSlide}
							canvasSize={canvasSize}
							zoom={zoom}
							connectorDragState={connectorDragState}
							onConnectionSiteDown={handleConnectionSiteDown}
							onConnectorDragMove={handleConnectorDragMove}
							onConnectionSiteDrop={handleConnectionSiteDrop}
							onConnectorDragEnd={handleConnectorDragEnd}
						/>
					)}

					{isDrawing && (
						<DrawingOverlaySvg
							canvasSize={canvasSize}
							activeTool={activeTool}
							drawingColor={drawingColor}
							drawingWidth={drawingWidth}
							isStrokeActive={isStrokeActive}
							liveStrokeD={liveStrokeD}
							onPointerDown={handleDrawPointerDown}
							onPointerMove={handleDrawPointerMove}
							onPointerUp={handleDrawPointerUp}
						/>
					)}

					{/* Collaboration remote cursors overlay */}
					{collaborationOverlay}
				</div>
			</div>
		</div>
	);
}
