/**
 * useViewerUIState — UI panel and miscellaneous state for PowerPointViewer.
 *
 * Separated from core state to keep each hook focused and under 300 lines.
 */
import { useState } from "react";

import type {
  AccessibilityIssue,
  DrawingTool,
  ElementContextMenuState,
  MarqueeSelectionState,
  TableCellEditorState,
  ToolbarSection,
} from "../types";

/* ------------------------------------------------------------------ */
/*  Output type                                                       */
/* ------------------------------------------------------------------ */

export interface ViewerUIState {
  isCompactToolbarOpen: boolean;
  setIsCompactToolbarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toolbarSection: ToolbarSection;
  setToolbarSection: React.Dispatch<React.SetStateAction<ToolbarSection>>;
  isSlidesPaneOpen: boolean;
  setIsSlidesPaneOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isInspectorPaneOpen: boolean;
  setIsInspectorPaneOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSlideNotesCollapsed: boolean;
  setIsSlideNotesCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isOverflowMenuOpen: boolean;
  setIsOverflowMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarPanelMode: string;
  setSidebarPanelMode: React.Dispatch<React.SetStateAction<string>>;
  showSlideSorter: boolean;
  setShowSlideSorter: React.Dispatch<React.SetStateAction<boolean>>;
  isShortcutHelpOpen: boolean;
  setIsShortcutHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAccessibilityPanelOpen: boolean;
  setIsAccessibilityPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  accessibilityIssues: AccessibilityIssue[];
  setAccessibilityIssues: React.Dispatch<
    React.SetStateAction<AccessibilityIssue[]>
  >;
  contextMenuState: ElementContextMenuState | null;
  setContextMenuState: React.Dispatch<
    React.SetStateAction<ElementContextMenuState | null>
  >;
  tableEditorState: TableCellEditorState | null;
  setTableEditorState: React.Dispatch<
    React.SetStateAction<TableCellEditorState | null>
  >;
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
  guides: Array<{ id: string; axis: "h" | "v"; position: number }>;
  setGuides: React.Dispatch<
    React.SetStateAction<
      Array<{ id: string; axis: "h" | "v"; position: number }>
    >
  >;
  marqueeSelectionState: MarqueeSelectionState | null;
  setMarqueeSelectionState: React.Dispatch<
    React.SetStateAction<MarqueeSelectionState | null>
  >;
  snapLines: Array<{ axis: string; position: number }>;
  setSnapLines: React.Dispatch<
    React.SetStateAction<Array<{ axis: string; position: number }>>
  >;
  mediaDataUrls: Map<string, string>;
  setMediaDataUrls: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  activeTool: DrawingTool;
  setActiveTool: React.Dispatch<React.SetStateAction<DrawingTool>>;
  drawingColor: string;
  setDrawingColor: React.Dispatch<React.SetStateAction<string>>;
  drawingWidth: number;
  setDrawingWidth: React.Dispatch<React.SetStateAction<number>>;
  isThemeEditorOpen: boolean;
  setIsThemeEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isThemeGalleryOpen: boolean;
  setIsThemeGalleryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  formatPainterActive: boolean;
  setFormatPainterActive: React.Dispatch<React.SetStateAction<boolean>>;
  isSelectionPaneOpen: boolean;
  setIsSelectionPaneOpen: React.Dispatch<React.SetStateAction<boolean>>;
  eyedropperActive: boolean;
  setEyedropperActive: React.Dispatch<React.SetStateAction<boolean>>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useViewerUIState(): ViewerUIState {
  // ── UI Panel State ────────────────────────────────────────────────
  const [isCompactToolbarOpen, setIsCompactToolbarOpen] = useState(false);
  const [toolbarSection, setToolbarSection] = useState<ToolbarSection>("home");
  const [isSlidesPaneOpen, setIsSlidesPaneOpen] = useState(true);
  const [isInspectorPaneOpen, setIsInspectorPaneOpen] = useState(true);
  const [isSlideNotesCollapsed, setIsSlideNotesCollapsed] = useState(true);
  const [isOverflowMenuOpen, setIsOverflowMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarPanelMode, setSidebarPanelMode] =
    useState<string>("properties");
  const [showSlideSorter, setShowSlideSorter] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [isAccessibilityPanelOpen, setIsAccessibilityPanelOpen] =
    useState(false);
  const [accessibilityIssues, setAccessibilityIssues] = useState<
    AccessibilityIssue[]
  >([]);

  // ── Misc State ────────────────────────────────────────────────────
  const [contextMenuState, setContextMenuState] =
    useState<ElementContextMenuState | null>(null);
  const [tableEditorState, setTableEditorState] =
    useState<TableCellEditorState | null>(null);
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToShape, setSnapToShape] = useState(true);
  const [guides, setGuides] = useState<
    Array<{ id: string; axis: "h" | "v"; position: number }>
  >([]);
  const [marqueeSelectionState, setMarqueeSelectionState] =
    useState<MarqueeSelectionState | null>(null);
  const [snapLines, setSnapLines] = useState<
    Array<{ axis: string; position: number }>
  >([]);
  const [mediaDataUrls, setMediaDataUrls] = useState<Map<string, string>>(
    new Map(),
  );
  const [activeTool, setActiveTool] = useState<DrawingTool>("select");
  const [drawingColor, setDrawingColor] = useState("#000000");
  const [drawingWidth, setDrawingWidth] = useState(3);
  const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);
  const [isThemeGalleryOpen, setIsThemeGalleryOpen] = useState(false);
  const [formatPainterActive, setFormatPainterActive] = useState(false);
  const [isSelectionPaneOpen, setIsSelectionPaneOpen] = useState(false);
  const [eyedropperActive, setEyedropperActive] = useState(false);

  return {
    isCompactToolbarOpen,
    setIsCompactToolbarOpen,
    toolbarSection,
    setToolbarSection,
    isSlidesPaneOpen,
    setIsSlidesPaneOpen,
    isInspectorPaneOpen,
    setIsInspectorPaneOpen,
    isSlideNotesCollapsed,
    setIsSlideNotesCollapsed,
    isOverflowMenuOpen,
    setIsOverflowMenuOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    sidebarPanelMode,
    setSidebarPanelMode,
    showSlideSorter,
    setShowSlideSorter,
    isShortcutHelpOpen,
    setIsShortcutHelpOpen,
    isAccessibilityPanelOpen,
    setIsAccessibilityPanelOpen,
    accessibilityIssues,
    setAccessibilityIssues,
    contextMenuState,
    setContextMenuState,
    tableEditorState,
    setTableEditorState,
    spellCheckEnabled,
    setSpellCheckEnabled,
    showGrid,
    setShowGrid,
    showRulers,
    setShowRulers,
    snapToGrid,
    setSnapToGrid,
    snapToShape,
    setSnapToShape,
    guides,
    setGuides,
    marqueeSelectionState,
    setMarqueeSelectionState,
    snapLines,
    setSnapLines,
    mediaDataUrls,
    setMediaDataUrls,
    activeTool,
    setActiveTool,
    drawingColor,
    setDrawingColor,
    drawingWidth,
    setDrawingWidth,
    isThemeEditorOpen,
    setIsThemeEditorOpen,
    isThemeGalleryOpen,
    setIsThemeGalleryOpen,
    formatPainterActive,
    setFormatPainterActive,
    isSelectionPaneOpen,
    setIsSelectionPaneOpen,
    eyedropperActive,
    setEyedropperActive,
  };
}
