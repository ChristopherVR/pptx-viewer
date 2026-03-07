import type { PptxImageLikeElement } from "../../../core";

// ---------------------------------------------------------------------------
// Shared types for image property sub-panels
// ---------------------------------------------------------------------------

export interface EffectSectionProps {
  fx: PptxImageLikeElement["imageEffects"];
  canEdit: boolean;
  updateEffects: (patch: Record<string, unknown>) => void;
}

export interface RangeSliderProps {
  label: string;
  disabled: boolean;
  value: number;
  onChange: (v: number) => void;
}
