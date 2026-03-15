/**
 * SlideCanvas — Type definitions for the canvas component props.
 */
import type React from "react";
import type {
  ConnectorPptxElement,
  PptxAction,
  PptxComment,
  PptxElement,
  PptxSlide,
  InkPptxElement,
  ShapePptxElement,
  CustomGeometrySegment,
} from "pptx-viewer-core";
import type { ElementAnimationState } from "../../utils/animation-timeline";
import type {
  CanvasSize,
  MarqueeSelectionState,
  TableCellEditorState,
  ViewerMode,
} from "../../types";
import type { DrawingTool } from "../../types-ui";
import type { ElementFindHighlights } from "../../utils/text-render";
import type { FieldSubstitutionContext } from "../../utils/text-field-substitution";
import type { RulerUnit } from "./Ruler";

export interface ZoomViewport {
  canvasViewportRef: React.RefObject<HTMLDivElement | null>;
  editWrapperRef: React.RefObject<HTMLDivElement | null>;
  canvasStageRef: React.RefObject<HTMLDivElement | null>;
  editorScale: number;
}

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
  gridSpacingPx?: number;
  showRulers: boolean;
  rulerUnit?: RulerUnit;
  guides: Array<{ id: string; axis: "h" | "v"; position: number }>;
  presentationElementStates?: Map<string, ElementAnimationState>;
  presentationKeyframesCss?: string;
  onClick: (elementId: string, e: React.MouseEvent) => void;
  onDoubleClick: (elementId: string, e: React.MouseEvent) => void;
  onMouseDown: (elementId: string, e: React.MouseEvent) => void;
  onContextMenu: (elementId: string, e: React.MouseEvent) => void;
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
  onCommitCellEdit?: (
    elementId: string,
    rowIndex: number,
    colIndex: number,
    text: string,
  ) => void;
  onResizeTableColumns?: (elementId: string, newWidths: number[]) => void;
  onResizeTableRow?: (
    elementId: string,
    rowIndex: number,
    newHeight: number,
  ) => void;
  findResults?: Array<{
    slideIndex: number;
    elementId: string;
    segmentIndex: number;
    startOffset: number;
    length: number;
  }>;
  findResultIndex?: number;
  activeSlideIndex?: number;
  activeTool?: DrawingTool;
  drawingColor?: string;
  drawingWidth?: number;
  isDrawingRef?: React.RefObject<boolean>;
  onAddInkElement?: (ink: InkPptxElement) => void;
  onAddFreeformShape?: (shape: ShapePptxElement) => void;
  onActionClick?: (elementId: string, action: PptxAction) => void;
  onHyperlinkClick?: (url: string) => void;
  comments?: PptxComment[];
  showCommentMarkers?: boolean;
  onCommentMarkerClick?: (commentId: string) => void;
  onMoveGuide?: (guideId: string, position: number) => void;
  onDeleteGuide?: (guideId: string) => void;
  onCreateGuideFromRuler?: (axis: "h" | "v", positionPx: number) => void;
  connectorCreationMode?: boolean;
  onCreateConnector?: (connector: ConnectorPptxElement) => void;
  /** All slides in the presentation (for zoom element thumbnails). */
  allSlides?: readonly PptxSlide[];
  /** Callback fired when a zoom element is clicked in presentation mode. */
  onZoomClick?: (targetSlideIndex: number, returnSlideIndex: number) => void;
  /** Index of the current slide (for zoom return navigation). */
  sourceSlideIndex?: number;
  /** Context for text field placeholder substitution (slide number, header/footer, etc.). */
  fieldContext?: FieldSubstitutionContext;
}

export type {
  CustomGeometrySegment,
  ElementFindHighlights,
  ElementAnimationState,
};
