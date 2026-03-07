import type { PptxTableCellStyle } from "../../../core";
import { OOXML_PATTERN_PRESETS } from "../../utils/color";

// ---------------------------------------------------------------------------
// Shared classes (match InspectorPane)
// ---------------------------------------------------------------------------

export const SEL =
  "bg-muted border border-border rounded px-2 py-1 text-[11px] w-full";
export const NUM =
  "flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full text-[11px]";
export const LBL = "text-muted-foreground text-[11px]";
export const SECTION_HEADING =
  "text-[11px] uppercase tracking-wide text-muted-foreground";

// ---------------------------------------------------------------------------
// Fill mode options
// ---------------------------------------------------------------------------

export const FILL_MODE_OPTIONS: Array<{
  value: PptxTableCellStyle["fillMode"];
  i18nKey: string;
}> = [
  { value: "solid", i18nKey: "pptx.table.fillSolid" },
  { value: "gradient", i18nKey: "pptx.table.fillGradient" },
  { value: "pattern", i18nKey: "pptx.table.fillPattern" },
  { value: "none", i18nKey: "pptx.table.fillNone" },
];

export const GRADIENT_TYPE_OPTIONS: Array<{ value: string; i18nKey: string }> =
  [
    { value: "linear", i18nKey: "pptx.table.gradientLinear" },
    { value: "radial", i18nKey: "pptx.table.gradientRadial" },
  ];

// Subset of common patterns
export const PATTERN_OPTIONS = OOXML_PATTERN_PRESETS.slice(0, 20);
