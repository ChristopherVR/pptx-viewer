/**
 * useViewerDialogs — Dialog open/close state, mode switching with annotation
 * check, master view, custom shows, guide, slide-show settings, password,
 * accessibility check, font embedding, and misc UI flags.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import type { PptxPresentationProperties } from "../../core";

import type {
  UseViewerDialogsInput,
  ViewerDialogsResult,
} from "./viewer-dialog-types";
import { useDialogCustomShows } from "./useDialogCustomShows";

export type {
  UseViewerDialogsInput,
  ViewerDialogsResult,
} from "./viewer-dialog-types";

export function useViewerDialogs(
  input: UseViewerDialogsInput,
): ViewerDialogsResult {
  const {
    mode,
    slides,
    activeSlide,
    canvasSize,
    containerRef,
    customShows,
    activeCustomShowId,
    setCustomShows,
    setActiveCustomShowId,
    setGuides,
    setPresentationProperties,
    setAccessibilityIssues,
    setIsAccessibilityPanelOpen,
    setMode,
    setPreMasterMode,
    setActiveMasterIndex,
    setActiveLayoutIndex,
    setSelectedElementId,
    setSelectedElementIds,
    preMasterMode,
    hasDigitalSignatures,
    isDirty,
    history,
  } = input;

  // ── Dialog states ─────────────────────────────────────────────────
  const [isSmartArtDialogOpen, setIsSmartArtDialogOpen] = useState(false);
  const [isEquationDialogOpen, setIsEquationDialogOpen] = useState(false);
  const [isHyperlinkDialogOpen, setIsHyperlinkDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDocPropsDialogOpen, setIsDocPropsDialogOpen] = useState(false);
  const [isFontEmbeddingOpen, setIsFontEmbeddingOpen] = useState(false);
  const [isDigitalSigDialogOpen, setIsDigitalSigDialogOpen] = useState(false);
  const [isSignatureStrippedDialogOpen, setIsSignatureStrippedDialogOpen] =
    useState(false);
  const signatureStripAcknowledgedRef = useRef(false);
  const [isSetUpSlideShowOpen, setIsSetUpSlideShowOpen] = useState(false);
  const [isBroadcastDialogOpen, setIsBroadcastDialogOpen] = useState(false);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [editingEquationOmml, setEditingEquationOmml] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [embedFontsEnabled, setEmbedFontsEnabled] = useState(false);

  // ── Narrow viewport ───────────────────────────────────────────────
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setIsNarrowViewport(entry.contentRect.width < 768);
    });
    observer.observe(el);
    setIsNarrowViewport(el.clientWidth < 768);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Signature strip warning ───────────────────────────────────────
  useEffect(() => {
    if (
      isDirty &&
      hasDigitalSignatures &&
      !signatureStripAcknowledgedRef.current
    ) {
      setIsSignatureStrippedDialogOpen(true);
    }
  }, [isDirty, hasDigitalSignatures]);

  // ── Master view ───────────────────────────────────────────────────
  const handleEnterMasterView = useCallback(() => {
    setPreMasterMode(mode === "master" ? "edit" : mode);
    setMode("master");
    setActiveMasterIndex(0);
    setActiveLayoutIndex(null);
    setSelectedElementId(null);
    setSelectedElementIds([]);
  }, [
    mode,
    setPreMasterMode,
    setMode,
    setActiveMasterIndex,
    setActiveLayoutIndex,
    setSelectedElementId,
    setSelectedElementIds,
  ]);

  const handleCloseMasterView = useCallback(() => {
    setMode(preMasterMode);
    setSelectedElementId(null);
    setSelectedElementIds([]);
  }, [preMasterMode, setMode, setSelectedElementId, setSelectedElementIds]);

  const handleSelectMaster = useCallback(
    (index: number) => {
      setActiveMasterIndex(index);
      setActiveLayoutIndex(null);
      setSelectedElementId(null);
      setSelectedElementIds([]);
    },
    [
      setActiveMasterIndex,
      setActiveLayoutIndex,
      setSelectedElementId,
      setSelectedElementIds,
    ],
  );

  const handleSelectLayout = useCallback(
    (masterIndex: number, layoutIndex: number) => {
      setActiveMasterIndex(masterIndex);
      setActiveLayoutIndex(layoutIndex);
      setSelectedElementId(null);
      setSelectedElementIds([]);
    },
    [
      setActiveMasterIndex,
      setActiveLayoutIndex,
      setSelectedElementId,
      setSelectedElementIds,
    ],
  );

  // ── Guides ────────────────────────────────────────────────────────
  const handleAddGuide = (axis: "h" | "v") => {
    const position =
      axis === "h" ? canvasSize.height / 2 : canvasSize.width / 2;
    setGuides((prev) => [
      ...prev,
      {
        id: `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        axis,
        position,
      },
    ]);
  };

  // ── Custom shows (extracted sub-hook) ──────────────────────────────
  const customShowHandlers = useDialogCustomShows({
    activeSlide,
    customShows,
    activeCustomShowId,
    setCustomShows,
    setActiveCustomShowId,
    history,
  });

  // ── Slide show settings ───────────────────────────────────────────
  const handleSaveSlideShowSettings = useCallback(
    (props: PptxPresentationProperties) => {
      setPresentationProperties(props);
      history.markDirty();
    },
    [setPresentationProperties, history],
  );

  const handleToggleSubtitles = useCallback(() => {
    setPresentationProperties((prev) => ({
      ...prev,
      showSubtitles: !prev.showSubtitles,
    }));
    history.markDirty();
  }, [setPresentationProperties, history]);

  // ── Password ──────────────────────────────────────────────────────
  const handleSetPassword = useCallback((_password: string) => {
    setIsPasswordProtected(true);
  }, []);
  const handleRemovePassword = useCallback(() => {
    setIsPasswordProtected(false);
  }, []);

  // ── Accessibility ─────────────────────────────────────────────────
  const handleRunAccessibilityCheck = () => {
    const issues: Array<{
      slideIndex: number;
      elementId: string;
      severity: "error" | "warning" | "info";
      message: string;
    }> = [];
    slides.forEach((slide, si) => {
      for (const el of slide.elements) {
        if (
          (el.type === "image" || el.type === "picture") &&
          !("altText" in el && el.altText)
        ) {
          issues.push({
            slideIndex: si,
            elementId: el.id,
            severity: "warning",
            message: "Image missing alt text",
          });
        }
      }
    });
    if (issues.length > 0)
      console.info(`[Accessibility] Found ${issues.length} issue(s):`, issues);
    setAccessibilityIssues(issues);
    setIsAccessibilityPanelOpen(true);
  };

  return {
    isSmartArtDialogOpen,
    setIsSmartArtDialogOpen,
    isEquationDialogOpen,
    setIsEquationDialogOpen,
    isHyperlinkDialogOpen,
    setIsHyperlinkDialogOpen,
    isPasswordDialogOpen,
    setIsPasswordDialogOpen,
    isDocPropsDialogOpen,
    setIsDocPropsDialogOpen,
    isFontEmbeddingOpen,
    setIsFontEmbeddingOpen,
    isDigitalSigDialogOpen,
    setIsDigitalSigDialogOpen,
    isSignatureStrippedDialogOpen,
    setIsSignatureStrippedDialogOpen,
    isSetUpSlideShowOpen,
    setIsSetUpSlideShowOpen,
    isBroadcastDialogOpen,
    setIsBroadcastDialogOpen,
    isPasswordProtected,
    editingEquationOmml,
    setEditingEquationOmml,
    embedFontsEnabled,
    setEmbedFontsEnabled,
    isNarrowViewport,
    handleEnterMasterView,
    handleCloseMasterView,
    handleSelectMaster,
    handleSelectLayout,
    handleAddGuide,
    ...customShowHandlers,
    handleSaveSlideShowSettings,
    handleToggleSubtitles,
    handleSetPassword,
    handleRemovePassword,
    handleRunAccessibilityCheck,
  };
}
