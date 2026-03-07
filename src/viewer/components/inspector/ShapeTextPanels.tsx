import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../utils";
import type {
  PptxElement,
  ShapeStyle,
  TextStyle,
} from "../../../core";
import {
  hasShapeProperties,
  hasTextProperties,
} from "../../../core";
import { normalizeHexColor } from "../../utils";
import { SHAPE_PRESETS } from "../../constants";
import { CARD, HEADING, INPUT } from "./inspector-pane-constants";
import { DebouncedColorInput } from "./DebouncedColorInput";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShapeTextPanelsProps {
  selectedElement: PptxElement;
  canEdit: boolean;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
  onUpdateElementStyle: (patch: Partial<ShapeStyle>) => void;
  onUpdateTextStyle: (patch: Partial<TextStyle>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShapeTextPanels({
  selectedElement,
  canEdit,
  onUpdateElement,
  onUpdateElementStyle,
  onUpdateTextStyle,
}: ShapeTextPanelsProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      {/* Shape Type */}
      {hasShapeProperties(selectedElement) && (
        <div className={CARD}>
          <div className={HEADING}>{t("pptx.shape.type", "Shape Type")}</div>
          <select
            value={selectedElement.shapeType || "rect"}
            disabled={!canEdit}
            className={cn(INPUT, "w-full")}
            onChange={(e) =>
              onUpdateElement({
                shapeType: e.target.value,
              } as Partial<PptxElement>)
            }
          >
            {SHAPE_PRESETS.filter((p) => p.type !== "connector").map((p) => (
              <option key={p.type} value={p.type}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Fill & Stroke */}
      {hasShapeProperties(selectedElement) && (
        <div className={CARD}>
          <div className={HEADING}>
            {t("pptx.shape.fillStroke", "Fill & Stroke")}
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Fill</span>
              <DebouncedColorInput
                disabled={!canEdit}
                value={normalizeHexColor(
                  selectedElement.shapeStyle?.fillColor,
                  "#3b82f6",
                )}
                className="w-full h-7 rounded border border-border bg-transparent cursor-pointer"
                onCommit={(hex) =>
                  onUpdateElementStyle({ fillColor: hex, fillMode: "solid" })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Stroke</span>
              <DebouncedColorInput
                disabled={!canEdit}
                value={normalizeHexColor(
                  selectedElement.shapeStyle?.strokeColor,
                  "#1f2937",
                )}
                className="w-full h-7 rounded border border-border bg-transparent cursor-pointer"
                onCommit={(hex) => onUpdateElementStyle({ strokeColor: hex })}
              />
            </label>
            <label className="flex items-center gap-1 col-span-2">
              <span className="w-16 text-muted-foreground">Stroke W</span>
              <input
                type="number"
                disabled={!canEdit}
                className={INPUT}
                min={0}
                max={20}
                value={selectedElement.shapeStyle?.strokeWidth ?? 1}
                onChange={(e) =>
                  onUpdateElementStyle({ strokeWidth: Number(e.target.value) })
                }
              />
            </label>
          </div>
        </div>
      )}

      {/* Text Color & Font Size */}
      {hasTextProperties(selectedElement) && (
        <div className={CARD}>
          <div className={HEADING}>{t("pptx.text.title", "Text")}</div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Size</span>
              <input
                type="number"
                disabled={!canEdit}
                className={INPUT}
                min={6}
                max={200}
                value={selectedElement.textStyle?.fontSize ?? 18}
                onChange={(e) =>
                  onUpdateTextStyle({ fontSize: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Color</span>
              <DebouncedColorInput
                disabled={!canEdit}
                value={normalizeHexColor(
                  selectedElement.textStyle?.color,
                  "#000000",
                )}
                className="w-full h-7 rounded border border-border bg-transparent cursor-pointer"
                onCommit={(hex) => onUpdateTextStyle({ color: hex })}
              />
            </label>
            <div className="flex gap-1 col-span-2">
              <TextFormatToggle
                label="B"
                active={Boolean(selectedElement.textStyle?.bold)}
                disabled={!canEdit}
                onClick={() =>
                  onUpdateTextStyle({ bold: !selectedElement.textStyle?.bold })
                }
              />
              <TextFormatToggle
                label="I"
                active={Boolean(selectedElement.textStyle?.italic)}
                disabled={!canEdit}
                italic
                onClick={() =>
                  onUpdateTextStyle({
                    italic: !selectedElement.textStyle?.italic,
                  })
                }
              />
              <TextFormatToggle
                label="U"
                active={Boolean(selectedElement.textStyle?.underline)}
                disabled={!canEdit}
                underline
                onClick={() =>
                  onUpdateTextStyle({
                    underline: !selectedElement.textStyle?.underline,
                  })
                }
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Private sub-component
// ---------------------------------------------------------------------------

interface TextFormatToggleProps {
  label: string;
  active: boolean;
  disabled: boolean;
  italic?: boolean;
  underline?: boolean;
  onClick: () => void;
}

function TextFormatToggle({
  label,
  active,
  disabled,
  italic,
  underline,
  onClick,
}: TextFormatToggleProps): React.ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "px-2 py-1 rounded text-[11px] transition-colors",
        italic && "italic",
        underline && "underline",
        active ? "bg-primary text-white" : "bg-muted hover:bg-accent",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
