import React from "react";
import type {
  ConnectorPptxElement,
  PptxAction,
  PptxComment,
  PptxElement,
  PptxSlide,
  InkPptxElement,
  ShapePptxElement,
} from "pptx-viewer-core";
import type { ElementAnimationState } from "../../utils/animation-timeline";
import type { FieldSubstitutionContext } from "../../utils/text-field-substitution";
import type {
  CanvasSize,
  MarqueeSelectionState,
  TableCellEditorState,
  ViewerMode,
} from "../../types";
import type { DrawingTool } from "../../types-ui";
import type { RulerUnit } from "./Ruler";

/* ------------------------------------------------------------------ */
/*  Hook return helper type (mirrors useZoomViewport result)          */
/* ------------------------------------------------------------------ */

export interface ZoomViewport {
  canvasViewportRef: React.RefObject<HTMLDivElement | null>;
  editWrapperRef: React.RefObject<HTMLDivElement | null>;
  canvasStageRef: React.RefObject<HTMLDivElement | null>;
  editorScale: number;
}

/* ------------------------------------------------------------------ */
/*  Event delegation helper                                           */
/* ------------------------------------------------------------------ */

/** Walk up from event target to find the nearest pptx-element container. */
export function getElementIdFromEvent(e: React.MouseEvent): string | null {
  let target = e.target as HTMLElement | null;
  while (target) {
    if (target.dataset?.pptxElement === "true") {
      return target.dataset.elementId || null;
    }
    target = target.parentElement;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface SlideCanvasProps {
  activeSlide: PptxSlide | undefined;
  templateElements: PptxElement[];
  canvasSize: CanvasSize;
  zoom: ZoomViewport;
  mode: ViewerMode;
  canEdit: boolean;
  editTemplateMode: boolean;
  selectedElementIdSet: Set<string>;
  selectedElement: PptxElement | null;
  inlineEditingElementId: string | null;
  inlineEditingText: string;
  spellCheckEnabled: boolean;
  mediaDataUrls: Map<string, string>;
  tableEditorState: TableCellEditorState | null;
  marqueeSelectionState: MarqueeSelectionState | null;
  snapLines: Array<{ axis: string; position: number }>;
  showGrid: boolean;
  /** Grid spacing in CSS px (derived from PPTX gridSpacing EMUs). */
  gridSpacingPx?: number;
  showRulers: boolean;
  /** Unit system for rulers (default: inches). */
  rulerUnit?: RulerUnit;
  guides: Array<{ id: string; axis: "h" | "v"; position: number }>;
  presentationElementStates?: Map<string, ElementAnimationState>;
  presentationKeyframesCss?: string;
  // Callbacks (element-scoped — SlideCanvas wraps to include element ID)
  onClick: (elementId: string, e: React.MouseEvent) => void;
  onDoubleClick: (elementId: string, e: React.MouseEvent) => void;
  onMouseDown: (elementId: string, e: React.MouseEvent) => void;
  onContextMenu: (elementId: string, e: React.MouseEvent) => void;
  /** Called when the user presses mouse down on empty canvas space. */
  onCanvasMouseDown?: (e: React.MouseEvent) => void;
  onResizePointerDown: (
    elementId: string,
    e: React.MouseEvent,
    handle: string,
  ) => void;
  onAdjustmentPointerDown: (elementId: string, e: React.MouseEvent) => void;
  onInlineEditChange: (text: string) => void;
  onInlineEditCommit: () => void;
  onInlineEditCancel: () => void;
  onTableCellSelect: (
    cell: Omit<TableCellEditorState, "elementId"> | null,
    elementId: string,
  ) => void;
  /** Called when an edited table cell should be committed. */
  onCommitCellEdit?: (
    elementId: string,
    rowIndex: number,
    colIndex: number,
    text: string,
  ) => void;
  /** Called when table column widths are resized. */
  onResizeTableColumns?: (elementId: string, newWidths: number[]) => void;
  /** Called when a table row is resized. */
  onResizeTableRow?: (
    elementId: string,
    rowIndex: number,
    newHeight: number,
  ) => void;
  /** Find & Replace results (all matches across all slides). */
  findResults?: Array<{
    slideIndex: number;
    elementId: string;
    segmentIndex: number;
    startOffset: number;
    length: number;
  }>;
  /** Index of the currently focused find result (-1 for none). */
  findResultIndex?: number;
  /** Index of the currently visible slide (needed to filter find results). */
  activeSlideIndex?: number;

  /* ── Drawing overlay props ─────────────────────────────────────── */
  /** Currently active drawing tool ("select" means no drawing overlay). */
  activeTool?: DrawingTool;
  /** Stroke colour for pen / highlighter. */
  drawingColor?: string;
  /** Stroke width for pen / highlighter. */
  drawingWidth?: number;
  /** Ref that is true while a pointer stroke is in progress. */
  isDrawingRef?: React.RefObject<boolean>;
  /** Called when a completed ink stroke should be added to the slide. */
  onAddInkElement?: (ink: InkPptxElement) => void;
  /** Called when a freeform drawing stroke should be added as a shape element. */
  onAddFreeformShape?: (shape: ShapePptxElement) => void;

  /* ── Action / hyperlink props ───────────────────────────────────── */
  /** Called when a shape-level action is clicked (e.g. slide jump, URL). */
  onActionClick?: (elementId: string, action: PptxAction) => void;
  /** Called when a text-level hyperlink is clicked. */
  onHyperlinkClick?: (url: string) => void;

  /* ── Comment overlay props ─────────────────────────────────────── */
  /** Comments for the current slide (used for on-canvas markers). */
  comments?: PptxComment[];
  /** Whether to show comment markers on the slide canvas. */
  showCommentMarkers?: boolean;
  /** Called when a comment marker is clicked. */
  onCommentMarkerClick?: (commentId: string) => void;
  onMoveGuide?: (guideId: string, position: number) => void;
  onDeleteGuide?: (guideId: string) => void;
  onCreateGuideFromRuler?: (axis: "h" | "v", positionPx: number) => void;

  /* ── Connector creation props ────────────────────────────────────── */
  /** When true, shows connection sites on shapes and enables connector drawing. */
  connectorCreationMode?: boolean;
  /** Called when a new connector is created between two shapes. */
  onCreateConnector?: (connector: ConnectorPptxElement) => void;

  /* ── Zoom element props ───────────────────────────────────────────── */
  /** All slides in the presentation (for zoom element thumbnails). */
  allSlides?: readonly PptxSlide[];
  /** Callback fired when a zoom element is clicked in presentation mode. */
  onZoomClick?: (targetSlideIndex: number, returnSlideIndex: number) => void;
  /** Index of the current slide (for zoom return navigation). */
  sourceSlideIndex?: number;

  /* ── Text field substitution ──────────────────────────────────────── */
  /** Context for text field placeholder substitution (slide number, header/footer, etc.). */
  fieldContext?: FieldSubstitutionContext;

  /* ── Collaboration overlay ────────────────────────────────────────── */
  /** Optional collaboration cursor overlay rendered on top of the canvas. */
  collaborationOverlay?: React.ReactNode;
}
