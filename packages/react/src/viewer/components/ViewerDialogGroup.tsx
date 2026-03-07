/**
 * ViewerDialogGroup — Renders all modal / dialog overlays used by the
 * PowerPoint viewer.  Keeps the orchestrator component focused on layout.
 */
import type {
  PptxPresentationProperties,
  PptxSlide,
  PptxCoreProperties,
  PptxAppProperties,
  PptxCustomProperty,
} from "pptx-viewer-core";
import type { CanvasSize } from "../types";
import type { ViewerDialogsResult } from "../hooks/useViewerDialogs";
import type { InsertElementHandlers } from "../hooks/useInsertElements";
import type { ExportHandlersResult } from "../hooks/useExportHandlers";
import type { PrintHandlersResult } from "../hooks/usePrintHandlers";
import type { PropertyHandlersResult } from "../hooks/usePropertyHandlers";
import type { UsePresentationAnnotationsResult } from "../hooks/usePresentationAnnotations";

import {
  PasswordProtectionDialog,
  DocumentPropertiesDialog,
  FontEmbeddingPanel,
  DigitalSignaturesDialog,
  SignatureStrippedDialog,
  EncryptedFileDialog,
  VersionHistoryPanel,
  ExportProgressModal,
  KeepAnnotationsDialog,
  SetUpSlideShowDialog,
  BroadcastDialog,
  PrintDialog,
} from ".";
import { InsertSmartArtDialog } from "./InsertSmartArtDialog";
import { EquationEditorDialog } from "./EquationEditorDialog";
import { HyperlinkEditDialog } from "./HyperlinkEditDialog";
import { ComparePanel } from "./ComparePanel";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ViewerDialogGroupProps {
  dialogs: ViewerDialogsResult;
  insertHandlers: InsertElementHandlers;
  exportHandlers: ExportHandlersResult;
  printHandlers: PrintHandlersResult;
  propertyHandlers: PropertyHandlersResult;
  annotations: UsePresentationAnnotationsResult;
  slides: PptxSlide[];
  activeSlideIndex: number;
  canvasSize: CanvasSize;
  filePath: string | undefined;
  coreProperties: PptxCoreProperties | undefined;
  customProperties: PptxCustomProperty[];
  appProperties: PptxAppProperties | undefined;
  embeddedFonts: Array<{ name: string }>;
  hasDigitalSignatures: boolean;
  digitalSignatureCount: number;
  presentationProperties: PptxPresentationProperties;
  customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
  selectedElements: Array<{
    actionClick?: { url?: string; tooltip?: string; action?: string };
  }>;
  isEncryptedDialogOpen: boolean;
  setIsEncryptedDialogOpen: (v: boolean) => void;
  showKeepAnnotationsDialog: boolean;
  onKeepAnnotations: () => void;
  onDiscardAnnotations: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewerDialogGroup(props: ViewerDialogGroupProps) {
  const {
    dialogs,
    insertHandlers,
    exportHandlers,
    printHandlers,
    propertyHandlers,
    annotations,
    slides,
    activeSlideIndex,
    canvasSize,
    filePath,
    coreProperties,
    customProperties,
    appProperties,
    embeddedFonts,
    hasDigitalSignatures,
    digitalSignatureCount,
    presentationProperties,
    customShows,
    selectedElements,
    isEncryptedDialogOpen,
    setIsEncryptedDialogOpen,
    showKeepAnnotationsDialog,
    onKeepAnnotations,
    onDiscardAnnotations,
  } = props;

  return (
    <>
      <VersionHistoryPanel
        isOpen={propertyHandlers.isVersionHistoryOpen}
        filePath={filePath}
        onClose={() => propertyHandlers.setIsVersionHistoryOpen(false)}
        onRestore={propertyHandlers.handleRestoreVersion}
      />

      <ComparePanel
        isOpen={propertyHandlers.isComparePanelOpen}
        compareResult={propertyHandlers.compareResult}
        canvasSize={canvasSize}
        onClose={() => propertyHandlers.setIsComparePanelOpen(false)}
        onAcceptSlide={propertyHandlers.handleAcceptSlide}
        onRejectSlide={propertyHandlers.handleRejectSlide}
        onAcceptAll={propertyHandlers.handleAcceptAllSlides}
      />

      <PasswordProtectionDialog
        isOpen={dialogs.isPasswordDialogOpen}
        isCurrentlyProtected={dialogs.isPasswordProtected}
        onClose={() => dialogs.setIsPasswordDialogOpen(false)}
        onSetPassword={dialogs.handleSetPassword}
        onRemovePassword={dialogs.handleRemovePassword}
      />

      <DocumentPropertiesDialog
        isOpen={dialogs.isDocPropsDialogOpen}
        coreProperties={coreProperties ?? {}}
        customProperties={customProperties}
        appProperties={appProperties}
        onClose={() => dialogs.setIsDocPropsDialogOpen(false)}
        onSave={(core, custom, app) => {
          propertyHandlers.handleUpdateCoreProperties(core);
          propertyHandlers.handleUpdateCustomProperties(custom);
          if (app) {
            propertyHandlers.handleUpdateAppProperties(app);
          }
        }}
      />

      <FontEmbeddingPanel
        isOpen={dialogs.isFontEmbeddingOpen}
        embedFontsEnabled={dialogs.embedFontsEnabled}
        usedFontFamilies={propertyHandlers.usedFontFamilies}
        embeddedFonts={embeddedFonts.map((f) => f.name)}
        onClose={() => dialogs.setIsFontEmbeddingOpen(false)}
        onToggleEmbedFonts={dialogs.setEmbedFontsEnabled}
      />

      <DigitalSignaturesDialog
        isOpen={dialogs.isDigitalSigDialogOpen}
        onClose={() => dialogs.setIsDigitalSigDialogOpen(false)}
        hasSignatures={hasDigitalSignatures}
        signatureCount={digitalSignatureCount}
      />

      <SignatureStrippedDialog
        isOpen={dialogs.isSignatureStrippedDialogOpen}
        signatureCount={digitalSignatureCount}
        onConfirm={() => dialogs.setIsSignatureStrippedDialogOpen(false)}
        onCancel={() => dialogs.setIsSignatureStrippedDialogOpen(false)}
      />

      <EncryptedFileDialog
        isOpen={isEncryptedDialogOpen}
        onClose={() => setIsEncryptedDialogOpen(false)}
      />

      <InsertSmartArtDialog
        isOpen={dialogs.isSmartArtDialogOpen}
        onClose={() => dialogs.setIsSmartArtDialogOpen(false)}
        onInsert={insertHandlers.handleInsertSmartArt}
      />

      <EquationEditorDialog
        isOpen={dialogs.isEquationDialogOpen}
        onClose={() => dialogs.setIsEquationDialogOpen(false)}
        onInsert={insertHandlers.handleInsertEquation}
        existingOmml={dialogs.editingEquationOmml}
      />

      <HyperlinkEditDialog
        open={dialogs.isHyperlinkDialogOpen}
        initialUrl={selectedElements[0]?.actionClick?.url}
        initialTooltip={selectedElements[0]?.actionClick?.tooltip}
        initialAction={selectedElements[0]?.actionClick?.action}
        slideCount={slides.length}
        onConfirm={insertHandlers.handleHyperlinkConfirm}
        onCancel={() => dialogs.setIsHyperlinkDialogOpen(false)}
      />

      <ExportProgressModal
        isOpen={exportHandlers.exportModalOpen}
        title={exportHandlers.exportModalTitle}
        progress={exportHandlers.exportProgress}
        statusMessage={exportHandlers.exportStatusMessage}
        onCancel={exportHandlers.handleCancelExport}
      />

      <SetUpSlideShowDialog
        open={dialogs.isSetUpSlideShowOpen}
        onClose={() => dialogs.setIsSetUpSlideShowOpen(false)}
        properties={presentationProperties}
        onSave={dialogs.handleSaveSlideShowSettings}
        customShows={customShows}
        slideCount={slides.length}
      />

      <BroadcastDialog
        open={dialogs.isBroadcastDialogOpen}
        onClose={() => dialogs.setIsBroadcastDialogOpen(false)}
      />

      <PrintDialog
        open={printHandlers.isPrintDialogOpen}
        onClose={() => printHandlers.setIsPrintDialogOpen(false)}
        onPrint={printHandlers.handlePrintWithSettings}
        slides={slides}
        activeSlideIndex={activeSlideIndex}
        defaultSlidesPerPage={presentationProperties.printSlidesPerPage}
        defaultFrameSlides={presentationProperties.printFrameSlides}
      />

      <KeepAnnotationsDialog
        isOpen={showKeepAnnotationsDialog}
        annotationCount={Array.from(
          annotations.allSlideAnnotations.values(),
        ).reduce((sum, strokes) => sum + strokes.length, 0)}
        slideCount={annotations.allSlideAnnotations.size}
        onKeep={onKeepAnnotations}
        onDiscard={onDiscardAnnotations}
      />
    </>
  );
}
