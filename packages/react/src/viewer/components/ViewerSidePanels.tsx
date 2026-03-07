/**
 * ViewerSidePanels — Inspector pane, selection pane, theme editor panel,
 * and theme gallery that appear alongside the slide canvas.
 */
import type { PptxElement, PptxSlide } from "pptx-viewer-core";
import type { CanvasSize } from "../types";
import type { ViewerMode } from "../types-core";
import type { ElementOperations } from "../hooks/useElementOperations";
import type { ElementManipulationHandlers } from "../hooks/useElementManipulation";
import type { PropertyHandlersResult } from "../hooks/usePropertyHandlers";
import type { ThemeHandlersResult } from "../hooks/useThemeHandlers";
import type { EditorHistoryResult } from "../hooks/useEditorHistory";
import type { UseCommentsResult } from "../hooks/useComments-helpers";
import type { ViewerState } from "../hooks/useViewerState";
import type { ThemeDefinition } from "./toolbar/ThemeGallery";

import { ViewerInspector, SelectionPane } from ".";
import { ThemeEditorPanel } from "./inspector/ThemeEditorPanel";
import { ThemeGallery } from "./toolbar/ThemeGallery";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewerSidePanelsProps {
  mode: ViewerMode;
  canEdit: boolean;
  activeSlide: PptxSlide | undefined;
  masterPseudoSlide: PptxSlide | undefined;
  slides: PptxSlide[];
  canvasSize: CanvasSize;
  activeSlideIndex: number;
  selectedElement: PptxElement | null;
  state: ViewerState;
  comments: UseCommentsResult;
  ops: ElementOperations;
  manipulation: ElementManipulationHandlers;
  propertyHandlers: PropertyHandlersResult;
  themeHandlers: ThemeHandlersResult;
  history: EditorHistoryResult;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewerSidePanels(props: ViewerSidePanelsProps) {
  const {
    mode,
    canEdit,
    activeSlide,
    masterPseudoSlide,
    slides,
    canvasSize,
    activeSlideIndex,
    selectedElement,
    state: s,
    comments,
    ops,
    manipulation,
    propertyHandlers,
    themeHandlers,
    history,
  } = props;

  const effectiveSlide = mode === "master" ? masterPseudoSlide : activeSlide;

  return (
    <>
      <ViewerInspector
        isOpen={(mode === "edit" || mode === "master") && s.isInspectorPaneOpen}
        canEdit={canEdit}
        mode={mode}
        activeSlide={effectiveSlide}
        slides={slides}
        canvasSize={canvasSize}
        selectedElement={selectedElement}
        effectiveSelectedIds={s.effectiveSelectedIds}
        tableEditorState={s.tableEditorState}
        sidebarPanelMode={s.sidebarPanelMode}
        activeSlideIndex={activeSlideIndex}
        comments={comments}
        onSetSidebarPanelMode={s.setSidebarPanelMode}
        onClose={() => s.setIsInspectorPaneOpen(false)}
        onUpdateElementStyle={ops.updateSelectedShapeStyle}
        onUpdateTextStyle={ops.updateSelectedTextStyle}
        onUpdateElement={ops.updateSelectedElement}
        onApplySelection={ops.applySelection}
        onSetCanvasSize={s.setCanvasSize}
        onMoveLayer={manipulation.handleMoveLayer}
        onMoveLayerToEdge={manipulation.handleMoveLayerToEdge}
        onDeleteElement={manipulation.handleDelete}
        onUpdateSlide={propertyHandlers.handleUpdateSlide}
        presentationProperties={s.presentationProperties}
        onUpdatePresentationProperties={
          propertyHandlers.handleUpdatePresentationProperties
        }
        editTemplateMode={s.editTemplateMode}
        slideMasters={s.slideMasters}
        themeOptions={s.themeOptions}
        notesMaster={s.notesMaster}
        handoutMaster={s.handoutMaster}
        notesCanvasSize={s.notesCanvasSize}
        coreProperties={s.coreProperties}
        appProperties={s.appProperties}
        customProperties={s.customProperties}
        tagCollections={s.tagCollections}
        onUpdateTagCollections={s.setTagCollections}
        onUpdateCoreProperties={propertyHandlers.handleUpdateCoreProperties}
        onUpdateAppProperties={propertyHandlers.handleUpdateAppProperties}
        onUpdateCustomProperties={propertyHandlers.handleUpdateCustomProperties}
        onApplyTheme={themeHandlers.handleApplyTheme}
        onSetTemplateBackground={themeHandlers.handleSetTemplateBackground}
        onGetTemplateBackgroundColor={
          themeHandlers.handleGetTemplateBackgroundColor
        }
        mediaDataUrls={s.mediaDataUrls}
        theme={s.theme}
      />

      {s.isSelectionPaneOpen && (mode === "edit" || mode === "master") && (
        <div className="absolute right-0 top-0 z-30 h-full">
          <SelectionPane
            slides={slides}
            activeSlideIndex={activeSlideIndex}
            selectedElementId={s.selectedElementId}
            selectedElementIds={s.selectedElementIds}
            canEdit={canEdit}
            setSelectedElementId={s.setSelectedElementId}
            setSelectedElementIds={s.setSelectedElementIds}
            setSlides={s.setSlides}
            markDirty={history.markDirty}
            onClose={() => s.setIsSelectionPaneOpen(false)}
          />
        </div>
      )}

      {s.isThemeEditorOpen && mode === "edit" && (
        <div className="absolute right-0 top-0 z-30 h-full w-72 overflow-y-auto border-l border-gray-700 bg-gray-900 p-2.5 shadow-xl">
          <ThemeEditorPanel
            theme={s.theme}
            canEdit={canEdit}
            onUpdateColorScheme={themeHandlers.handleUpdateThemeColorScheme}
            onUpdateFontScheme={themeHandlers.handleUpdateThemeFontScheme}
            onUpdateThemeName={themeHandlers.handleUpdateThemeName}
            onApplyToPresentation={themeHandlers.handleApplyThemeToPresentation}
            onClose={() => s.setIsThemeEditorOpen(false)}
          />
        </div>
      )}

      <ThemeGallery
        open={s.isThemeGalleryOpen}
        currentTheme={null}
        canEdit={canEdit}
        onClose={() => s.setIsThemeGalleryOpen(false)}
        onApplyTheme={(theme: ThemeDefinition) => {
          themeHandlers.handleApplyThemeData(
            theme.colorScheme,
            {
              majorFont: {
                latin: theme.fontScheme.majorFont,
                eastAsia: theme.fontScheme.majorFont,
                complexScript: theme.fontScheme.majorFont,
              },
              minorFont: {
                latin: theme.fontScheme.minorFont,
                eastAsia: theme.fontScheme.minorFont,
                complexScript: theme.fontScheme.minorFont,
              },
            },
            theme.name,
          );
        }}
      />
    </>
  );
}
