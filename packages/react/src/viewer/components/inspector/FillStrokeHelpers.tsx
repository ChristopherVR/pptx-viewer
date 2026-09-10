import type { PptxThemeColorRef, ShapeStyle, PptxElement } from 'pptx-viewer-core';

import { SHADOW_EFFECT_CONFIGS } from './fill-stroke-effect-configs';
import { VISUAL_EFFECT_CONFIGS } from './fill-stroke-visual-configs';

export const EFFECT_CONFIGS = [...SHADOW_EFFECT_CONFIGS, ...VISUAL_EFFECT_CONFIGS];

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
		colorRef?: PptxThemeColorRef;
	}>;
	canEdit: boolean;
	onUpdateShapeStyle: (updates: Partial<ShapeStyle>) => void;
	onSetFillColor: (color: string, ref?: PptxThemeColorRef) => void;
	onSetStrokeColor: (color: string, ref?: PptxThemeColorRef) => void;
}

// ---------------------------------------------------------------------------
// Shared CSS classes & helpers
// ---------------------------------------------------------------------------

// `max-md:min-h-[44px]!` matches MIN_TOUCH_TARGET_PX (44) from
// pptx-viewer-shared's render/responsive module at Tailwind's `md` (768px)
// breakpoint, the same MOBILE_BREAKPOINT every dense-panel decision function
// is measured against. The trailing `!` is load-bearing: `theme.css`'s
// baseline `:where(button, [role='button'])... { min-width: 24px; min-height:
// 24px; }` is UNLAYERED CSS, and an unlayered rule beats a Tailwind utility
// (which lives inside `@layer utilities`) regardless of specificity unless
// the utility is `!important` (see inspector-pane-constants.ts's `BTN`/`INPUT`
// for the same fix). `SEL` backs every <select>/<input> row across the
// Fill/Stroke/Effect inspector sub-panels (FillStrokeSubComponents,
// FillAdvancedControls, EffectField, table cell fill controls), so fixing it
// once here reaches all of them instead of each row sizing itself.
export const SEL = 'bg-muted border border-border rounded px-2 py-1 max-md:min-h-[44px]!';
export const NUM = SEL;
export const RNG = 'accent-primary';
export const SWATCH = 'h-4 w-4 rounded border border-border';
export const DIS = 'disabled:opacity-40 disabled:cursor-not-allowed';
export const LBL = 'text-muted-foreground';
export const COL2 = 'col-span-2';

export type GradientStop = {
	color: string;
	position: number;
	opacity?: number;
	colorRef?: PptxThemeColorRef;
};

export const isLineish = (el: PptxElement, st: string | undefined): boolean =>
	el.type === 'connector' || st === 'line';

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export const safeNum = (raw: string, fallback: number): number => {
	const n = Number(raw);
	return Number.isFinite(n) ? n : fallback;
};
