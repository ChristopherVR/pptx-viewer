import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../utils";
import type {
  PptxElement,
  PptxImageLikeElement,
} from "pptx-viewer-core";
import { CARD, HEADING, INPUT } from "./inspector-pane-constants";
import { ImageAdjustmentsPanel } from "./ImageAdjustmentsPanel";
import { DuotonePanel } from "./DuotonePanel";
import { RangeSlider } from "./RangeSlider";
import { ColorWashSection } from "./ColorWashSection";
import { ColorChangeSection } from "./ColorChangeSection";
import { ArtisticEffectsGallery } from "./ArtisticEffectsGallery";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImagePropertiesPanelProps {
  selectedElement: PptxImageLikeElement;
  canEdit: boolean;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImagePropertiesPanel({
  selectedElement,
  canEdit,
  onUpdateElement,
}: ImagePropertiesPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const fx = selectedElement.imageEffects;

  const updateEffects = (patch: Record<string, unknown>) => {
    onUpdateElement({
      imageEffects: { ...(fx ?? {}), ...patch },
    } as Partial<PptxElement>);
  };

  return (
    <div className={CARD}>
      <div className={HEADING}>{t("pptx.image.properties")}</div>
      <div className="space-y-2">
        {/* Alt Text */}
        <label className="flex flex-col gap-1 text-[11px]">
          <span className="text-muted-foreground">Alt Text</span>
          <textarea
            rows={2}
            disabled={!canEdit}
            className={cn(INPUT, "resize-none text-[11px]")}
            value={selectedElement.altText ?? ""}
            onChange={(e) =>
              onUpdateElement({
                altText: e.target.value,
              } as Partial<PptxElement>)
            }
          />
        </label>

        {/* Brightness / Contrast / Saturation */}
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <RangeSlider
            label="Brightness"
            disabled={!canEdit}
            value={fx?.brightness ?? 0}
            onChange={(v) => updateEffects({ brightness: v })}
          />
          <RangeSlider
            label="Contrast"
            disabled={!canEdit}
            value={fx?.contrast ?? 0}
            onChange={(v) => updateEffects({ contrast: v })}
          />
          <RangeSlider
            label={t("pptx.image.saturation")}
            disabled={!canEdit}
            value={fx?.saturation ?? 0}
            onChange={(v) => updateEffects({ saturation: v })}
          />
          <ImageAdjustmentsPanel
            selectedElement={selectedElement}
            canEdit={canEdit}
            onUpdateElement={onUpdateElement}
          />
        </div>

        {/* Grayscale + Duotone */}
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Grayscale</span>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={Boolean(fx?.grayscale)}
              onChange={(e) => updateEffects({ grayscale: e.target.checked })}
            />
          </label>
          <DuotonePanel
            selectedElement={selectedElement}
            canEdit={canEdit}
            onUpdateElement={onUpdateElement}
          />
        </div>

        {/* Colour Wash */}
        <ColorWashSection
          fx={fx}
          canEdit={canEdit}
          updateEffects={updateEffects}
        />

        {/* Colour Change */}
        <ColorChangeSection
          fx={fx}
          canEdit={canEdit}
          updateEffects={updateEffects}
        />

        {/* Artistic Effects Gallery */}
        <ArtisticEffectsGallery
          imgSrc={selectedElement.imageData}
          fx={fx}
          canEdit={canEdit}
          updateEffects={updateEffects}
        />

        {/* Reset Image */}
        <button
          type="button"
          disabled={!canEdit}
          className="w-full text-[11px] rounded bg-muted hover:bg-accent border border-border px-2 py-1 text-foreground"
          onClick={() =>
            onUpdateElement({
              imageEffects: {
                brightness: 0,
                contrast: 0,
                saturation: 0,
                grayscale: false,
                artisticEffect: undefined,
                colorWash: undefined,
                alphaModFix: undefined,
                biLevel: undefined,
                duotone: undefined,
              },
              cropShape: "none",
            } as Partial<PptxElement>)
          }
        >
          {t("pptx.image.resetImage")}
        </button>
      </div>
    </div>
  );
}
