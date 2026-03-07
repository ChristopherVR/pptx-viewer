/**
 * useExportSaveAs — Save-As format and Package-for-Sharing handlers.
 */
import type { RefObject } from "react";
import type {
  PptxSlide,
  PptxSaveFormat,
  PptxHandler,
} from "pptx-viewer-core";
import { guidePxToEmu } from "pptx-viewer-core";
import { collectMediaAssets, generatePackageReadme } from "../utils/export";
import { getElectronFilesApi } from "../utils/electron-files";
import type { ExportModalControls } from "./export-handler-types";

export interface UseExportSaveAsInput {
  slides: PptxSlide[];
  filePath: string | undefined;
  handlerRef: RefObject<PptxHandler | null>;
  serializeSlides: () => Promise<Uint8Array | null>;
  headerFooter: Record<string, unknown>;
  presentationProperties: Record<string, unknown>;
  customShows: Array<{ id: string; name: string; slideRIds: string[] }>;
  sections: Array<{
    id: string;
    name: string;
    color?: string;
    collapsed?: boolean;
  }>;
  coreProperties: Record<string, unknown> | null;
  appProperties: Record<string, unknown> | null;
  customProperties: Array<Record<string, unknown>>;
  notesMaster: Record<string, unknown> | undefined;
  handoutMaster: Record<string, unknown> | undefined;
  guides: Array<{ id: string; axis: "h" | "v"; position: number }>;
  activeSlideIndexForGuides: number;
  modalControls: ExportModalControls;
}

export interface ExportSaveAsResult {
  handlePackageForSharing: () => Promise<void>;
  handleSaveAsFormat: (format: PptxSaveFormat) => Promise<void>;
  handleSaveAsPpsx: () => void;
  handleSaveAsPptm: () => void;
}

export function useExportSaveAs(
  input: UseExportSaveAsInput,
): ExportSaveAsResult {
  const {
    slides,
    filePath,
    handlerRef,
    serializeSlides,
    headerFooter,
    presentationProperties,
    customShows,
    sections,
    coreProperties,
    appProperties,
    customProperties,
    notesMaster,
    handoutMaster,
    guides,
    activeSlideIndexForGuides,
    modalControls,
  } = input;

  const {
    setExportModalOpen,
    setExportModalTitle,
    setExportProgress,
    setExportStatusMessage,
    exportAbortRef,
  } = modalControls;

  const handlePackageForSharing = async () => {
    const electronApi = getElectronFilesApi();
    if (!electronApi) {
      console.warn("[PowerPointViewer] Package export requires Electron");
      return;
    }
    const destFolder = await electronApi.openFolderDialog();
    if (!destFolder) return;
    const abortCtrl = new AbortController();
    exportAbortRef.current = abortCtrl;
    setExportModalTitle("Package for Sharing");
    setExportStatusMessage("Preparing package...");
    setExportProgress(0);
    setExportModalOpen(true);
    try {
      const packageDir = destFolder + "/presentation-package";
      const mediaDir = packageDir + "/media";
      await electronApi.createFolder(packageDir);
      await electronApi.createFolder(mediaDir);
      setExportProgress(10);
      setExportStatusMessage("Copying presentation...");
      const pptxData = await serializeSlides();
      if (pptxData) {
        const pptxFilename = filePath
          ? (filePath.replace(/\\/g, "/").split("/").pop() ??
            "presentation.pptx")
          : "presentation.pptx";
        await electronApi.writeBinaryFile(
          packageDir + "/" + pptxFilename,
          pptxData,
        );
      }
      setExportProgress(30);
      setExportStatusMessage("Collecting media assets...");
      const mediaAssets = collectMediaAssets(
        slides as Array<{
          elements?: Array<{
            type?: string;
            src?: string;
            imageSrc?: string;
            mediaSrc?: string;
          }>;
        }>,
      );
      const totalAssets = mediaAssets.length;
      for (let i = 0; i < totalAssets; i++) {
        if (abortCtrl.signal.aborted)
          throw new DOMException("Export cancelled", "AbortError");
        const asset = mediaAssets[i];
        setExportProgress(
          30 + Math.round(((i + 1) / Math.max(totalAssets, 1)) * 50),
        );
        setExportStatusMessage(`Copying media ${i + 1} of ${totalAssets}...`);
        try {
          await electronApi.copyFile(
            asset.sourcePath,
            mediaDir + "/" + asset.filename,
          );
        } catch {
          console.warn(
            `[export] Could not copy media asset: ${asset.sourcePath}`,
          );
        }
      }
      setExportProgress(85);
      setExportStatusMessage("Writing README...");
      const pptxName = filePath
        ? (filePath.replace(/\\/g, "/").split("/").pop() ?? "presentation.pptx")
        : "presentation.pptx";
      const readme = generatePackageReadme(pptxName);
      await electronApi.writeFile(packageDir + "/README.txt", readme);
      setExportProgress(100);
    } catch (err) {
      if ((err as DOMException).name !== "AbortError")
        console.error("[PowerPointViewer] Package export failed:", err);
    } finally {
      exportAbortRef.current = null;
      setExportModalOpen(false);
    }
  };

  const handleSaveAsFormat = async (format: PptxSaveFormat): Promise<void> => {
    const handler = handlerRef.current;
    if (!handler) return;
    const electronApi = getElectronFilesApi();
    if (!electronApi) {
      console.warn("[PowerPointViewer] Save-as requires Electron");
      return;
    }
    const ext =
      format === "ppsx" ? "ppsx" : format === "pptm" ? "pptm" : "pptx";
    const filterName =
      format === "ppsx"
        ? "PowerPoint Slide Show"
        : format === "pptm"
          ? "PowerPoint Macro-Enabled"
          : "PowerPoint Presentation";
    const baseName = filePath
      ? (filePath
          .replace(/\\/g, "/")
          .split("/")
          .pop()
          ?.replace(/\.[^.]+$/, "") ?? "presentation")
      : "presentation";
    const destPath = await electronApi.saveFileDialog({
      defaultPath: `${baseName}.${ext}`,
      filters: [{ name: filterName, extensions: [ext] }],
      title: `Save as .${ext}`,
    });
    if (!destPath) return;
    try {
      const slidesWithGuides = slides.map((slide, idx) => {
        if (idx !== activeSlideIndexForGuides) return slide;
        const pptxGuides = guides.map((g) => ({
          id: g.id,
          orientation: (g.axis === "h" ? "horz" : "vert") as "horz" | "vert",
          positionEmu: guidePxToEmu(g.position),
        }));
        return {
          ...slide,
          guides: pptxGuides.length > 0 ? pptxGuides : undefined,
        };
      });
      const saveOptions = {
        headerFooter,
        presentationProperties,
        customShows: customShows.length > 0 ? customShows : undefined,
        sections: sections.length > 0 ? sections : undefined,
        coreProperties: coreProperties ?? undefined,
        appProperties: appProperties ?? undefined,
        customProperties:
          customProperties.length > 0 ? customProperties : undefined,
        notesMaster,
        handoutMaster,
        outputFormat: format,
      };
      const data = await handler.save(
        slidesWithGuides,
        saveOptions as Parameters<typeof handler.save>[1],
      );
      await electronApi.writeBinaryFile(destPath, data);
    } catch (err) {
      console.error(`[PowerPointViewer] Save as .${ext} failed:`, err);
    }
  };

  const handleSaveAsPpsx = () => {
    void handleSaveAsFormat("ppsx");
  };
  const handleSaveAsPptm = () => {
    void handleSaveAsFormat("pptm");
  };

  return {
    handlePackageForSharing,
    handleSaveAsFormat,
    handleSaveAsPpsx,
    handleSaveAsPptm,
  };
}
