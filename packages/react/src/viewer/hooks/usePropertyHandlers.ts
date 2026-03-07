/**
 * usePropertyHandlers — Handlers for notes, slide props, presentation
 * properties (core / app / custom), version history, and compare.
 */
import { useState, useCallback, useMemo } from "react";
import type {
  PptxSlide,
  PptxPresentationProperties,
  PptxCoreProperties,
  PptxAppProperties,
  PptxCustomProperty,
  TextSegment,
} from "pptx-viewer-core";
import { hasTextProperties, PptxHandler } from "pptx-viewer-core";
import { comparePresentation } from "../utils/compare";
import type { CompareResult } from "../utils/compare";
import type { CanvasSize } from "../types";
import type { ElementOperations } from "./useElementOperations";
import type { EditorHistoryResult } from "./useEditorHistory";

export interface UsePropertyHandlersInput {
  slides: PptxSlide[];
  activeSlideIndex: number;
  canvasSize: CanvasSize;
  setContent: React.Dispatch<
    React.SetStateAction<ArrayBuffer | Uint8Array | null>
  >;
  setPresentationProperties: React.Dispatch<
    React.SetStateAction<PptxPresentationProperties>
  >;
  setCoreProperties: React.Dispatch<
    React.SetStateAction<PptxCoreProperties | null>
  >;
  setAppProperties: React.Dispatch<
    React.SetStateAction<PptxAppProperties | null>
  >;
  setCustomProperties: React.Dispatch<
    React.SetStateAction<PptxCustomProperty[]>
  >;
  setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  ops: ElementOperations;
  history: EditorHistoryResult;
}

export interface PropertyHandlersResult {
  handleUpdateNotes: (text: string, segments?: TextSegment[]) => void;
  handleUpdateSlide: (updates: Partial<PptxSlide>) => void;
  handleUpdatePresentationProperties: (
    updates: Partial<PptxPresentationProperties>,
  ) => void;
  handleUpdateCoreProperties: (updates: Partial<PptxCoreProperties>) => void;
  handleUpdateAppProperties: (updates: Partial<PptxAppProperties>) => void;
  handleUpdateCustomProperties: (next: PptxCustomProperty[]) => void;
  handleRestoreVersion: (versionData: Uint8Array) => void;
  handleCompare: () => Promise<void>;
  handleAcceptSlide: (di: number) => void;
  handleRejectSlide: (di: number) => void;
  handleAcceptAllSlides: () => void;
  isVersionHistoryOpen: boolean;
  setIsVersionHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isComparePanelOpen: boolean;
  setIsComparePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  compareResult: CompareResult | null;
  usedFontFamilies: string[];
}

export function usePropertyHandlers(
  input: UsePropertyHandlersInput,
): PropertyHandlersResult {
  const {
    slides,
    activeSlideIndex,
    canvasSize,
    setContent,
    setPresentationProperties,
    setCoreProperties,
    setAppProperties,
    setCustomProperties,
    setSlides,
    setIsDirty,
    ops,
    history,
  } = input;

  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isComparePanelOpen, setIsComparePanelOpen] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(
    null,
  );

  const handleUpdateNotes = (text: string, segments?: TextSegment[]) => {
    ops.updateSlides((prev) =>
      prev.map((s, i) =>
        i === activeSlideIndex
          ? {
              ...s,
              notes: text,
              notesSegments:
                segments && segments.length > 0 ? segments : s.notesSegments,
            }
          : s,
      ),
    );
    history.markDirty();
  };

  const handleUpdateSlide = (updates: Partial<PptxSlide>) => {
    ops.updateSlides((prev) =>
      prev.map((s, i) => (i === activeSlideIndex ? { ...s, ...updates } : s)),
    );
    history.markDirty();
  };

  const handleUpdatePresentationProperties = (
    updates: Partial<PptxPresentationProperties>,
  ) => {
    setPresentationProperties((prev) => ({ ...prev, ...updates }));
    history.markDirty();
  };

  const handleUpdateCoreProperties = (updates: Partial<PptxCoreProperties>) => {
    setCoreProperties((prev) => ({ ...(prev ?? {}), ...updates }));
    history.markDirty();
  };

  const handleUpdateAppProperties = (updates: Partial<PptxAppProperties>) => {
    setAppProperties((prev) => ({ ...(prev ?? {}), ...updates }));
    history.markDirty();
  };

  const handleUpdateCustomProperties = (next: PptxCustomProperty[]) => {
    setCustomProperties(next);
    history.markDirty();
  };

  const handleRestoreVersion = useCallback(
    (versionData: Uint8Array) => {
      setContent(versionData);
    },
    [setContent],
  );

  const handleCompare = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pptx";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const ab = await file.arrayBuffer();
        const h = new PptxHandler();
        const other = await h.load(ab);
        if (!other) return;
        const cur = {
          slides,
          width: canvasSize.width,
          height: canvasSize.height,
        };
        setCompareResult(comparePresentation(cur, other));
        setIsComparePanelOpen(true);
      } catch (err) {
        console.warn("Compare failed:", err);
      }
    };
    input.click();
  }, [slides, canvasSize.width, canvasSize.height]);

  const handleAcceptSlide = useCallback(
    (di: number) => {
      if (!compareResult) return;
      const diff = compareResult.diffs[di];
      if (!diff || diff.status === "unchanged") return;
      setSlides((prev) => {
        const n = [...prev];
        if (diff.status === "added" && diff.compareSlide)
          n.splice(Math.min(diff.compareIndex, n.length), 0, {
            ...diff.compareSlide,
          });
        else if (
          diff.status === "changed" &&
          diff.compareSlide &&
          diff.baseIndex >= 0
        )
          n[diff.baseIndex] = { ...diff.compareSlide };
        else if (diff.status === "removed" && diff.baseIndex >= 0)
          n.splice(diff.baseIndex, 1);
        return n;
      });
      setIsDirty(true);
    },
    [compareResult, setSlides, setIsDirty],
  );

  const handleRejectSlide = useCallback((_di: number) => {
    /* keep current */
  }, []);

  const handleAcceptAllSlides = useCallback(() => {
    if (!compareResult) return;
    setSlides((prev) => {
      const n = [...prev];
      const dd = [...compareResult.diffs];
      for (let i = dd.length - 1; i >= 0; i--) {
        const x = dd[i];
        if (
          x.status === "removed" &&
          x.baseIndex >= 0 &&
          x.baseIndex < n.length
        )
          n.splice(x.baseIndex, 1);
      }
      for (const x of dd) {
        if (
          x.status === "changed" &&
          x.compareSlide &&
          x.baseIndex >= 0 &&
          x.baseIndex < n.length
        )
          n[x.baseIndex] = { ...x.compareSlide };
      }
      for (const x of dd) {
        if (x.status === "added" && x.compareSlide)
          n.splice(Math.min(x.compareIndex, n.length), 0, {
            ...x.compareSlide,
          });
      }
      return n;
    });
    setIsDirty(true);
  }, [compareResult, setSlides, setIsDirty]);

  const usedFontFamilies = useMemo(() => {
    const fonts = new Set<string>();
    for (const slide of slides) {
      for (const el of slide.elements ?? []) {
        if (hasTextProperties(el)) {
          if (el.textStyle?.fontFamily) fonts.add(el.textStyle.fontFamily);
          if (el.textSegments) {
            for (const seg of el.textSegments) {
              if (seg.style?.fontFamily) fonts.add(seg.style.fontFamily);
            }
          }
        }
      }
    }
    return Array.from(fonts).sort();
  }, [slides]);

  return {
    handleUpdateNotes,
    handleUpdateSlide,
    handleUpdatePresentationProperties,
    handleUpdateCoreProperties,
    handleUpdateAppProperties,
    handleUpdateCustomProperties,
    handleRestoreVersion,
    handleCompare,
    handleAcceptSlide,
    handleRejectSlide,
    handleAcceptAllSlides,
    isVersionHistoryOpen,
    setIsVersionHistoryOpen,
    isComparePanelOpen,
    setIsComparePanelOpen,
    compareResult,
    usedFontFamilies,
  };
}
