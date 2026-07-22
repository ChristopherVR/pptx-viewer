/**
 * Per-paragraph spacing resolution for the React text renderer.
 *
 * OOXML stores line spacing (`a:lnSpc`), space-before (`a:spcBef`) and
 * space-after (`a:spcAft`) as paragraph-level properties. They must be applied
 * to each paragraph individually rather than collapsed into a single body-level
 * padding, otherwise every paragraph in a multi-paragraph text body shares one
 * top/bottom gap and the intended rhythm is lost.
 *
 * `paragraphSpacingBefore` / `paragraphSpacingAfter` arrive already converted to
 * px by the core parser. `lineSpacing` is a unitless multiplier (1.2 = 120%);
 * `lineSpacingExactPt` is an absolute measure in points.
 *
 * Pure and framework-agnostic in spirit, but kept in the React binding because
 * it is only consumed by the React paragraph renderer.
 */
import type { TextStyle } from 'pptx-viewer-core';

const PT_TO_PX = 96 / 72;

export interface ParagraphSpacingInput {
	/** This paragraph's own `a:pPr` geometry (from the first segment). */
	paraProps: TextStyle | undefined;
	/** Element/body-level style, used as an inheritance fallback. */
	bodyStyle: TextStyle | undefined;
	/** True for the first paragraph in the body. */
	isFirst: boolean;
	/** True for the last paragraph in the body. */
	isLast: boolean;
	/**
	 * `a:bodyPr/@spcFirstLastPara`. When explicitly `false`, the before-spacing
	 * of the first paragraph and the after-spacing of the last paragraph are
	 * suppressed (they would otherwise fight the body anchor). Defaults to
	 * applying spacing (no suppression) when undefined, matching prior behaviour.
	 */
	spaceFirstLast: boolean;
}

export interface ParagraphSpacingResult {
	marginTop?: number;
	marginBottom?: number;
	lineHeight?: number | string;
}

/**
 * Resolve a paragraph's CSS margins and line-height from its own properties,
 * falling back to the body-level style for inherited/single-level text.
 */
export function resolveParagraphSpacing(input: ParagraphSpacingInput): ParagraphSpacingResult {
	const { paraProps, bodyStyle, isFirst, isLast, spaceFirstLast } = input;
	const result: ParagraphSpacingResult = {};

	const before = paraProps?.paragraphSpacingBefore ?? bodyStyle?.paragraphSpacingBefore;
	if (typeof before === 'number' && before > 0 && (!isFirst || spaceFirstLast)) {
		result.marginTop = before;
	}

	const after = paraProps?.paragraphSpacingAfter ?? bodyStyle?.paragraphSpacingAfter;
	if (typeof after === 'number' && after > 0 && (!isLast || spaceFirstLast)) {
		result.marginBottom = after;
	}

	// Line spacing: prefer the paragraph's own value as a unit (do not mix an
	// exact-pt from the body with a multiplier from the paragraph).
	const hasOwnLine =
		paraProps?.lineSpacing !== undefined || paraProps?.lineSpacingExactPt !== undefined;
	const lineSrc = hasOwnLine ? paraProps : bodyStyle;
	const exactPt = lineSrc?.lineSpacingExactPt;
	const multiplier = lineSrc?.lineSpacing;
	if (typeof exactPt === 'number' && exactPt > 0) {
		result.lineHeight = `${exactPt * PT_TO_PX}px`;
	} else if (typeof multiplier === 'number' && multiplier > 0) {
		result.lineHeight = multiplier;
	}

	return result;
}
