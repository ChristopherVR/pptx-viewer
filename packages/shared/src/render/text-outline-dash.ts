/**
 * Dashed text outline (`a:rPr > a:ln > a:prstDash`) as CSS.
 *
 * `-webkit-text-stroke` can only paint a solid stroke, so a dashed outline
 * (COM-verified: `audit-text` slide 13's "DASH OUTLINE" run, which PowerPoint
 * draws as broken black dashes around a yellow fill) used to render solid.
 * The stroke is instead made transparent and a repeating diagonal stripe of
 * the outline colour is painted underneath it, clipped to the glyphs with
 * `background-clip: text`. Only the stroke band shows the stripes (the fill
 * is painted over the rest via `-webkit-text-fill-color`), so the outline
 * reads as a run of dashes whose lengths follow the preset's ECMA-376 dash
 * pattern in multiples of the line width. The stripes run diagonally, so
 * horizontal and vertical strokes both break up, which is the closest a
 * box-level paint can get to dashes that follow each glyph contour.
 *
 * Pure and framework-agnostic: returns a neutral CSS record, merged by
 * `text-run-style.ts` for every binding.
 *
 * @module text-outline-dash
 */

import type { TextStyle } from 'pptx-viewer-core';

import { normalizeHexColor } from './fill-style';

/** `ST_PresetLineDashVal` -> alternating dash/gap lengths, in multiples of the line width. */
const DASH_PATTERNS: Record<string, ReadonlyArray<number>> = {
	dot: [1, 3],
	sysDot: [1, 1],
	dash: [4, 3],
	sysDash: [3, 1],
	lgDash: [8, 3],
	dashDot: [4, 3, 1, 3],
	sysDashDot: [3, 1, 1, 1],
	lgDashDot: [8, 3, 1, 3],
	lgDashDotDot: [8, 3, 1, 3, 1, 3],
	sysDashDotDot: [3, 1, 1, 1, 1, 1],
};

/** The CSS a dashed text outline merges onto its run. */
export interface TextOutlineDashCss {
	WebkitTextStroke: string;
	WebkitTextFillColor: string;
	background: string;
	backgroundClip: string;
	WebkitBackgroundClip: string;
}

/** Build the `repeating-linear-gradient` stripe for a dash pattern. */
function dashStripe(pattern: ReadonlyArray<number>, widthPx: number, color: string): string {
	const stops: string[] = [];
	let at = 0;
	pattern.forEach((len, i) => {
		const end = at + len * widthPx;
		const paint = i % 2 === 0 ? color : 'transparent';
		stops.push(`${paint} ${round(at)}px ${round(end)}px`);
		at = end;
	});
	return `repeating-linear-gradient(45deg, ${stops.join(', ')})`;
}

function round(v: number): number {
	return Math.round(v * 100) / 100;
}

/**
 * Resolve a run's dashed outline to CSS, or `undefined` when the run has no
 * outline, a solid/unknown dash, or already owns the `background` for a
 * gradient, pattern or picture text fill (or a highlight) that the stripes
 * would clobber; such runs keep the plain solid stroke.
 *
 * @param s         The run style.
 * @param fillColor The colour the run's glyphs are filled with.
 */
export function resolveTextOutlineDashCss(
	s: Pick<
		TextStyle,
		| 'textOutlineWidth'
		| 'textOutlineColor'
		| 'textOutlineDash'
		| 'textFillGradient'
		| 'textFillPattern'
		| 'textFillBlipUrl'
		| 'highlightColor'
		| 'textFillNone'
	>,
	fillColor: string | undefined,
): TextOutlineDashCss | undefined {
	const width = s.textOutlineWidth;
	const pattern = s.textOutlineDash ? DASH_PATTERNS[s.textOutlineDash] : undefined;
	if (!width || width <= 0 || !pattern) {
		return undefined;
	}
	if (s.textFillGradient || s.textFillPattern || s.textFillBlipUrl || s.highlightColor) {
		return undefined;
	}
	const strokeColor = normalizeHexColor(s.textOutlineColor, fillColor ?? '#000000');
	return {
		WebkitTextStroke: `${width}px transparent`,
		WebkitTextFillColor: s.textFillNone ? 'transparent' : (fillColor ?? 'currentColor'),
		background: dashStripe(pattern, width, strokeColor),
		backgroundClip: 'text',
		WebkitBackgroundClip: 'text',
	};
}
