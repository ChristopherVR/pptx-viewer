/**
 * Selection Pane — lists all elements on the active slide with
 * visibility toggles, rename-on-double-click, and drag-to-reorder.
 */
import React, { useState, useCallback, useRef } from "react";
import { LuEye, LuEyeOff, LuGripVertical } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { cn } from "../utils";
import type { PptxElement, PptxSlide } from "pptx-viewer-core";
import { hasTextProperties } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SelectionPaneProps {
  slides: PptxSlide[];
  activeSlideIndex: number;
  selectedElementId: string | null;
  selectedElementIds: string[];
  canEdit: boolean;
  setSelectedElementId: (id: string | null) => void;
  setSelectedElementIds: (ids: string[]) => void;
  setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
  markDirty: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getElementDisplayName(element: PptxElement, index: number): string {
  if (
    hasTextProperties(element) &&
    element.text &&
    element.text.trim().length > 0
  ) {
    return element.text.trim().slice(0, 32);
  }
  const typeLabels: Record<string, string> = {
    text: "Text Box",
    shape: "Shape",
    connector: "Connector",
    image: "Image",
    picture: "Picture",
    chart: "Chart",
    table: "Table",
    smartArt: "SmartArt",
    media: "Media",
    group: "Group",
    ink: "Ink",
    ole: "Object",
    unknown: "Object",
  };
  const label = typeLabels[element.type] ?? "Object";
  return `${label} ${index + 1}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SelectionPane({
  slides,
  activeSlideIndex,
  selectedElementId,
  selectedElementIds,
  canEdit,
  setSelectedElementId,
  setSelectedElementIds,
  setSlides,
  markDirty,
  onClose,
}: SelectionPaneProps): React.ReactElement {
  const { t } = useTranslation();
  const activeSlide = slides[activeSlideIndex] as PptxSlide | undefined;
  const elements = activeSlide?.elements ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Drag reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleSelect = useCallback(
    (elementId: string) => {
      setSelectedElementId(elementId);
      setSelectedElementIds([elementId]);
    },
    [setSelectedElementId, setSelectedElementIds],
  );

  const handleToggleVisibility = useCallback(
    (elementId: string) => {
      setSlides((prevSlides) => {
        const nextSlides = [...prevSlides];
        const slide = nextSlides[activeSlideIndex];
        if (!slide) return prevSlides;
        const nextElements = [...(slide.elements ?? [])];
        const idx = nextElements.findIndex((e) => e.id === elementId);
        if (idx === -1) return prevSlides;
        nextElements[idx] = {
          ...nextElements[idx],
          hidden: !nextElements[idx].hidden,
        } as PptxElement;
        nextSlides[activeSlideIndex] = { ...slide, elements: nextElements };
        return nextSlides;
      });
      markDirty();
    },
    [activeSlideIndex, setSlides, markDirty],
  );

  const handleDoubleClick = useCallback(
    (element: PptxElement, displayName: string) => {
      if (!canEdit) return;
      setEditingId(element.id);
      setEditingName(displayName);
      setTimeout(() => inputRef.current?.select(), 0);
    },
    [canEdit],
  );

  const commitRename = useCallback(() => {
    // Renaming is cosmetic — we don't have a `name` field on PptxElement,
    // so we just clear the editing state. In a full implementation this
    // would persist to element metadata.
    setEditingId(null);
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [dragIndex],
  );

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (dragIndex === null || dragIndex === targetIndex) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }

      setSlides((prevSlides) => {
        const nextSlides = [...prevSlides];
        const slide = nextSlides[activeSlideIndex];
        if (!slide) return prevSlides;
        const nextElements = [...(slide.elements ?? [])];
        const [moved] = nextElements.splice(dragIndex, 1);
        nextElements.splice(targetIndex, 0, moved);
        nextSlides[activeSlideIndex] = { ...slide, elements: nextElements };
        return nextSlides;
      });
      markDirty();
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex, activeSlideIndex, setSlides, markDirty],
  );

  // Display in reverse order (top-most element first)
  const reversed = [...elements].reverse();

  return (
    <div className="flex flex-col h-full bg-popover border-l border-border w-56">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-foreground">
          {t("pptx.selectionPane.title")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xs"
          title={t("pptx.selectionPane.close")}
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {reversed.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground italic">
            {t("pptx.selectionPane.empty")}
          </div>
        ) : (
          reversed.map((element, reversedIdx) => {
            const realIndex = elements.length - 1 - reversedIdx;
            const isSelected =
              selectedElementId === element.id ||
              selectedElementIds.includes(element.id);
            const displayName = getElementDisplayName(element, realIndex);
            const isEditing = editingId === element.id;

            return (
              <div
                key={element.id}
                draggable={canEdit}
                onDragStart={() => handleDragStart(realIndex)}
                onDragOver={(e) => handleDragOver(e, realIndex)}
                onDrop={() => handleDrop(realIndex)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 text-xs cursor-pointer transition-colors",
                  isSelected
                    ? "bg-primary/30 text-primary"
                    : "hover:bg-muted text-foreground",
                  dragOverIndex === realIndex
                    ? "border-t-2 border-primary"
                    : "",
                )}
                onClick={() => handleSelect(element.id)}
                onDoubleClick={() => handleDoubleClick(element, displayName)}
              >
                {canEdit && (
                  <LuGripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0 cursor-grab" />
                )}
                <span className="flex-1 truncate">
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full bg-muted text-xs px-1 py-0.5 rounded border border-border outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    displayName
                  )}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                  title={
                    element.hidden
                      ? t("pptx.selectionPane.show")
                      : t("pptx.selectionPane.hide")
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleVisibility(element.id);
                  }}
                >
                  {element.hidden ? (
                    <LuEyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <LuEye className="w-3.5 h-3.5 opacity-50" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
