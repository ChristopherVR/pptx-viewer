/**
 * table-advanced-fill.ts - framework-agnostic option lists + shared class tokens
 * for the advanced (gradient / pattern) table-cell fill inspector.
 *
 * Pure data: the fill-mode and gradient-type value lists (value + i18n key, no
 * localised label), the pattern-preset subset shown in the picker, and the
 * shared Tailwind class-token strings the React panel reused from InspectorPane.
 * Ported from the React viewer's
 * `inspector/table-cell-advanced-fill-constants.ts` so React, Vue, and Angular
 * consume one copy. No framework imports.
 */
import type { PptxTableCellStyle } from 'pptx-viewer-core';

import { OOXML_PATTERN_PRESETS } from './fill-style';

// ---------------------------------------------------------------------------
// Shared class tokens (match InspectorPane)
// ---------------------------------------------------------------------------

export const SEL = 'bg-muted border border-border rounded px-2 py-1 text-[11px] w-full';
export const NUM = 'flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full text-[11px]';
export const LBL = 'text-muted-foreground text-[11px]';
export const SECTION_HEADING = 'text-[11px] uppercase tracking-wide text-muted-foreground';

// ---------------------------------------------------------------------------
// Fill mode options
// ---------------------------------------------------------------------------

export const FILL_MODE_OPTIONS: Array<{
	value: PptxTableCellStyle['fillMode'];
	i18nKey: string;
}> = [
	{ value: 'solid', i18nKey: 'pptx.table.fillSolid' },
	{ value: 'gradient', i18nKey: 'pptx.table.fillGradient' },
	{ value: 'pattern', i18nKey: 'pptx.table.fillPattern' },
	{ value: 'none', i18nKey: 'pptx.table.fillNone' },
];

export const GRADIENT_TYPE_OPTIONS: Array<{ value: string; i18nKey: string }> = [
	{ value: 'linear', i18nKey: 'pptx.table.gradientLinear' },
	{ value: 'radial', i18nKey: 'pptx.table.gradientRadial' },
];

// Subset of common patterns shown in the cell-fill pattern picker.
export const PATTERN_OPTIONS = OOXML_PATTERN_PRESETS.slice(0, 20);
