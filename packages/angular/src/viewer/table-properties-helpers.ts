/**
 * table-properties-helpers.ts: pure helpers for the table properties inspector.
 *
 * The small immutable transforms behind the Angular port of the React
 * `TablePropertiesPanel` / `TableCellAdvancedFill`: building a CSS gradient
 * string from structured stops so the renderer shows edited gradients live.
 * Table quick-style preset application (`applyTableStylePreset`) and
 * column-width redistribution / "distribute evenly" one-liners live in
 * `pptx-viewer-shared`'s `render/table-style-presets.ts` and
 * `render/table-resize.ts` (imported from `../internal/shared`) so every
 * binding shares one copy of that logic.
 *
 * No Angular imports, so they are unit-testable with plain vitest.
 */
/* oxlint-disable eslint/one-var -- independent, unrelated locals across these
   helpers; merging them into one statement would hurt readability. */
import { ooxmlGradientAngleToCssDegrees } from 'pptx-viewer-core';

import { PATTERN_OPTIONS } from '../internal/shared';

/** Default row height (px) used when a row has no explicit height. */
export const DEFAULT_TABLE_ROW_HEIGHT = 32;

/** The boolean structure/style flags on `PptxTableData` the toggles can flip. */
export type TableBooleanFlag =
	| 'bandedRows'
	| 'firstRowHeader'
	| 'bandedColumns'
	| 'firstCol'
	| 'lastCol'
	| 'lastRow';

/** The structure / style toggle flags shown as checkboxes, with i18n dictionary keys. */
export const TABLE_STRUCTURE_TOGGLES: ReadonlyArray<{
	key: TableBooleanFlag;
	labelKey: string;
}> = [
	{ key: 'bandedRows', labelKey: 'pptx.table.bandedRows' },
	{ key: 'firstRowHeader', labelKey: 'pptx.table.headerRow' },
	{ key: 'bandedColumns', labelKey: 'pptx.table.bandedColumns' },
	{ key: 'firstCol', labelKey: 'pptx.table.firstColumn' },
	{ key: 'lastCol', labelKey: 'pptx.table.lastColumn' },
	{ key: 'lastRow', labelKey: 'pptx.table.lastRow' },
];

/**
 * Build a CSS gradient string from structured cell-style gradient fields, so
 * the renderer (which reads `gradientFillCss`) shows an edited gradient live.
 *
 * `angle` is `PptxTableCellStyle.gradientFillAngle`, stored in the OOXML
 * `a:lin/@ang` convention (clockwise from +x) so it round-trips to the file
 * unchanged; CSS measures clockwise from "to top", a quarter turn away.
 */
export function buildGradientFillCss(
	stops: Array<{ color: string; position: number }>,
	type: 'linear' | 'radial',
	angle: number,
): string {
	const ordered = [...stops].sort((a, b) => a.position - b.position);
	const parts = ordered.map((s) => `${s.color} ${Math.round(s.position)}%`).join(', ');
	if (type === 'radial') {
		return `radial-gradient(circle, ${parts})`;
	}
	return `linear-gradient(${Math.round(ooxmlGradientAngleToCssDegrees(angle))}deg, ${parts})`;
}

// ── Pattern fill presets ─────────────────────────────────────────────────────

/**
 * Preset a pattern fill falls back to when the cell carries none.
 *
 * Matches the reference binding, and the value the panel seeds when the fill
 * mode is switched to "pattern".
 */
export const DEFAULT_PATTERN_FILL_PRESET = 'ltDnDiag';

/**
 * The presets the pattern picker offers for a cell currently set to `current`.
 *
 * WHY this is not just `PATTERN_OPTIONS`: that list is the first 20 of the 56
 * OOXML presets, and the fallback preset (`ltDnDiag`, index 27) is not among
 * them. A cell carrying any preset outside the slice therefore rendered a
 * `<select>` whose value matched no `<option>`, so the browser displayed the
 * first entry instead and the very next interaction silently rewrote a fill the
 * user never touched. Appending the current preset when it is off-list keeps it
 * representable without changing the catalogue the picker offers.
 */
export function patternPresetOptions(current: string | undefined): readonly string[] {
	const preset = current ?? DEFAULT_PATTERN_FILL_PRESET;
	const offered = PATTERN_OPTIONS as readonly string[];
	return offered.includes(preset) ? offered : [...offered, preset];
}
