/**
 * Per-paragraph BiDi direction + text-alignment resolution, shared by every
 * binding's paragraph renderer.
 *
 * Pure, framework-agnostic. `resolveParagraphRtl` / `resolveParagraphAlign`
 * walk a paragraph's segment entries to find the first explicit
 * direction/alignment, falling back to the element-level default.
 * `resolveCssTextAlign` maps an OOXML alignment + RTL flag to a neutral CSS
 * `text-align` keyword (each binding casts it into its own style type).
 */
import type { TextStyle } from 'pptx-viewer-core';

/** Minimal paragraph-entry shape the resolvers read (`segment.style`). */
export interface ParagraphStyleEntry {
	segment: {
		style?: Pick<TextStyle, 'rtl' | 'align'>;
	};
}

/** CSS `text-align` keyword values produced by {@link resolveCssTextAlign}. */
export type CssTextAlign = 'left' | 'right' | 'center' | 'justify' | 'start' | 'end';

/**
 * Resolve per-paragraph RTL direction from segment styles.
 *
 * Returns `true` for RTL, `false` for explicit LTR, or `undefined` when no
 * segment carries an explicit direction (inherits the element-level default).
 */
export function resolveParagraphRtl(
	paraSegments: ReadonlyArray<ParagraphStyleEntry>,
	elementRtl: boolean | undefined,
): boolean | undefined {
	for (const entry of paraSegments) {
		const segRtl = entry.segment.style?.rtl;
		if (segRtl !== undefined) {
			return segRtl;
		}
	}
	return elementRtl;
}

/**
 * Resolve per-paragraph explicit text alignment from segment styles.
 *
 * Returns the OOXML alignment value if any segment carries an explicit `align`
 * property, or `undefined` when none does.
 */
export function resolveParagraphAlign(
	paraSegments: ReadonlyArray<ParagraphStyleEntry>,
	elementAlign: TextStyle['align'] | undefined,
): TextStyle['align'] | undefined {
	for (const entry of paraSegments) {
		const segAlign = entry.segment.style?.align;
		if (segAlign !== undefined) {
			return segAlign;
		}
	}
	return elementAlign;
}

/**
 * Map an OOXML alignment + RTL direction to a CSS `text-align` value.
 *
 * When no explicit alignment is set and the paragraph is RTL, returns
 * `"right"`. The special OOXML values `justLow` / `dist` / `thaiDist` all map
 * to CSS `"justify"`. Returns `undefined` for an unset alignment in LTR (the
 * caller leaves `text-align` to inherit the default).
 */
export function resolveCssTextAlign(
	align: TextStyle['align'] | undefined,
	isRtl: boolean,
): CssTextAlign | undefined {
	if (align === 'justLow' || align === 'dist' || align === 'thaiDist') {
		return 'justify';
	}
	if (align) {
		return align as CssTextAlign;
	}
	// Default: RTL paragraphs align right, LTR paragraphs inherit (undefined).
	return isRtl ? 'right' : undefined;
}
