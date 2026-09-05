/**
 * Pure decision helpers a colour-picker UI uses on top of the theme swatch
 * grid ({@link buildThemeColorSwatchGrid}): which swatch (if any) matches the
 * element's current colour, and what a click / a custom pick should write
 * back to the model.
 *
 * Every binding (React, Vue, Angular, Svelte, Vanilla) shares this module so
 * "click a theme swatch" and "type a custom hex" behave identically
 * everywhere: a theme swatch commits both the resolved hex (so rendering
 * keeps working even where the ref cannot be resolved) and the
 * {@link PptxThemeColorRef} (so the colour survives a later theme swap); a
 * custom hex or a recent-colour pick always clears the ref, since a plain
 * sRGB value has no theme identity for PowerPoint to reapply.
 *
 * @module render/theme-color-picker-state
 */
import type { PptxThemeColorRef } from 'pptx-viewer-core';

import type { ThemeColorSwatch, ThemeColorSwatchColumn } from './theme-color-swatches';

/** What a picker should write back to the model on a commit. */
export interface ThemeColorPickerCommit {
	/** Resolved `#rrggbb`, always set so rendering keeps working. */
	readonly hex: string;
	/** The theme ref to store, or `undefined` to clear a previously-stored ref. */
	readonly ref: PptxThemeColorRef | undefined;
}

/** Whether two refs describe the same `<a:schemeClr>` (same scheme + transforms). */
export function themeColorRefsEqual(
	a: PptxThemeColorRef | undefined,
	b: PptxThemeColorRef | undefined,
): boolean {
	if (!a || !b) {
		return a === b;
	}
	return (
		a.scheme === b.scheme &&
		a.lumMod === b.lumMod &&
		a.lumOff === b.lumOff &&
		a.tint === b.tint &&
		a.shade === b.shade
	);
}

/**
 * Find the swatch (base or variant, in any column) that matches the
 * element's current colour, so the picker can highlight it.
 *
 * Prefers matching by `ref` (exact scheme + transform match) when the
 * element carries one; falls back to matching by resolved hex (case
 * insensitive) so a deck whose colour was never stored as a ref, but
 * happens to equal a theme swatch's resolved value, still highlights.
 */
export function findSelectedThemeSwatch(
	columns: readonly ThemeColorSwatchColumn[],
	ref: PptxThemeColorRef | undefined,
	hex: string | undefined,
): ThemeColorSwatch | undefined {
	if (ref) {
		for (const column of columns) {
			const swatches: readonly ThemeColorSwatch[] = [column.base, ...column.variants];
			const match = swatches.find((swatch) => themeColorRefsEqual(swatch.ref, ref));
			if (match) {
				return match;
			}
		}
		return undefined;
	}
	if (!hex) {
		return undefined;
	}
	const normalized = hex.trim().toLowerCase();
	for (const column of columns) {
		const swatches: readonly ThemeColorSwatch[] = [column.base, ...column.variants];
		const match = swatches.find((swatch) => swatch.hex.toLowerCase() === normalized);
		if (match) {
			return match;
		}
	}
	return undefined;
}

/** Clicking a theme swatch commits both its resolved hex and its ref. */
export function themeSwatchCommit(swatch: ThemeColorSwatch): ThemeColorPickerCommit {
	return { hex: swatch.hex, ref: swatch.ref };
}

/**
 * Typing a custom hex, using the native eyedropper, or picking a recent
 * colour always clears the ref: none of those carry a theme identity.
 */
export function customColorCommit(hex: string): ThemeColorPickerCommit {
	return { hex, ref: undefined };
}

/**
 * Lay the columns out as PowerPoint does: one row of base colours, then one
 * row per luminance variant index (so column `i`'s "Lighter 80%" sits under
 * column `i`'s base, matching the picker grid's visual columns). A column
 * with fewer variants than the row index leaves that cell `undefined`.
 */
export function themeColorSwatchRows(
	columns: readonly ThemeColorSwatchColumn[],
): readonly (readonly (ThemeColorSwatch | undefined)[])[] {
	if (columns.length === 0) {
		return [];
	}
	const variantRowCount = Math.max(...columns.map((column) => column.variants.length));
	const rows: (ThemeColorSwatch | undefined)[][] = [columns.map((column) => column.base)];
	for (let i = 0; i < variantRowCount; i++) {
		rows.push(columns.map((column) => column.variants[i]));
	}
	return rows;
}
