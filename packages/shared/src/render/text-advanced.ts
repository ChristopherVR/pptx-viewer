/**
 * Pure (framework-agnostic) helpers for the advanced text panel.
 *
 * Readers extract advanced text values from a PptxElement (with sensible
 * defaults); patch-builders produce shallow-merge-ready `Partial<PptxElement>`
 * objects for each binding's element-update path.
 *
 * Covers character spacing, line spacing, paragraph alignment + spacing,
 * indent, text direction, and vertical anchor. Each binding renders the
 * value/label option lists into its own template / JSX.
 */

import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

/**
 * The advanced text properties surfaced to the panel.
 *
 * Covers: character spacing, line spacing, paragraph alignment + spacing,
 * indent, text direction, and vertical anchor.
 */
export interface TextAdvancedState {
	/** Character spacing in hundredths of a point (0 = normal). */
	characterSpacing: number;
	/** Line spacing multiplier (1.0 = single). */
	lineSpacing: number;
	/** Exact line spacing in points, or null when using multiplier mode. */
	lineSpacingExactPt: number | null;
	/** Paragraph spacing before in px. */
	paragraphSpacingBefore: number;
	/** Paragraph spacing after in px. */
	paragraphSpacingAfter: number;
	/** Paragraph text alignment. */
	align: NonNullable<TextStyle['align']>;
	/** Vertical anchor within the text body. */
	vAlign: NonNullable<TextStyle['vAlign']>;
	/** Paragraph first-line indent in px. */
	paragraphIndent: number;
	/** Paragraph left margin in px. */
	paragraphMarginLeft: number;
	/** Body text direction. */
	textDirection: NonNullable<TextStyle['textDirection']>;
	/** Right-to-left paragraph/run direction. */
	rtl: boolean;
}

/** Available text direction options (value/label pairs). */
export const TEXT_DIRECTION_OPTIONS: Array<[NonNullable<TextStyle['textDirection']>, string]> = [
	['horizontal', 'Horizontal'],
	['vertical', 'Vertical'],
	['vertical270', 'Vertical 270'],
	['eaVert', 'East Asian Vertical'],
	['wordArtVert', 'WordArt Vertical'],
	['wordArtVertRtl', 'WordArt Vertical RTL'],
	['mongolianVert', 'Mongolian Vertical'],
];

/** Available paragraph alignment options. */
export const ALIGN_OPTIONS: Array<[NonNullable<TextStyle['align']>, string]> = [
	['left', 'Left'],
	['center', 'Center'],
	['right', 'Right'],
	['justify', 'Justify'],
	['justLow', 'Justify Low'],
	['dist', 'Distributed'],
	['thaiDist', 'Thai Distributed'],
];

/** Available vertical anchor options. */
export const VALIGN_OPTIONS: Array<[NonNullable<TextStyle['vAlign']>, string]> = [
	['top', 'Top'],
	['middle', 'Middle'],
	['bottom', 'Bottom'],
];

/**
 * Extract the TextAdvancedState from a PptxElement.
 * Returns sensible defaults when the element carries no text properties.
 */
export function textAdvancedStateOf(el: PptxElement): TextAdvancedState {
	if (!hasTextProperties(el)) {
		return defaultTextAdvancedState();
	}
	return textAdvancedStateFromStyle(el.textStyle);
}

/**
 * Extract TextAdvancedState from a raw TextStyle, without needing the element.
 */
export function textAdvancedStateFromStyle(ts: TextStyle | undefined): TextAdvancedState {
	return {
		characterSpacing: typeof ts?.characterSpacing === 'number' ? ts.characterSpacing : 0,
		lineSpacing: typeof ts?.lineSpacing === 'number' ? ts.lineSpacing : 1.0,
		lineSpacingExactPt: typeof ts?.lineSpacingExactPt === 'number' ? ts.lineSpacingExactPt : null,
		paragraphSpacingBefore:
			typeof ts?.paragraphSpacingBefore === 'number' ? ts.paragraphSpacingBefore : 0,
		paragraphSpacingAfter:
			typeof ts?.paragraphSpacingAfter === 'number' ? ts.paragraphSpacingAfter : 0,
		align: ts?.align ?? 'left',
		vAlign: ts?.vAlign ?? 'top',
		paragraphIndent: typeof ts?.paragraphIndent === 'number' ? ts.paragraphIndent : 0,
		paragraphMarginLeft: typeof ts?.paragraphMarginLeft === 'number' ? ts.paragraphMarginLeft : 0,
		textDirection: ts?.textDirection ?? 'horizontal',
		rtl: ts?.rtl ?? false,
	};
}

/**
 * Changes to apply to textStyle from the advanced panel.
 * Every key maps 1-to-1 to TextStyle fields.
 */
export type TextAdvancedChanges = Partial<
	Pick<
		TextStyle,
		| 'characterSpacing'
		| 'lineSpacing'
		| 'lineSpacingExactPt'
		| 'paragraphSpacingBefore'
		| 'paragraphSpacingAfter'
		| 'align'
		| 'vAlign'
		| 'paragraphIndent'
		| 'paragraphMarginLeft'
		| 'textDirection'
		| 'rtl'
	>
>;

/**
 * Build a Partial<PptxElement> that merges the given TextAdvancedChanges into
 * the element's existing textStyle without dropping any other textStyle fields.
 *
 * Safe to pass directly to each binding's element-update path.
 */
export function textAdvancedPatch(
	el: PptxElement,
	changes: TextAdvancedChanges,
): Partial<PptxElement> {
	const base: TextStyle = hasTextProperties(el) ? (el.textStyle ?? {}) : {};
	return {
		textStyle: {
			...base,
			...changes,
		},
	} as Partial<PptxElement>;
}

/**
 * Patch to update character spacing only.
 * `spacing` is in hundredths of a point (e.g. 100 = 1pt).
 */
export function characterSpacingPatch(el: PptxElement, spacing: number): Partial<PptxElement> {
	return textAdvancedPatch(el, { characterSpacing: spacing });
}

/**
 * Patch to update line spacing.
 * When `exactPt` is provided (non-null), sets `lineSpacingExactPt` and clears
 * the multiplier field. When null, sets the multiplier and clears exact-pt.
 */
export function lineSpacingPatch(
	el: PptxElement,
	multiplier: number,
	exactPt: number | null,
): Partial<PptxElement> {
	if (exactPt !== null) {
		return textAdvancedPatch(el, {
			lineSpacingExactPt: exactPt,
			lineSpacing: undefined,
		});
	}
	return textAdvancedPatch(el, {
		lineSpacing: multiplier,
		lineSpacingExactPt: undefined,
	});
}

/**
 * Patch to update paragraph alignment.
 */
export function alignPatch(
	el: PptxElement,
	align: TextAdvancedState['align'],
): Partial<PptxElement> {
	return textAdvancedPatch(el, { align });
}

/**
 * Patch to update vertical anchor.
 */
export function vAlignPatch(
	el: PptxElement,
	vAlign: TextAdvancedState['vAlign'],
): Partial<PptxElement> {
	return textAdvancedPatch(el, { vAlign });
}

/**
 * Patch to update text direction.
 */
export function textDirectionPatch(
	el: PptxElement,
	textDirection: TextAdvancedState['textDirection'],
): Partial<PptxElement> {
	return textAdvancedPatch(el, { textDirection });
}

function defaultTextAdvancedState(): TextAdvancedState {
	return {
		characterSpacing: 0,
		lineSpacing: 1.0,
		lineSpacingExactPt: null,
		paragraphSpacingBefore: 0,
		paragraphSpacingAfter: 0,
		align: 'left',
		vAlign: 'top',
		paragraphIndent: 0,
		paragraphMarginLeft: 0,
		textDirection: 'horizontal',
		rtl: false,
	};
}

// ==========================================================================
// Text wrap + autofit mode (standalone; not part of TextAdvancedState so
// existing consumers of that interface are unaffected by this addition).
// ==========================================================================

/** Available text-wrap options (`a:bodyPr/@wrap`). */
export const TEXT_WRAP_OPTIONS: Array<[NonNullable<TextStyle['textWrap']>, string]> = [
	['square', 'Wrap text in shape'],
	['none', "Don't wrap text"],
];

/**
 * Available autofit-mode options. Per this codebase's {@link TextStyle.autoFitMode}
 * mapping: `'shrink'` is `a:spAutoFit` (resize the shape to fit the text) and
 * `'normal'` is `a:normAutofit` (shrink the text on overflow).
 */
export const AUTOFIT_MODE_OPTIONS: Array<[NonNullable<TextStyle['autoFitMode']>, string]> = [
	['none', 'Do not autofit'],
	['normal', 'Shrink text on overflow'],
	['shrink', 'Resize shape to fit text'],
];

/** Read the effective text-wrap mode, defaulting to `'square'` (wrap on). */
export function textWrapOf(el: PptxElement): NonNullable<TextStyle['textWrap']> {
	if (!hasTextProperties(el)) {
		return 'square';
	}
	return el.textStyle?.textWrap ?? 'square';
}

/** Read the effective autofit mode, defaulting to `'none'`. */
export function autoFitModeOf(el: PptxElement): NonNullable<TextStyle['autoFitMode']> {
	if (!hasTextProperties(el)) {
		return 'none';
	}
	return el.textStyle?.autoFitMode ?? 'none';
}

/** Patch to update the text-wrap mode, preserving the rest of `textStyle`. */
export function textWrapPatch(
	el: PptxElement,
	wrap: NonNullable<TextStyle['textWrap']>,
): Partial<PptxElement> {
	const base: TextStyle = hasTextProperties(el) ? (el.textStyle ?? {}) : {};
	return { textStyle: { ...base, textWrap: wrap } } as Partial<PptxElement>;
}

/** Patch to update the autofit mode, preserving the rest of `textStyle`. */
export function autoFitModePatch(
	el: PptxElement,
	mode: NonNullable<TextStyle['autoFitMode']>,
): Partial<PptxElement> {
	const base: TextStyle = hasTextProperties(el) ? (el.textStyle ?? {}) : {};
	return {
		textStyle: { ...base, autoFitMode: mode, autoFit: mode !== 'none' },
	} as Partial<PptxElement>;
}
