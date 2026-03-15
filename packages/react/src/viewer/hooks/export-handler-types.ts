/**
 * Types and utility helpers for export handlers.
 */
import type {
  RefObject,
  MutableRefObject,
  Dispatch,
  SetStateAction,
} from "react";
import type {
  PptxSlide,
  PptxSaveFormat,
  PptxHandler,
} from "pptx-viewer-core";
import { getElectronFilesApi } from "../utils/electron-files";

export interface UseExportHandlersInput {
  slides: PptxSlide[];
  activeSlide: PptxSlide | undefined;
  activeSlideIndex: number;
  filePath: string | undefined;
  canvasStageRef: RefObject<HTMLDivElement | null>;
  setActiveSlideIndex: Dispatch<SetStateAction<number>>;
  handlerRef: RefObject<PptxHandler | null>;
  serializeSlides: () => Promise<Uint8Array | null>;
  /** State from the viewer needed for save-as */
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
}

export interface ExportHandlersResult {
  handleExportPng: () => Promise<void>;
  handleExportPdf: () => Promise<void>;
  handleExportNotesPdf: () => Promise<void>;
  handleCopySlideAsImage: () => Promise<void>;
  handleExportVideo: () => Promise<void>;
  handleExportGif: () => Promise<void>;
  handlePackageForSharing: () => Promise<void>;
  handleSaveAsFormat: (format: PptxSaveFormat) => Promise<void>;
  handleSaveAsPpsx: () => void;
  handleSaveAsPptm: () => void;
  handleCancelExport: () => void;
  exportModalOpen: boolean;
  exportModalTitle: string;
  exportProgress: number;
  exportStatusMessage: string;
}

/** Controls for the shared export-progress modal, passed to sub-hooks. */
export interface ExportModalControls {
  setExportModalOpen: (open: boolean) => void;
  setExportModalTitle: (title: string) => void;
  setExportProgress: (progress: number) => void;
  setExportStatusMessage: (message: string) => void;
  exportAbortRef: MutableRefObject<AbortController | null>;
}

/**
 * Save a Blob via Electron file dialog or browser download fallback.
 */
export async function saveBlobViaElectronOrDownload(
  blob: Blob,
  defaultName: string,
  filterName: string,
  ext: string,
): Promise<void> {
  const electronApi = getElectronFilesApi();
  if (electronApi) {
    const savePath = await electronApi.saveFileDialog({
      defaultPath: defaultName,
      filters: [{ name: filterName, extensions: [ext] }],
      title: `Save ${filterName}`,
    });
    if (savePath) {
      const buffer = new Uint8Array(await blob.arrayBuffer());
      await electronApi.writeBinaryFile(savePath, buffer);
    }
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }
}
