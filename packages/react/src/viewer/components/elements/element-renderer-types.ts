import type {
  PptxAction,
  PptxElement,
  PptxSlide,
} from "pptx-viewer-core";
import type {
  ShapeAdjustmentHandleDescriptor,
  TableCellEditorState,
} from "../../types";
import type { ElementFindHighlights } from "../../utils/text-render";
import type { FieldSubstitutionContext } from "../../utils/text-field-substitution";
import type { ElementAnimationState } from "../../utils/animation-timeline";

export interface ConnectorRendererProps {
  el: PptxElement;
  isSelected: boolean;
  canInteract: boolean;
  showResizeHandles: boolean;
  showHoverBorder: boolean;
  selectionColorClass: "blue-400" | "blue-500";
  opacity?: number;
  zIndex?: number;
  adjustmentHandleDescriptor: ShapeAdjustmentHandleDescriptor | null;
  onResizePointerDown: (
    elementId: string,
    e: React.MouseEvent,
    handle: string,
  ) => void;
  onAdjustmentPointerDown: (elementId: string, e: React.MouseEvent) => void;
  animationState?: ElementAnimationState;
}

export interface ElementRendererProps {
  element: PptxElement;
  activeSlide?: PptxSlide | undefined;
  isSelected: boolean;
  isInlineEditing: boolean;
  inlineEditingText: string;
  canInteract: boolean;
  spellCheckEnabled: boolean;
  mediaDataUrls: Map<string, string>;
  tableEditorState?: TableCellEditorState | null;
  selectionColorClass: "blue-400" | "blue-500";
  showHoverBorder: boolean;
  opacity?: number;
  /** Explicit z-index for document-order stacking (painter's algorithm). */
  zIndex?: number;
  imageAltText: string;
  showResizeHandles: boolean;
  renderInk: boolean;
  renderGroups: boolean;
  adjustmentHandleDescriptor: ShapeAdjustmentHandleDescriptor | null;
  onResizePointerDown: (
    elementId: string,
    e: React.MouseEvent,
    handle: string,
  ) => void;
  onAdjustmentPointerDown: (elementId: string, e: React.MouseEvent) => void;
  onInlineEditChange: (text: string) => void;
  onInlineEditCommit: () => void;
  onInlineEditCancel: () => void;
  onTableCellSelect?: (
    cell: TableCellEditorState | null,
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
  /** Per-segment highlight ranges produced by Find & Replace. */
  findHighlights?: ElementFindHighlights;
  /** Called when the user clicks an element that has an actionClick (hyperlink / slide jump). */
  onActionClick?: (elementId: string, action: PptxAction) => void;
  /** Called when a text-level hyperlink is clicked (e.g. in presentation mode). */
  onHyperlinkClick?: (url: string) => void;
  /** Presentation-mode animation visibility + CSS animation state. */
  animationState?: ElementAnimationState;
  /** Full animation states map for sub-element text-build animations. */
  presentationElementStates?: ReadonlyMap<string, ElementAnimationState>;
  /** All slides in the presentation (for zoom element thumbnails). */
  allSlides?: readonly PptxSlide[];
  /** Callback fired when a zoom element is clicked in presentation mode. */
  onZoomClick?: (targetSlideIndex: number, returnSlideIndex: number) => void;
  /** Index of the slide that contains this element (for zoom return navigation). */
  sourceSlideIndex?: number;
  /** Context for text field placeholder substitution (slide number, header/footer, etc.). */
  fieldContext?: FieldSubstitutionContext;
}
