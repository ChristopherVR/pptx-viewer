/**
 * ViewerMainContent — The primary content area containing sidebars,
 * canvas, context menu, and side panels.
 */
import type { PptxElement, PptxSlide } from "pptx-viewer-core";
import type { CanvasSize, SlideSectionGroup } from "../types";
import type { ViewerMode } from "../types-core";
import type { ViewerState } from "../hooks/useViewerState";
import type { EditorOperationsResult } from "../hooks/useEditorOperations";
import type { ViewerDialogsResult } from "../hooks/useViewerDialogs";
import type { UsePresentationModeResult } from "../hooks/usePresentationMode";
import type { UsePresentationAnnotationsResult } from "../hooks/usePresentationAnnotations";
import type { PropertyHandlersResult } from "../hooks/usePropertyHandlers";
import type { ThemeHandlersResult } from "../hooks/useThemeHandlers";
import type { EditorHistoryResult } from "../hooks/useEditorHistory";
import type { UseCommentsResult } from "../hooks/useComments-helpers";
import type { UseZoomViewportResult } from "../hooks/useZoomViewport";

import { SlidesPaneSidebar, MasterViewSidebar, ContextMenu } from ".";
import { ViewerCanvasArea } from "./ViewerCanvasArea";
import { ViewerSidePanels } from "./ViewerSidePanels";

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
  zoom: UseZoomViewportResult;
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
    zoom,
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

  return (
    <div className="relative z-10 flex flex-1 min-h-0">
      {showSlidesPane && (
        <SlidesPaneSidebar
          slides={slides}
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
          rehearsalTimings={
            Object.keys(presentation.recordedTimings).length > 0
              ? presentation.recordedTimings
              : undefined
          }
        />
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
          handoutSlidesPerPage={state.handoutSlidesPerPage}
          onSelectMaster={dialogs.handleSelectMaster}
          onSelectLayout={dialogs.handleSelectLayout}
          onCollapse={() => state.setIsSlidesPaneOpen(false)}
          onTabChange={state.setMasterViewTab}
          onHandoutSlidesPerPageChange={state.setHandoutSlidesPerPage}
        />
      )}

      <ViewerCanvasArea
        mode={mode}
        canEdit={canEdit}
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
        findReplace={findReplace}
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
      />
    </div>
  );
}
