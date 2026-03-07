/**
 * useGroupAlignLayerHandlers — Group/ungroup, flip, alignment, and
 * layer-order handlers extracted from useElementManipulation.
 */
import type {
  PptxElement,
  PptxSlide,
  GroupPptxElement,
} from "pptx-viewer-core";
import { generateElementId } from "../utils/generate-id";
import type { ElementOperations } from "./useElementOperations";
import type { EditorHistoryResult } from "./useEditorHistory";
import type { GroupAlignLayerHandlers } from "./element-manipulation-types";

interface GroupAlignLayerInput {
  activeSlide: PptxSlide | undefined;
  activeSlideIndex: number;
  selectedElement: PptxElement | null;
  effectiveSelectedIds: string[];
  selectedElements: PptxElement[];
  elementLookup: Map<string, PptxElement>;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  ops: ElementOperations;
  history: EditorHistoryResult;
}

export function useGroupAlignLayerHandlers(
  input: GroupAlignLayerInput,
): GroupAlignLayerHandlers {
  const {
    activeSlide,
    activeSlideIndex,
    selectedElement,
    effectiveSelectedIds,
    selectedElements,
    elementLookup,
    setSelectedElementIds,
    ops,
    history,
  } = input;

  const handleGroupElements = () => {
    const ids = effectiveSelectedIds;
    if (ids.length < 2 || !activeSlide) return;
    const idSet = new Set(ids);
    const targets = activeSlide.elements.filter((el) => idSet.has(el.id));
    if (targets.length < 2) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const el of targets) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
    const children: PptxElement[] = targets.map((el) => ({
      ...structuredClone(el),
      x: el.x - minX,
      y: el.y - minY,
    }));
    const group: GroupPptxElement = {
      id: generateElementId(),
      type: "group",
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
      hidden: false,
      opacity: 1,
      rawXml: {},
      children,
    };
    ops.updateSlides((prev) =>
      prev.map((s, i) =>
        i === activeSlideIndex
          ? {
              ...s,
              elements: [
                ...s.elements.filter((el) => !idSet.has(el.id)),
                group,
              ],
            }
          : s,
      ),
    );
    ops.applySelection(group.id);
    history.markDirty();
  };

  const handleUngroupElement = () => {
    if (!selectedElement || selectedElement.type !== "group" || !activeSlide)
      return;
    const group = selectedElement as GroupPptxElement;
    const ungrouped: PptxElement[] = group.children.map((child) => ({
      ...structuredClone(child),
      id: child.id || generateElementId(),
      x: child.x + group.x,
      y: child.y + group.y,
    }));
    ops.updateSlides((prev) =>
      prev.map((s, i) =>
        i === activeSlideIndex
          ? {
              ...s,
              elements: [
                ...s.elements.filter((el) => el.id !== group.id),
                ...ungrouped,
              ],
            }
          : s,
      ),
    );
    setSelectedElementIds(ungrouped.map((el) => el.id));
    history.markDirty();
  };

  const handleFlip = (direction: "horizontal" | "vertical") => {
    if (!selectedElement) return;
    const update =
      direction === "horizontal"
        ? { flipHorizontal: !selectedElement.flipHorizontal }
        : { flipVertical: !selectedElement.flipVertical };
    ops.updateSelectedElement(update);
    history.markDirty();
  };

  const handleAlignElements = (align: string) => {
    if (selectedElements.length < 2) return;
    const bounds = selectedElements.map((el) => ({
      id: el.id,
      left: el.x,
      top: el.y,
      right: el.x + el.width,
      bottom: el.y + el.height,
    }));
    const groupLeft = Math.min(...bounds.map((b) => b.left));
    const groupTop = Math.min(...bounds.map((b) => b.top));
    const groupRight = Math.max(...bounds.map((b) => b.right));
    const groupBottom = Math.max(...bounds.map((b) => b.bottom));
    const groupCenterX = (groupLeft + groupRight) / 2;
    const groupCenterY = (groupTop + groupBottom) / 2;
    for (const b of bounds) {
      const el = elementLookup.get(b.id);
      if (!el) continue;
      let newX = el.x,
        newY = el.y;
      switch (align) {
        case "left":
          newX = groupLeft;
          break;
        case "center":
          newX = groupCenterX - el.width / 2;
          break;
        case "right":
          newX = groupRight - el.width;
          break;
        case "top":
          newY = groupTop;
          break;
        case "middle":
          newY = groupCenterY - el.height / 2;
          break;
        case "bottom":
          newY = groupBottom - el.height;
          break;
      }
      ops.updateElementById(b.id, { x: newX, y: newY });
    }
    history.markDirty();
  };

  const handleMoveLayer = (direction: string) => {
    if (!selectedElement || !activeSlide) return;
    const elements = activeSlide.elements;
    const idx = elements.findIndex((el) => el.id === selectedElement.id);
    if (idx === -1) return;
    const newElements = [...elements];
    if (direction === "forward" && idx < elements.length - 1)
      [newElements[idx], newElements[idx + 1]] = [
        newElements[idx + 1],
        newElements[idx],
      ];
    else if (direction === "backward" && idx > 0)
      [newElements[idx], newElements[idx - 1]] = [
        newElements[idx - 1],
        newElements[idx],
      ];
    ops.updateSlides((prev) =>
      prev.map((s, i) =>
        i === activeSlideIndex ? { ...s, elements: newElements } : s,
      ),
    );
    history.markDirty();
  };

  const handleMoveLayerToEdge = (direction: string) => {
    if (!selectedElement || !activeSlide) return;
    const elements = activeSlide.elements;
    const idx = elements.findIndex((el) => el.id === selectedElement.id);
    if (idx === -1) return;
    const el = elements[idx];
    const rest = elements.filter((_, i) => i !== idx);
    const newElements = direction === "front" ? [...rest, el] : [el, ...rest];
    ops.updateSlides((prev) =>
      prev.map((s, i) =>
        i === activeSlideIndex ? { ...s, elements: newElements } : s,
      ),
    );
    history.markDirty();
  };

  return {
    handleGroupElements,
    handleUngroupElement,
    handleFlip,
    handleAlignElements,
    handleMoveLayer,
    handleMoveLayerToEdge,
  };
}
