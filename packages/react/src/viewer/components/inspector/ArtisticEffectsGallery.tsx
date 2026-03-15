import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../utils";
import type { PptxImageLikeElement } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Artistic effect presets
// ---------------------------------------------------------------------------

export const ARTISTIC_EFFECTS = [
  ["none", "pptx.image.effectNone", ""],
  ["blur", "pptx.image.effectBlur", "blur(4px)"],
  ["grayscale", "pptx.image.effectGrayscale", "grayscale(100%)"],
  ["sepia", "pptx.image.effectSepia", "sepia(100%)"],
  [
    "pencilSketch",
    "pptx.image.effectPencilSketch",
    "grayscale(100%) contrast(150%) brightness(80%)",
  ],
  [
    "lineDrawing",
    "pptx.image.effectLineDrawing",
    "grayscale(100%) contrast(150%)",
  ],
  [
    "watercolorSponge",
    "pptx.image.effectWatercolor",
    "saturate(150%) blur(1px)",
  ],
  [
    "paintStrokes",
    "pptx.image.effectPaintStrokes",
    "blur(3px) saturate(140%)",
  ],
  [
    "glow_edges",
    "pptx.image.effectGlowEdges",
    "contrast(180%) invert(5%) brightness(110%)",
  ],
  [
    "glowDiffused",
    "pptx.image.effectGlowDiffused",
    "blur(3px) brightness(120%)",
  ],
  ["cement", "pptx.image.effectCement", "contrast(200%) brightness(60%)"],
  [
    "photocopy",
    "pptx.image.effectPhotocopy",
    "grayscale(100%) contrast(200%) brightness(120%)",
  ],
  [
    "filmGrain",
    "pptx.image.effectFilmGrain",
    "contrast(110%) brightness(105%)",
  ],
  ["mosaic", "pptx.image.effectMosaic", "blur(8px) contrast(105%)"],
  [
    "chalkSketch",
    "pptx.image.effectChalk",
    "grayscale(80%) contrast(140%) brightness(110%)",
  ],
  [
    "marker",
    "pptx.image.effectMarker",
    "contrast(130%) saturate(130%)",
  ],
  [
    "cutout",
    "pptx.image.effectCutout",
    "contrast(300%) brightness(120%)",
  ],
  [
    "pastelsSmooth",
    "pptx.image.effectPastels",
    "blur(4px) saturate(120%)",
  ],
  [
    "paint",
    "pptx.image.effectPaint",
    "blur(3px) saturate(160%) contrast(110%)",
  ],
  [
    "plasticWrap",
    "pptx.image.effectPlasticWrap",
    "contrast(150%) brightness(115%) saturate(80%)",
  ],
  [
    "lightScreen",
    "pptx.image.effectLightScreen",
    "brightness(130%) contrast(80%)",
  ],
  [
    "sharpen",
    "pptx.image.effectSharpen",
    "contrast(160%) brightness(105%)",
  ],
  [
    "texturizer",
    "pptx.image.effectTexturizer",
    "contrast(110%) brightness(105%)",
  ],
  [
    "crisscrossEtching",
    "pptx.image.effectCrisscross",
    "grayscale(60%) contrast(120%)",
  ],
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ArtisticGalleryProps {
  imgSrc: string | undefined;
  fx: PptxImageLikeElement["imageEffects"];
  canEdit: boolean;
  updateEffects: (patch: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Gallery grid
// ---------------------------------------------------------------------------

export function ArtisticEffectsGallery({
  imgSrc,
  fx,
  canEdit,
  updateEffects,
}: ArtisticGalleryProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className="space-y-1 text-[11px]">
      <span className="text-muted-foreground">
        {t("pptx.image.artisticEffects")}
      </span>
      <div className="grid grid-cols-4 gap-1">
        {ARTISTIC_EFFECTS.map(([effectName, tKey, cssFilter]) => {
          const isActive =
            effectName === "none"
              ? !fx?.artisticEffect
              : fx?.artisticEffect === effectName;
          return (
            <button
              key={effectName}
              type="button"
              disabled={!canEdit}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded border p-0.5 hover:bg-accent/50",
                isActive ? "border-primary bg-primary/10" : "border-border",
              )}
              title={t(tKey)}
              onClick={() =>
                updateEffects({
                  artisticEffect:
                    effectName === "none" ? undefined : effectName,
                  ...(effectName === "grayscale"
                    ? { grayscale: undefined }
                    : {}),
                })
              }
            >
              <div
                className="w-10 h-7 rounded overflow-hidden bg-muted"
                style={{
                  backgroundImage: imgSrc ? `url(${imgSrc})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: cssFilter || undefined,
                }}
              />
              <span className="text-[8px] text-muted-foreground truncate w-full text-center">
                {t(tKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
