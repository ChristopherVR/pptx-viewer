/**
 * useInsertElements — Handlers for inserting new elements (text, shape,
 * table, SmartArt, equation, field, action button, ink, freeform)
 * and image/media file picking.
 */
import type {
  PptxElement,
  PptxSlide,
  TextPptxElement,
  ShapePptxElement,
  InkPptxElement,
  SmartArtLayout,
} from "pptx-viewer-core";
import {
  DEFAULT_TABLE_ROWS,
  DEFAULT_TABLE_COLUMNS,
  DEFAULT_TEXT_FONT_SIZE,
} from "../constants";
import { generateElementId } from "../utils/generate-id";
import type { CanvasSize, SupportedShapeType } from "../types";
import type { HyperlinkEditData } from "../components/HyperlinkEditDialog";
import type { ElementOperations } from "./useElementOperations";
import type { EditorHistoryResult } from "./useEditorHistory";
import { createStructuredElementHandlers } from "./insert-structured-elements";
import { createFileHandlers } from "./insert-file-handlers";

export interface UseInsertElementsInput {
  activeSlide: PptxSlide | undefined;
  activeSlideIndex: number;
  canvasSize: CanvasSize;
  newShapeType: SupportedShapeType;
  selectedElements: PptxElement[];
  ops: ElementOperations;
  history: EditorHistoryResult;
}

export interface InsertElementHandlers {
  handleAddTextBox: () => void;
  handleAddShape: () => void;
  handleAddTable: () => void;
  handleInsertSmartArt: (
    layout: SmartArtLayout,
    defaultItems: string[],
  ) => void;
  handleInsertEquation: (omml: Record<string, unknown>) => void;
  handleHyperlinkConfirm: (data: HyperlinkEditData) => void;
  handleInsertField: (fieldType: string) => void;
  handleAddActionButton: (shapeType: string) => void;
  handleAddInkElement: (ink: InkPptxElement) => void;
  handleAddFreeformShape: (shape: ShapePptxElement) => void;
  handleImageFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMediaFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function useInsertElements(
  input: UseInsertElementsInput,
): InsertElementHandlers {
  const {
    activeSlide,
    activeSlideIndex,
    canvasSize,
    newShapeType,
    selectedElements,
    ops,
    history,
  } = input;

  const addElement = (element: PptxElement) => {
    ops.updateSlides((prev) =>
      prev.map((s, i) =>
        i === activeSlideIndex
          ? { ...s, elements: [...s.elements, element] }
          : s,
      ),
    );
    ops.applySelection(element.id);
    history.markDirty();
  };

  const handleAddTextBox = () => {
    if (!activeSlide) return;
    addElement({
      id: generateElementId(),
      type: "text",
      x: 100,
      y: 100,
      width: 300,
      height: 60,
      text: "",
      textStyle: { fontSize: DEFAULT_TEXT_FONT_SIZE },
    } as TextPptxElement);
  };

  const handleAddShape = () => {
    if (!activeSlide) return;
    addElement({
      id: generateElementId(),
      type: "shape",
      x: 150,
      y: 150,
      width: 200,
      height: 150,
      shapeType: newShapeType,
      shapeStyle: {
        fillColor: "#3b82f6",
        strokeColor: "#1f2937",
        strokeWidth: 2,
      },
    } as ShapePptxElement);
  };

  const handleAddTable = () => {
    if (!activeSlide) return;
    const rows = Array.from({ length: DEFAULT_TABLE_ROWS }, () => ({
      cells: Array.from({ length: DEFAULT_TABLE_COLUMNS }, () => ({
        text: "",
        style: {},
      })),
    }));
    const columnWidths = Array.from(
      { length: DEFAULT_TABLE_COLUMNS },
      () => 1 / DEFAULT_TABLE_COLUMNS,
    );
    addElement({
      id: generateElementId(),
      type: "table" as const,
      x: 100,
      y: 200,
      width: 600,
      height: 250,
      tableData: { rows, columnWidths },
    } as PptxElement);
  };

  const structured = createStructuredElementHandlers({
    activeSlide,
    activeSlideIndex,
    selectedElements,
    ops,
    history,
    addElement,
  });

  const fileHandlers = createFileHandlers({
    activeSlide,
    canvasSize,
    addElement,
  });

  const handleAddInkElement = (ink: InkPptxElement) => {
    if (!activeSlide) return;
    ops.updateSlides((prev) =>
      prev.map((s, i) =>
        i === activeSlideIndex ? { ...s, elements: [...s.elements, ink] } : s,
      ),
    );
    history.markDirty();
  };

  const handleAddFreeformShape = (shape: ShapePptxElement) => {
    if (!activeSlide) return;
    addElement(shape);
  };

  return {
    handleAddTextBox,
    handleAddShape,
    handleAddTable,
    ...structured,
    handleAddInkElement,
    handleAddFreeformShape,
    ...fileHandlers,
  };
}
