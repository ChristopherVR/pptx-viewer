import type { ShapeStyle, PptxElement } from 'pptx-viewer-core';

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

export const SEL = 'bg-muted border border-border rounded px-2 py-1';
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
};

export const isLineish = (el: PptxElement, st: string | undefined): boolean =>
	el.type === 'connector' || st === 'line';

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export const safeNum = (raw: string, fallback: number): number => {
	const n = Number(raw);
	return Number.isFinite(n) ? n : fallback;
};
