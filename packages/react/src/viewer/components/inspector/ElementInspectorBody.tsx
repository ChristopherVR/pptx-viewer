import React from "react";
import { useTranslation } from "react-i18next";

import type {
  PptxElement,
  PptxSlide,
  TablePptxElement,
  ChartPptxElement,
  MediaPptxElement,
  ShapeStyle,
  TextStyle,
} from "pptx-viewer-core";
import { isImageLikeElement } from "pptx-viewer-core";
import type { TableCellEditorState } from "../../types";
import { CARD, HEADING, INPUT, POS_FIELDS } from "./inspector-pane-constants";
import { TablePropertiesPanel } from "./TablePropertiesPanel";
import { SmartArtPropertiesPanel } from "./SmartArtPropertiesPanel";
import { ImagePropertiesPanel } from "./ImagePropertiesPanel";
import { ActionSettingsPanel } from "./ActionSettingsPanel";
import { ShapeTextPanels } from "./ShapeTextPanels";
import {
  ConnectorPanel,
  GroupInfoPanel,
  OlePropertiesPanel,
  TransformPanel,
  LayerOrderButtons,
} from "./ElementMiscPanels";
import { ChartDataPanel } from "./ChartDataPanel";
import { MediaPropertiesPanel } from "./MediaPropertiesPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ElementInspectorBodyProps {
  selectedElement: PptxElement;
  canEdit: boolean;
  slides: PptxSlide[];
  tableEditorState?: TableCellEditorState | null;
  mediaDataUrls?: Map<string, string>;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
  onUpdateElementStyle: (patch: Partial<ShapeStyle>) => void;
  onUpdateTextStyle: (patch: Partial<TextStyle>) => void;
  onMoveLayer: (direction: "forward" | "backward") => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ElementInspectorBody({
  selectedElement,
  canEdit,
  slides,
  tableEditorState,
  mediaDataUrls,
  onUpdateElement,
  onUpdateElementStyle,
  onUpdateTextStyle,
  onMoveLayer,
}: ElementInspectorBodyProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      {/* Position & Size */}
      <div className={CARD}>
        <div className={HEADING}>{t("pptx.inspector.element")}</div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          {POS_FIELDS.map(([label, key]) => (
            <label key={key} className="flex items-center gap-1">
              <span className="w-4 text-muted-foreground">{label}</span>
              <input
                type="number"
                className={INPUT}
                disabled={!canEdit}
                value={Math.round(
                  (selectedElement[key as keyof PptxElement] as number) ?? 0,
                )}
                onChange={(e) =>
                  onUpdateElement({
                    [key]: Number(e.target.value),
                  } as Partial<PptxElement>)
                }
              />
            </label>
          ))}
        </div>
      </div>

      {selectedElement.type === "table" && (
        <TablePropertiesPanel
          tableElement={selectedElement as TablePptxElement}
          canEdit={canEdit}
          onUpdateElement={onUpdateElement}
          tableEditorState={tableEditorState}
        />
      )}

      {selectedElement.type === "chart" && (
        <ChartDataPanel
          selectedElement={selectedElement as ChartPptxElement}
          canEdit={canEdit}
          onUpdateElement={onUpdateElement}
        />
      )}

      {selectedElement.type === "smartArt" && selectedElement.smartArtData && (
        <SmartArtPropertiesPanel
          smartArtData={selectedElement.smartArtData}
          canEdit={canEdit}
          onUpdateElement={onUpdateElement}
        />
      )}

      {isImageLikeElement(selectedElement) && (
        <ImagePropertiesPanel
          selectedElement={selectedElement}
          canEdit={canEdit}
          onUpdateElement={onUpdateElement}
        />
      )}

      {selectedElement.type === "media" && (
        <MediaPropertiesPanel
          element={selectedElement as MediaPptxElement}
          mediaDataUrls={mediaDataUrls ?? new Map()}
          canEdit={canEdit}
          onUpdateElement={onUpdateElement}
        />
      )}

      <ConnectorPanel
        selectedElement={selectedElement}
        canEdit={canEdit}
        onUpdateElementStyle={onUpdateElementStyle}
      />

      <GroupInfoPanel selectedElement={selectedElement} />

      <OlePropertiesPanel selectedElement={selectedElement} />

      <ShapeTextPanels
        selectedElement={selectedElement}
        canEdit={canEdit}
        onUpdateElement={onUpdateElement}
        onUpdateElementStyle={onUpdateElementStyle}
        onUpdateTextStyle={onUpdateTextStyle}
      />

      <ActionSettingsPanel
        selectedElement={selectedElement}
        slides={slides}
        canEdit={canEdit}
        onUpdateElement={onUpdateElement}
      />

      <TransformPanel
        selectedElement={selectedElement}
        canEdit={canEdit}
        onUpdateElement={onUpdateElement}
      />

      <LayerOrderButtons canEdit={canEdit} onMoveLayer={onMoveLayer} />
    </>
  );
}
