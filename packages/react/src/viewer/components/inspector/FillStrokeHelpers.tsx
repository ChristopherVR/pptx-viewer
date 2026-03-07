import type { ShapeStyle } from "pptx-viewer-core";
import type { PptxElement } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Re-exports (backward compatibility)
// ---------------------------------------------------------------------------

export type { EffectToggleCfg } from "./fill-stroke-effect-configs";
export {
  BEVEL_TYPE_OPTIONS,
  SHADOW_EFFECT_CONFIGS,
} from "./fill-stroke-effect-configs";
export { VISUAL_EFFECT_CONFIGS } from "./fill-stroke-visual-configs";
export {
  COMPOUND_LINE_OPTIONS,
  LINE_JOIN_OPTIONS,
  LINE_CAP_OPTIONS,
  FILL_MODE_OPTIONS,
  PATTERN_PRESET_OPTIONS,
  GRADIENT_TYPE_OPTIONS,
  IMAGE_MODE_OPTIONS,
  getCompoundLinePreviewStyle,
} from "./fill-stroke-options";
export {
  SelectRow,
  ColorPickerRow,
  GradientStopRow,
  EffectField,
} from "./FillStrokeSubComponents";

// Merged EFFECT_CONFIGS for backward compatibility
import { SHADOW_EFFECT_CONFIGS } from "./fill-stroke-effect-configs";
import { VISUAL_EFFECT_CONFIGS } from "./fill-stroke-visual-configs";

export const EFFECT_CONFIGS = [
  ...SHADOW_EFFECT_CONFIGS,
  ...VISUAL_EFFECT_CONFIGS,
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FillStrokePropertiesProps {
  selectedElement: PptxElement;
  selectedShapeStyle: ShapeStyle | undefined;
  selectedShapeType: string | undefined;
  selectedGradientStops: Array<{
    color: string;
    position: number;
    opacity?: number;
  }>;
  recentColors: string[];
  canEdit: boolean;
  onUpdateShapeStyle: (updates: Partial<ShapeStyle>) => void;
  onSetFillColor: (color: string) => void;
  onSetStrokeColor: (color: string) => void;
}

// ---------------------------------------------------------------------------
// Shared CSS classes & helpers
// ---------------------------------------------------------------------------

export const SEL = "bg-muted border border-border rounded px-2 py-1";
export const NUM = SEL;
export const RNG = "accent-primary";
export const SWATCH = "h-4 w-4 rounded border border-border";
export const DIS = "disabled:opacity-40 disabled:cursor-not-allowed";
export const LBL = "text-muted-foreground";
export const COL2 = "col-span-2";

export type GradientStop = {
  color: string;
  position: number;
  opacity?: number;
};

export const isLineish = (el: PptxElement, st: string | undefined): boolean =>
  el.type === "connector" || st === "line";

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export const safeNum = (raw: string, fallback: number): number => {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};
