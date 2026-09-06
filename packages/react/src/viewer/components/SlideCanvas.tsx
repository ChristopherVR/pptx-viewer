import { motionPathFor, setMotionPath, shouldShowElementHandles } from 'pptx-viewer-shared';
import { useCallback } from 'react';

import type { ShapeAdjustmentHandleDescriptor } from '../types';
import { getShapeAdjustmentHandleDescriptors, isConnectorOrLineElement } from '../utils';
import { getReactSlideBackgroundStyle } from '../utils/slide-background-style';
/** SlideCanvas: Central canvas area for the PowerPoint editor. */
import type { SlideCanvasProps } from './canvas/canvas-types';
import { CanvasGuides, MarqueeOverlay, SnapLinesOverlay } from './canvas/CanvasOverlays';
import { CommentMarkersOverlay } from './canvas/CommentMarkersOverlay';
import { ConnectorEndpointOverlay } from './canvas/ConnectorEndpointOverlay';
import { ConnectorOverlay } from './canvas/ConnectorOverlay';
import { DrawingOverlaySvg } from './canvas/DrawingOverlaySvg';
import { GridOverlay } from './canvas/GridOverlay';
import { MotionPathOverlay } from './canvas/MotionPathOverlay';
import { Ruler } from './canvas/Ruler';
import { RULER_THICKNESS } from './canvas/ruler-utils';
import { SelectionHandleOverlay } from './canvas/SelectionHandleOverlay';
import { useCanvasEventHandlers } from './canvas/useCanvasEventHandlers';
import { useConnectorCreation } from './canvas/useConnectorCreation';
import { useDrawingOverlay } from './canvas/useDrawingOverlay';
import { useStableCallbacks } from './canvas/useStableCallbacks';
import { ElementRenderer } from './ElementRenderer';
import { ActiveXControlOverlay } from './elements/ActiveXControlOverlay';
import { SlideBackgroundImageLayer } from './SlideBackgroundImageLayer';

/**
 * A stable empty array for the un-selected case: a fresh `[]` on every render
 * would make `ElementRenderer`'s props change identity for every element on the
 * slide, defeating its memoisation.
 */
const EMPTY_ADJUSTMENT_HANDLES: ShapeAdjustmentHandleDescriptor[] = [];

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
	onUpdateSlideAnimations,
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

	/* ── Motion path overlay ───────────────────────────────────────── */
	// The path lives on the SLIDE's animation entry for the selected element, so
	// the overlay only needs the id to find it and a commit callback to edit it.
	const selectedMotionPath = selectedElement
		? motionPathFor(activeSlide?.animations ?? [], selectedElement.id)
		: undefined;
	const handleMotionPathChange = useCallback(
		(path: string) => {
			if (!selectedElement || !onUpdateSlideAnimations) {
				return;
			}
			onUpdateSlideAnimations(
				setMotionPath(activeSlide?.animations ?? [], selectedElement.id, path),
			);
		},
		[activeSlide?.animations, onUpdateSlideAnimations, selectedElement],
	);

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
		liveStrokeView,
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
			className='flex-1 flex overflow-auto relative'
			style={{ touchAction: 'pan-x pan-y' }}
			onMouseDown={handleViewportMouseDown}
		>
			<div
				ref={zoom.editWrapperRef}
				className='relative m-auto'
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
						// Motion-path keyframes translate by a fraction of the SLIDE, so
						// the stage publishes its own size for those calc() offsets.
						['--pptx-slide-w' as string]: `${canvasSize.width}px`,
						['--pptx-slide-h' as string]: `${canvasSize.height}px`,
						marginTop: rulerOffset,
						marginLeft: rulerOffset,
						// In edit/master mode the stage must own all touch gestures so
						// drag/resize/marquee aren't stolen by the browser for panning or
						// pinch-zoom. View/present mode keeps the default so the slide can
						// still be scrolled and swipe-navigated.
						touchAction: isEditableCanvas ? 'none' : undefined,
						...getReactSlideBackgroundStyle(activeSlide, {
							widthPx: canvasSize.width,
							heightPx: canvasSize.height,
						}),
					}}
					onClick={handleStageClick}
					onDoubleClick={handleStageDblClick}
					onMouseDown={handleStageMouseDown}
					onPointerDown={isEditableCanvas ? handleStagePointerDown : undefined}
					onContextMenu={handleStageContextMenu}
					onPointerMove={handleStagePointerMove}
					onPointerUp={handleStagePointerUp}
				>
					<SlideBackgroundImageLayer slide={activeSlide} />
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
							// No opacity override: PowerPoint paints layout/master content at
							// full opacity, and the other four bindings agree. The 0.95
							// "template" transparency comes from the templateEditing
							// affordance below, only while edit-template mode is on.
							templateEditing={editTemplateMode}
							zIndex={index}
							imageAltText='Template element'
							showResizeHandles={shouldShowElementHandles(
								isEditableCanvas,
								selectedElementIdSet.has(element.id),
								selectedElementIdSet.size,
							)}
							renderInk={false}
							renderGroups
							adjustmentHandles={
								isEditableCanvas && selectedElement?.id === element.id
									? getShapeAdjustmentHandleDescriptors(element)
									: EMPTY_ADJUSTMENT_HANDLES
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
							showResizeHandles={shouldShowElementHandles(
								isEditableCanvas,
								selectedElementIdSet.has(element.id),
								selectedElementIdSet.size,
							)}
							renderInk
							renderGroups
							adjustmentHandles={
								isEditableCanvas && selectedElement?.id === element.id
									? getShapeAdjustmentHandleDescriptors(element)
									: EMPTY_ADJUSTMENT_HANDLES
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

					{/* Resize/rotate/adjustment handles for the single selected
					    element, unclipped: see `SelectionHandleOverlay` for why they
					    cannot be `ElementRenderer`'s own children (its container
					    carries the shape's `clip-path`, which excludes every
					    descendant from hit-testing outside the preset's silhouette).
					    Connectors keep their own (already-unclipped) handles inside
					    `ConnectorElementRenderer`. Rendered even while inline-editing
					    text (PowerPoint keeps a text box's handles live and draggable
					    mid-edit): the host's `pointerEvents: 'none'` plus each handle
					    button's own small `forcePointerEvents` hit area (see
					    `ResizeHandles`) already confine every click that isn't
					    precisely on a handle to the shape/caret underneath, so nothing
					    extra is needed to keep caret placement working. */}
					{selectedElement &&
						shouldShowElementHandles(isEditableCanvas, true, selectedElementIdSet.size) &&
						!isConnectorOrLineElement(selectedElement) && (
							<SelectionHandleOverlay
								element={selectedElement}
								adjustmentHandles={getShapeAdjustmentHandleDescriptors(selectedElement)}
								onResizePointerDown={stableResizePointerDown}
								onAdjustmentPointerDown={stableAdjustmentPointerDown}
								onRotate={stableRotate}
								onClick={onClick}
								onDoubleClick={onDoubleClick}
								onContextMenu={onContextMenu}
							/>
						)}

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

					{/* Connector endpoint authoring: attach an end to a shape's
					    connection point, or drag it clear to detach. Shown for the
					    selected connector, so it needs no separate mode toggle (which
					    is why the older `connectorCreationMode` overlay below has
					    always been unreachable: nothing ever set that prop). */}
					{isEditableCanvas && selectedElement?.type === 'connector' && activeSlide && (
						<ConnectorEndpointOverlay
							connector={selectedElement}
							elements={activeSlide.elements}
							editorScale={zoom.editorScale}
							canvasStageRef={zoom.canvasStageRef}
							onUpdateElement={stableUpdateSmartArtElement}
						/>
					)}

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

					{isEditableCanvas && selectedElement && selectedMotionPath && (
						<MotionPathOverlay
							element={selectedElement}
							path={selectedMotionPath}
							canvasSize={canvasSize}
							scale={zoom.editorScale}
							canEdit={canEdit}
							onChangePath={handleMotionPathChange}
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
							liveStrokeView={liveStrokeView}
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
