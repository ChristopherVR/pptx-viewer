/**
 * useExportHandlers — Export to PNG, PDF, Video, GIF, "Package for Sharing",
 * "Copy slide as image", and "Save As" format handlers.
 *
 * Types live in ./export-handler-types.ts;
 * Save-as / packaging logic lives in ./useExportSaveAs.ts.
 */
import { useState, useRef, useCallback } from "react";
import {
  exportSlideAsPng,
  exportAllSlidesAsPdf,
  copySlideToClipboard,
  exportAllSlidesAsVideo,
  exportAllSlidesAsGif,
} from "../utils/export";
import { saveBlobViaElectronOrDownload } from "./export-handler-types";
import type {
  UseExportHandlersInput,
  ExportHandlersResult,
} from "./export-handler-types";
import { useExportSaveAs } from "./useExportSaveAs";

export type {
  UseExportHandlersInput,
  ExportHandlersResult,
} from "./export-handler-types";
export type { ExportModalControls } from "./export-handler-types";
export { saveBlobViaElectronOrDownload } from "./export-handler-types";

export function useExportHandlers(
  input: UseExportHandlersInput,
): ExportHandlersResult {
  const {
    slides,
    activeSlide,
    activeSlideIndex,
    filePath,
    canvasStageRef,
    setActiveSlideIndex,
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
  } = input;

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportModalTitle, setExportModalTitle] = useState("");
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusMessage, setExportStatusMessage] = useState("");
  const exportAbortRef = useRef<AbortController | null>(null);

  const modalControls = {
    setExportModalOpen,
    setExportModalTitle,
    setExportProgress,
    setExportStatusMessage,
    exportAbortRef,
  };

  const {
    handlePackageForSharing,
    handleSaveAsFormat,
    handleSaveAsPpsx,
    handleSaveAsPptm,
  } = useExportSaveAs({
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
  });

  const handleExportPng = async () => {
    const stageEl = canvasStageRef.current;
    if (!stageEl) return;
    try {
      await exportSlideAsPng(stageEl, activeSlideIndex, {
        backgroundColor: activeSlide?.backgroundColor,
      });
    } catch (err) {
      console.error("[PowerPointViewer] PNG export failed:", err);
    }
  };

  const handleExportPdf = async () => {
    if (!canvasStageRef.current) return;
    try {
      await exportAllSlidesAsPdf(
        canvasStageRef,
        slides.length,
        setActiveSlideIndex,
        activeSlideIndex,
        "presentation.pdf",
        { scale: 2 },
      );
    } catch (err) {
      console.error("[PowerPointViewer] PDF export failed:", err);
    }
  };

  const handleCopySlideAsImage = async () => {
    const stageEl = canvasStageRef.current;
    if (!stageEl) return;
    try {
      await copySlideToClipboard(stageEl, {
        backgroundColor: activeSlide?.backgroundColor,
      });
    } catch (err) {
      console.error("[PowerPointViewer] Copy slide as image failed:", err);
    }
  };

  const handleExportVideo = async () => {
    if (!canvasStageRef.current) return;
    const abortCtrl = new AbortController();
    exportAbortRef.current = abortCtrl;
    setExportModalTitle("Export as Video");
    setExportStatusMessage("Capturing slides...");
    setExportProgress(0);
    setExportModalOpen(true);
    try {
      const blob = await exportAllSlidesAsVideo(
        canvasStageRef,
        slides.length,
        setActiveSlideIndex,
        activeSlideIndex,
        {
          scale: 1,
          slideDurationMs: 3000,
          onProgress: (current, total) => {
            setExportProgress(Math.round((current / total) * 90));
            setExportStatusMessage(
              `Rendering slide ${current + 1} of ${total}...`,
            );
          },
          signal: abortCtrl.signal,
        },
      );
      setExportProgress(95);
      setExportStatusMessage("Saving file...");
      await saveBlobViaElectronOrDownload(
        blob,
        "presentation.webm",
        "WebM Video",
        "webm",
      );
      setExportProgress(100);
    } catch (err) {
      if ((err as DOMException).name !== "AbortError")
        console.error("[PowerPointViewer] Video export failed:", err);
    } finally {
      exportAbortRef.current = null;
      setExportModalOpen(false);
    }
  };

  const handleExportGif = async () => {
    if (!canvasStageRef.current) return;
    const abortCtrl = new AbortController();
    exportAbortRef.current = abortCtrl;
    setExportModalTitle("Export as GIF");
    setExportStatusMessage("Capturing slides...");
    setExportProgress(0);
    setExportModalOpen(true);
    try {
      const blob = await exportAllSlidesAsGif(
        canvasStageRef,
        slides.length,
        setActiveSlideIndex,
        activeSlideIndex,
        {
          scale: 0.5,
          slideDurationMs: 2000,
          onProgress: (current, total) => {
            setExportProgress(Math.round((current / total) * 90));
            setExportStatusMessage(
              `Encoding slide ${current + 1} of ${total}...`,
            );
          },
          signal: abortCtrl.signal,
        },
      );
      setExportProgress(95);
      setExportStatusMessage("Saving file...");
      await saveBlobViaElectronOrDownload(
        blob,
        "presentation.gif",
        "GIF Image",
        "gif",
      );
      setExportProgress(100);
    } catch (err) {
      if ((err as DOMException).name !== "AbortError")
        console.error("[PowerPointViewer] GIF export failed:", err);
    } finally {
      exportAbortRef.current = null;
      setExportModalOpen(false);
    }
  };

  const handleCancelExport = useCallback(() => {
    exportAbortRef.current?.abort();
    exportAbortRef.current = null;
    setExportModalOpen(false);
    setExportProgress(0);
  }, []);

  return {
    handleExportPng,
    handleExportPdf,
    handleCopySlideAsImage,
    handleExportVideo,
    handleExportGif,
    handlePackageForSharing,
    handleSaveAsFormat,
    handleSaveAsPpsx,
    handleSaveAsPptm,
    handleCancelExport,
    exportModalOpen,
    exportModalTitle,
    exportProgress,
    exportStatusMessage,
  };
}
