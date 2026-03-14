/** SlideCanvas — Central canvas area for the PowerPoint editor. */
import type { SlideCanvasProps } from "./canvas/canvas-types";
import { useStableCallbacks } from "./canvas/useStableCallbacks";
import { useCanvasEventHandlers } from "./canvas/useCanvasEventHandlers";
import { useConnectorCreation } from "./canvas/useConnectorCreation";
import { useDrawingOverlay } from "./canvas/useDrawingOverlay";
import { ElementRenderer } from "./ElementRenderer";
import { getShapeAdjustmentHandleDescriptor } from "../utils";
import { Ruler, RULER_THICKNESS } from "./canvas/Ruler";
import { GridOverlay } from "./canvas/GridOverlay";
import {
  CanvasGuides,
  SlideBackground,
  MarqueeOverlay,
  SnapLinesOverlay,
} from "./canvas/CanvasOverlays";
import { ConnectorOverlay } from "./canvas/ConnectorOverlay";
import { CommentMarkersOverlay } from "./canvas/CommentMarkersOverlay";
import { DrawingOverlaySvg } from "./canvas/DrawingOverlaySvg";

export type { SlideCanvasProps } from "./canvas/canvas-types";

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
  rulerUnit = "inches",
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
  onInlineEditChange,
  onInlineEditCommit,
  onInlineEditCancel,
  onTableCellSelect,
  onCommitCellEdit,
  onResizeTableColumns,
  onResizeTableRow,
  findResults,
  findResultIndex,
  activeSlideIndex,
  activeTool = "select",
  drawingColor = "#000000",
  drawingWidth = 3,
  isDrawingRef,
  onAddInkElement,
  onAddFreeformShape,
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
}: SlideCanvasProps) {
  /* ── Stable callback refs ──────────────────────────────────────── */
  const {
    cbRef,
    stableResizePointerDown,
    stableAdjustmentPointerDown,
    stableInlineEditChange,
    stableInlineEditCommit,
    stableInlineEditCancel,
    stableTableCellSelect,
    stableCommitCellEdit,
    stableResizeTableColumns,
    stableResizeTableRow,
  } = useStableCallbacks({
    onClick,
    onDoubleClick,
    onMouseDown,
    onContextMenu,
    onResizePointerDown,
    onAdjustmentPointerDown,
    onInlineEditChange,
    onInlineEditCommit,
    onInlineEditCancel,
    onTableCellSelect,
    onCommitCellEdit,
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
  });

  const rulerOffset = showRulers ? RULER_THICKNESS : 0;

  return (
    <div ref={zoom.canvasViewportRef} className="flex-1 overflow-auto relative">
      <div
        ref={zoom.editWrapperRef}
        className="relative mx-auto my-4"
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
        <div
          ref={zoom.canvasStageRef}
          role="region"
          aria-label={`Slide ${(activeSlideIndex ?? 0) + 1}`}
          aria-roledescription="slide"
          className="relative shadow-2xl"
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            transform: `scale(${zoom.editorScale})`,
            transformOrigin: "top left",
            marginTop: rulerOffset,
            marginLeft: rulerOffset,
            backgroundColor:
              activeSlide?.backgroundColor &&
              activeSlide.backgroundColor !== "transparent"
                ? activeSlide.backgroundColor
                : "#ffffff",
          }}
          onClick={handleStageClick}
          onDoubleClick={handleStageDblClick}
          onMouseDown={handleStageMouseDown}
          onContextMenu={handleStageContextMenu}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
        >
          {presentationKeyframesCss && (
            <style>{presentationKeyframesCss}</style>
          )}
          <GridOverlay
            canvasSize={canvasSize}
            gridSpacingPx={gridSpacingPx}
            visible={showGrid}
          />
          <CanvasGuides
            guides={guides}
            onDeleteGuide={onDeleteGuide}
            onStartGuideDrag={setDraggingGuide}
          />
          <SlideBackground
            backgroundImage={activeSlide?.backgroundImage}
            backgroundGradient={activeSlide?.backgroundGradient}
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
              canInteract={
                (mode === "edit" || mode === "master") &&
                canEdit &&
                editTemplateMode
              }
              spellCheckEnabled={spellCheckEnabled}
              mediaDataUrls={mediaDataUrls}
              selectionColorClass="blue-400"
              showHoverBorder={false}
              opacity={0.95}
              zIndex={index}
              imageAltText="Template element"
              showResizeHandles={
                selectedElementIdSet.has(element.id) &&
                selectedElementIdSet.size <= 1 &&
                !inlineEditingElementId
              }
              renderInk={false}
              renderGroups={false}
              adjustmentHandleDescriptor={
                selectedElement?.id === element.id
                  ? getShapeAdjustmentHandleDescriptor(element)
                  : null
              }
              onResizePointerDown={stableResizePointerDown}
              onAdjustmentPointerDown={stableAdjustmentPointerDown}
              onInlineEditChange={stableInlineEditChange}
              onInlineEditCommit={stableInlineEditCommit}
              onInlineEditCancel={stableInlineEditCancel}
              onActionClick={onActionClick}
              onHyperlinkClick={onHyperlinkClick}
              animationState={presentationElementStates?.get(element.id)}
              presentationElementStates={presentationElementStates}
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
              canInteract={(mode === "edit" || mode === "master") && canEdit}
              spellCheckEnabled={spellCheckEnabled}
              mediaDataUrls={mediaDataUrls}
              tableEditorState={tableEditorState}
              selectionColorClass="blue-500"
              showHoverBorder={true}
              zIndex={templateElements.length + index}
              imageAltText="Slide element"
              showResizeHandles={
                selectedElementIdSet.has(element.id) &&
                selectedElementIdSet.size <= 1 &&
                !inlineEditingElementId
              }
              renderInk={true}
              renderGroups={true}
              adjustmentHandleDescriptor={
                selectedElement?.id === element.id
                  ? getShapeAdjustmentHandleDescriptor(element)
                  : null
              }
              onResizePointerDown={stableResizePointerDown}
              onAdjustmentPointerDown={stableAdjustmentPointerDown}
              onInlineEditChange={stableInlineEditChange}
              onInlineEditCommit={stableInlineEditCommit}
              onInlineEditCancel={stableInlineEditCancel}
              onTableCellSelect={stableTableCellSelect}
              onCommitCellEdit={stableCommitCellEdit}
              onResizeTableColumns={stableResizeTableColumns}
              onResizeTableRow={stableResizeTableRow}
              findHighlights={elementFindHighlightsMap.get(element.id)}
              onActionClick={onActionClick}
              onHyperlinkClick={onHyperlinkClick}
              animationState={presentationElementStates?.get(element.id)}
              presentationElementStates={presentationElementStates}
            />
          ))}

          <MarqueeOverlay marqueeSelectionState={marqueeSelectionState} />

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
        </div>
      </div>
    </div>
  );
}
