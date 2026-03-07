/**
 * ViewerToolbarSection — Renders the top toolbar, signature badge,
 * and hidden file-input elements.
 */
import type React from "react";

import type { PptxElement, PptxSlide } from "pptx-viewer-core";
import type { SupportedShapeType, ViewerMode } from "../types";
import type { DrawingTool, ToolbarSection } from "../types-ui";
import type { EditorHistoryResult } from "../hooks/useEditorHistory";
import type { ElementManipulationHandlers } from "../hooks/useElementManipulation";
import type { InsertElementHandlers } from "../hooks/useInsertElements";
import type { ExportHandlersResult } from "../hooks/useExportHandlers";
import type { PrintHandlersResult } from "../hooks/usePrintHandlers";
import type { PropertyHandlersResult } from "../hooks/usePropertyHandlers";
import type { ViewerDialogsResult } from "../hooks/useViewerDialogs";
import type { SlideManagementHandlers } from "../hooks/useSlideManagement";
import type { ElementOperations } from "../hooks/useElementOperations";
import type { ElementClipboardPayload } from "../types-core";

import { Toolbar, SignatureStatusBadge } from ".";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewerToolbarSectionProps {
  mode: ViewerMode;
  canEdit: boolean;
  state: {
    isSlidesPaneOpen: boolean;
    setIsSlidesPaneOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isInspectorPaneOpen: boolean;
    setIsInspectorPaneOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isCompactToolbarOpen: boolean;
    setIsCompactToolbarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    toolbarSection: ToolbarSection;
    setToolbarSection: React.Dispatch<React.SetStateAction<ToolbarSection>>;
    newShapeType: SupportedShapeType;
    setNewShapeType: React.Dispatch<React.SetStateAction<SupportedShapeType>>;
    activeTool: DrawingTool;
    setActiveTool: React.Dispatch<React.SetStateAction<DrawingTool>>;
    drawingColor: string;
    setDrawingColor: React.Dispatch<React.SetStateAction<string>>;
    drawingWidth: number;
    setDrawingWidth: React.Dispatch<React.SetStateAction<number>>;
    clipboardPayload: ElementClipboardPayload | null;
    editTemplateMode: boolean;
    setEditTemplateMode: React.Dispatch<React.SetStateAction<boolean>>;
    spellCheckEnabled: boolean;
    setSpellCheckEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    showGrid: boolean;
    setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
    showRulers: boolean;
    setShowRulers: React.Dispatch<React.SetStateAction<boolean>>;
    snapToGrid: boolean;
    setSnapToGrid: React.Dispatch<React.SetStateAction<boolean>>;
    snapToShape: boolean;
    setSnapToShape: React.Dispatch<React.SetStateAction<boolean>>;
    isOverflowMenuOpen: boolean;
    setIsOverflowMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    layoutOptions: Array<{ path: string; name: string }>;
    hasMacros: boolean;
    isThemeEditorOpen: boolean;
    setIsThemeEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isThemeGalleryOpen: boolean;
    setIsThemeGalleryOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isSelectionPaneOpen: boolean;
    setIsSelectionPaneOpen: React.Dispatch<React.SetStateAction<boolean>>;
    formatPainterActive: boolean;
    setFormatPainterActive: React.Dispatch<React.SetStateAction<boolean>>;
    eyedropperActive: boolean;
    setEyedropperActive: React.Dispatch<React.SetStateAction<boolean>>;
    customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
    activeCustomShowId: string | null;
    setActiveCustomShowId: React.Dispatch<React.SetStateAction<string | null>>;
    setIsShortcutHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setShowSlideSorter: React.Dispatch<React.SetStateAction<boolean>>;
    presentationProperties: { showSubtitles?: boolean };
    hasDigitalSignatures: boolean;
    digitalSignatureCount: number;
    imageInputRef: React.RefObject<HTMLInputElement | null>;
    mediaInputRef: React.RefObject<HTMLInputElement | null>;
  };
  selectedElement: PptxElement | null;
  activeSlide: PptxSlide | undefined;
  zoom: {
    scale: number;
    handleZoomIn: () => void;
    handleZoomOut: () => void;
    handleZoomToFit: () => void;
  };
  history: EditorHistoryResult;
  findReplace: {
    findReplaceOpen: boolean;
    setFindReplaceOpen: (open: boolean) => void;
  };
  manipulation: ElementManipulationHandlers;
  insertHandlers: InsertElementHandlers;
  exportHandlers: ExportHandlersResult;
  printHandlers: PrintHandlersResult;
  propertyHandlers: PropertyHandlersResult;
  dialogs: ViewerDialogsResult;
  slideOps: SlideManagementHandlers;
  ops: ElementOperations;
  onSetMode: (mode: ViewerMode) => void;
  onEnterPresenterView: () => void;
  onEnterRehearsalMode: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewerToolbarSection(props: ViewerToolbarSectionProps) {
  const {
    mode,
    canEdit,
    state: s,
    selectedElement,
    activeSlide,
    zoom,
    history,
    findReplace,
    manipulation,
    insertHandlers,
    exportHandlers,
    printHandlers,
    propertyHandlers,
    dialogs,
    slideOps,
    ops,
    onSetMode,
    onEnterPresenterView,
    onEnterRehearsalMode,
  } = props;

  return (
    <>
      <Toolbar
        mode={mode}
        canEdit={canEdit}
        isNarrowViewport={dialogs.isNarrowViewport}
        isSidebarCollapsed={!s.isSlidesPaneOpen}
        isInspectorPaneOpen={s.isInspectorPaneOpen}
        isCompactToolbarOpen={s.isCompactToolbarOpen}
        toolbarSection={s.toolbarSection}
        scale={zoom.scale}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        undoLabel={history.undoLabel}
        redoLabel={history.redoLabel}
        findReplaceOpen={findReplace.findReplaceOpen}
        selectedElement={selectedElement}
        editTemplateMode={s.editTemplateMode}
        newShapeType={s.newShapeType}
        activeTool={s.activeTool}
        drawingColor={s.drawingColor}
        drawingWidth={s.drawingWidth}
        clipboardPayload={s.clipboardPayload}
        onSetMode={onSetMode}
        onToggleSidebar={() => s.setIsSlidesPaneOpen((p) => !p)}
        onToggleInspector={() => s.setIsInspectorPaneOpen((p) => !p)}
        onToggleCompactToolbar={() => s.setIsCompactToolbarOpen((p) => !p)}
        onSetToolbarSection={s.setToolbarSection}
        onZoomIn={zoom.handleZoomIn}
        onZoomOut={zoom.handleZoomOut}
        onZoomToFit={zoom.handleZoomToFit}
        onUndo={history.handleUndo}
        onRedo={history.handleRedo}
        onToggleFindReplace={() =>
          findReplace.setFindReplaceOpen(!findReplace.findReplaceOpen)
        }
        onSetNewShapeType={s.setNewShapeType}
        onAddTextBox={insertHandlers.handleAddTextBox}
        onAddShape={insertHandlers.handleAddShape}
        onAddTable={insertHandlers.handleAddTable}
        onAddSmartArt={() => dialogs.setIsSmartArtDialogOpen(true)}
        onAddEquation={() => {
          dialogs.setEditingEquationOmml(null);
          dialogs.setIsEquationDialogOpen(true);
        }}
        onAddActionButton={insertHandlers.handleAddActionButton}
        onInsertField={insertHandlers.handleInsertField}
        onOpenImagePicker={() => s.imageInputRef.current?.click()}
        onOpenMediaPicker={() => s.mediaInputRef.current?.click()}
        onSetActiveTool={s.setActiveTool}
        onSetDrawingColor={s.setDrawingColor}
        onSetDrawingWidth={s.setDrawingWidth}
        onSetEditTemplateMode={s.setEditTemplateMode}
        spellCheckEnabled={s.spellCheckEnabled}
        showGrid={s.showGrid}
        showRulers={s.showRulers}
        snapToGrid={s.snapToGrid}
        snapToShape={s.snapToShape}
        onSetSpellCheckEnabled={s.setSpellCheckEnabled}
        onSetShowGrid={s.setShowGrid}
        onSetShowRulers={s.setShowRulers}
        onSetSnapToGrid={s.setSnapToGrid}
        onSetSnapToShape={s.setSnapToShape}
        onAddGuide={dialogs.handleAddGuide}
        onAlignElements={manipulation.handleAlignElements}
        onCopy={manipulation.handleCopy}
        onCut={manipulation.handleCut}
        onPaste={manipulation.handlePaste}
        onFlip={manipulation.handleFlip}
        onMoveLayer={manipulation.handleMoveLayer}
        onMoveLayerToEdge={manipulation.handleMoveLayerToEdge}
        onDuplicate={manipulation.handleDuplicate}
        onDelete={manipulation.handleDelete}
        onExportPng={exportHandlers.handleExportPng}
        onExportPdf={exportHandlers.handleExportPdf}
        onExportVideo={exportHandlers.handleExportVideo}
        onExportGif={exportHandlers.handleExportGif}
        onPackageForSharing={exportHandlers.handlePackageForSharing}
        onSaveAsPpsx={exportHandlers.handleSaveAsPpsx}
        onSaveAsPptm={exportHandlers.handleSaveAsPptm}
        hasMacros={s.hasMacros}
        onCopySlideAsImage={exportHandlers.handleCopySlideAsImage}
        onPrint={printHandlers.handlePrint}
        onToggleShortcuts={() => s.setIsShortcutHelpOpen((p) => !p)}
        onRunAccessibilityCheck={dialogs.handleRunAccessibilityCheck}
        onToggleSlideSorter={() => s.setShowSlideSorter((p) => !p)}
        onUpdateTextStyle={ops.updateSelectedTextStyle}
        isOverflowMenuOpen={s.isOverflowMenuOpen}
        onSetOverflowMenuOpen={s.setIsOverflowMenuOpen}
        layoutOptions={s.layoutOptions}
        onInsertSlideFromLayout={slideOps.handleInsertSlideFromLayout}
        customShows={s.customShows}
        activeCustomShowId={s.activeCustomShowId}
        onSetActiveCustomShowId={s.setActiveCustomShowId}
        onCreateCustomShow={dialogs.handleCreateCustomShow}
        onRenameActiveCustomShow={dialogs.handleRenameActiveCustomShow}
        onDeleteActiveCustomShow={dialogs.handleDeleteActiveCustomShow}
        onToggleCurrentSlideInActiveShow={
          dialogs.handleToggleCurrentSlideInActiveShow
        }
        isCurrentSlideInActiveShow={dialogs.isCurrentSlideInActiveShow}
        onEnterMasterView={dialogs.handleEnterMasterView}
        onCloseMasterView={dialogs.handleCloseMasterView}
        onToggleVersionHistory={() =>
          propertyHandlers.setIsVersionHistoryOpen((p) => !p)
        }
        onOpenPasswordProtection={() => dialogs.setIsPasswordDialogOpen(true)}
        onOpenDocumentProperties={() => dialogs.setIsDocPropsDialogOpen(true)}
        onOpenFontEmbedding={() => dialogs.setIsFontEmbeddingOpen(true)}
        onOpenDigitalSignatures={() => dialogs.setIsDigitalSigDialogOpen(true)}
        onEnterPresenterView={onEnterPresenterView}
        onEnterRehearsalMode={onEnterRehearsalMode}
        onToggleThemeEditor={() => s.setIsThemeEditorOpen((p) => !p)}
        isThemeEditorOpen={s.isThemeEditorOpen}
        onToggleThemeGallery={() => s.setIsThemeGalleryOpen((p) => !p)}
        isThemeGalleryOpen={s.isThemeGalleryOpen}
        onCompare={propertyHandlers.handleCompare}
        onToggleComments={() => s.setIsInspectorPaneOpen((p) => !p)}
        isCommentsPanelOpen={s.isInspectorPaneOpen}
        slideCommentCount={activeSlide?.comments?.length ?? 0}
        formatPainterActive={s.formatPainterActive}
        onToggleFormatPainter={() => s.setFormatPainterActive((p) => !p)}
        isSelectionPaneOpen={s.isSelectionPaneOpen}
        onToggleSelectionPane={() => s.setIsSelectionPaneOpen((p) => !p)}
        eyedropperActive={s.eyedropperActive}
        onToggleEyedropper={() => s.setEyedropperActive((p) => !p)}
        onOpenSetUpSlideShow={() => dialogs.setIsSetUpSlideShowOpen(true)}
        onOpenBroadcastDialog={() => dialogs.setIsBroadcastDialogOpen(true)}
        onToggleSubtitles={dialogs.handleToggleSubtitles}
        showSubtitles={Boolean(s.presentationProperties.showSubtitles)}
      />

      {/* Signature status badge */}
      {s.hasDigitalSignatures && (
        <div className="flex items-center px-3 py-1 z-10">
          <SignatureStatusBadge
            hasSignatures={s.hasDigitalSignatures}
            signatureCount={s.digitalSignatureCount}
            onClick={() => dialogs.setIsDigitalSigDialogOpen(true)}
          />
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={s.imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={insertHandlers.handleImageFileChange}
      />
      <input
        ref={s.mediaInputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={insertHandlers.handleMediaFileChange}
      />
    </>
  );
}
