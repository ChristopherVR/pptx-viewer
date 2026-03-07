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

/**
 * Props for the {@link ElementInspectorBody} component.
 */
interface ElementInspectorBodyProps {
  /** The currently selected element to inspect and edit. */
  selectedElement: PptxElement;
  /** Whether editing controls should be enabled. */
  canEdit: boolean;
  /** All slides in the presentation (used by ActionSettingsPanel for hyperlink targets). */
  slides: PptxSlide[];
  /** Active table cell editing state, if a table cell is being edited. */
  tableEditorState?: TableCellEditorState | null;
  /** Map of media relationship IDs to data URLs for media preview. */
  mediaDataUrls?: Map<string, string>;
  /** Callback to apply partial updates to the selected element. */
  onUpdateElement: (updates: Partial<PptxElement>) => void;
  /** Callback to apply partial updates to the element's shape style. */
  onUpdateElementStyle: (patch: Partial<ShapeStyle>) => void;
  /** Callback to apply partial updates to the element's text style. */
  onUpdateTextStyle: (patch: Partial<TextStyle>) => void;
  /** Callback to move the element forward or backward in z-order. */
  onMoveLayer: (direction: "forward" | "backward") => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Main body of the element inspector panel. Renders type-specific sub-panels
 * based on the selected element type:
 * - Transform controls (position, size, rotation) for all elements
 * - Table properties for table elements
 * - Chart data editing for chart elements
 * - SmartArt properties for SmartArt elements
 * - Image properties for picture/image elements
 * - Media playback controls for media elements
 * - Connector settings for connector elements
 * - Shape text and style panels for shape/text elements
 * - Action settings (hyperlinks, click actions) for actionable elements
 * - Layer ordering controls for all elements
 *
 * @param props - {@link ElementInspectorBodyProps}
 * @returns The composed element inspector body with type-appropriate panels.
 */
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
