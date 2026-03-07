/**
 * insert-structured-elements — Factory for SmartArt, equation, hyperlink,
 * field, and action-button insertion handlers used by useInsertElements.
 */
import type {
  PptxElement,
  PptxSlide,
  ShapePptxElement,
  TextStyle,
  SmartArtLayout,
  PptxSmartArtNode,
} from "../../core";
import { elementActionToPptxAction } from "../../core";
import { ACTION_BUTTON_PRESETS } from "../constants";
import { generateElementId } from "../utils/generate-id";
import type { HyperlinkEditData } from "../components/HyperlinkEditDialog";
import { resolveHyperlinkEditResult } from "../components/HyperlinkEditDialog";
import type { ElementOperations } from "./useElementOperations";
import type { EditorHistoryResult } from "./useEditorHistory";

export interface StructuredElementDeps {
  activeSlide: PptxSlide | undefined;
  activeSlideIndex: number;
  selectedElements: PptxElement[];
  ops: ElementOperations;
  history: EditorHistoryResult;
  addElement: (element: PptxElement) => void;
}

export interface StructuredElementHandlers {
  handleInsertSmartArt: (
    layout: SmartArtLayout,
    defaultItems: string[],
  ) => void;
  handleInsertEquation: (omml: Record<string, unknown>) => void;
  handleHyperlinkConfirm: (data: HyperlinkEditData) => void;
  handleInsertField: (fieldType: string) => void;
  handleAddActionButton: (shapeType: string) => void;
}

export function createStructuredElementHandlers(
  deps: StructuredElementDeps,
): StructuredElementHandlers {
  const {
    activeSlide,
    activeSlideIndex,
    selectedElements,
    ops,
    history,
    addElement,
  } = deps;

  const handleInsertSmartArt = (
    layout: SmartArtLayout,
    defaultItems: string[],
  ) => {
    if (!activeSlide) return;
    const nodeIds = defaultItems.map(
      (_, i) =>
        `node-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    );
    const nodes: PptxSmartArtNode[] = defaultItems.map((text, i) => {
      const node: PptxSmartArtNode = { id: nodeIds[i]!, text };
      if (layout === "hierarchy" && i > 0) node.parentId = nodeIds[0];
      return node;
    });
    addElement({
      id: generateElementId(),
      type: "smartArt" as const,
      x: 100,
      y: 120,
      width: 600,
      height: 340,
      smartArtData: {
        layout,
        colorScheme: "colorful1" as const,
        style: "flat" as const,
        nodes,
      },
    } as PptxElement);
  };

  const handleInsertEquation = (omml: Record<string, unknown>) => {
    if (!activeSlide) return;
    addElement({
      id: generateElementId(),
      type: "shape" as const,
      x: 120,
      y: 200,
      width: 400,
      height: 80,
      text: "[Equation]",
      textStyle: { fontSize: 18, fontFamily: "Cambria Math" },
      textSegments: [
        {
          text: "[Equation]",
          style: { fontSize: 18, fontFamily: "Cambria Math" } as TextStyle,
          equationXml: omml,
        },
      ],
    } as PptxElement);
  };

  const handleHyperlinkConfirm = (data: HyperlinkEditData) => {
    const sel = selectedElements[0];
    if (!sel) return;
    const resolved = resolveHyperlinkEditResult(data);
    const actionClick = {
      url: resolved.url || undefined,
      action: resolved.action,
      tooltip: resolved.tooltip,
    };
    ops.updateElementById(sel.id, { actionClick });
    history.markDirty();
  };

  const handleInsertField = (fieldType: string) => {
    if (!activeSlide) return;
    const fieldTexts: Record<string, string> = {
      slidenum: String(activeSlideIndex + 1),
      datetime: new Date().toLocaleDateString(),
      header: "Header",
      footer: "Footer",
    };
    const displayText = fieldTexts[fieldType] || fieldType;
    const fieldGuid = `{${crypto.randomUUID().toUpperCase()}}`;
    addElement({
      id: generateElementId(),
      type: "shape" as const,
      x: 120,
      y: 200,
      width: 200,
      height: 40,
      text: displayText,
      textStyle: { fontSize: 14 } as TextStyle,
      textSegments: [
        {
          text: displayText,
          style: { fontSize: 14 } as TextStyle,
          fieldType,
          fieldGuid,
        },
      ],
    } as PptxElement);
  };

  const handleAddActionButton = (shapeType: string) => {
    if (!activeSlide) return;
    const preset = ACTION_BUTTON_PRESETS.find((p) => p.shapeType === shapeType);
    if (!preset) return;
    const defaultPptxAction = elementActionToPptxAction({
      trigger: "click",
      type: preset.defaultAction,
    });
    addElement({
      id: generateElementId(),
      type: "shape",
      x: 150,
      y: 150,
      width: 80,
      height: 60,
      shapeType: preset.shapeType,
      shapeStyle: {
        fillColor: "#4472C4",
        strokeColor: "#2F5597",
        strokeWidth: 1,
      },
      actionClick: defaultPptxAction,
    } as ShapePptxElement);
  };

  return {
    handleInsertSmartArt,
    handleInsertEquation,
    handleHyperlinkConfirm,
    handleInsertField,
    handleAddActionButton,
  };
}
