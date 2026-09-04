/**
 * OOXML underline / strikethrough -> CSS text-decoration resolution, shared by
 * every binding's text renderer.
 *
 * Pure, framework-agnostic: returns a neutral record of CSS text-decoration
 * properties (literal-union `textDecorationStyle` plus `px` strings). Each
 * binding casts it into its own style type at the call site.
 */

import type { TextStyle } from 'pptx-viewer-core';

/** CSS `text-decoration-style` keyword values. */
export type CssTextDecorationStyle = 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy';

/** EMU per CSS px, matching every other length conversion in this package. */
const EMU_PER_PX = 9525;

/** `a:uLn/a:prstDash/@val` -> the closest CSS `text-decoration-style` keyword. */
const UNDERLINE_DASH_TO_CSS: Record<string, CssTextDecorationStyle> = {
	solid: 'solid',
	dot: 'dotted',
	sysDot: 'dotted',
	dash: 'dashed',
	sysDash: 'dashed',
	lgDash: 'dashed',
	dashDot: 'dashed',
	sysDashDot: 'dashed',
	lgDashDot: 'dashed',
	dashDotDot: 'dotted',
	sysDashDotDot: 'dotted',
	lgDashDotDot: 'dotted',
};

/**
 * CSS properties that fully describe the visual appearance of an underline or
 * strikethrough decoration. Returned by {@link resolveUnderlineDecorationStyle}.
 */
export interface UnderlineDecorationCss {
	textDecorationStyle?: CssTextDecorationStyle;
	textDecorationThickness?: string;
	textUnderlineOffset?: string;
}

/**
 * Resolve an OOXML underline / strikethrough style to a set of CSS
 * text-decoration properties that make all 16 underline types visually
 * distinct.
 *
 * CSS `text-decoration-style` only has 5 variants (solid, double, dotted,
 * dashed, wavy), so we use `text-decoration-thickness` to differentiate heavy
 * variants and `text-underline-offset` for additional visual separation where
 * compound patterns (dotDash, dotDotDash, dashLong) share the same CSS base
 * style.
 *
 * @param isDoubleStrike Whether a double-strikethrough is requested (wins over
 *                       the underline style).
 * @param underlineStyle The OOXML underline-style token (e.g. `"sng"`,
 *                       `"wavyHeavy"`), or `undefined` / `"none"`.
 */
export function resolveUnderlineDecorationStyle(
	isDoubleStrike: boolean,
	underlineStyle?: string,
): UnderlineDecorationCss | undefined {
	if (isDoubleStrike) {
		return { textDecorationStyle: 'double' };
	}
	if (!underlineStyle || underlineStyle === 'none') {
		return undefined;
	}

	switch (underlineStyle) {
		// Single / default
		case 'sng':
			return { textDecorationStyle: 'solid', textDecorationThickness: '1px' };

		// D2-G3: `words` underlines only the non-whitespace characters, leaving
		// inter-word spaces unmarked (ST_TextUnderlineType, ECMA-376 §20.1.10.64),
		// distinct from `sng`'s continuous line. A single `text-decoration` on
		// the whole run cannot skip spaces (CSS's `text-decoration-skip: spaces`
		// never shipped in Chromium, the app's target runtime - see the
		// `hanging-punctuation` precedent in `kinsoku-styles.ts`), so this falls
		// back to the same continuous solid underline as `sng` rather than
		// silently drawing nothing (the previous `default: undefined` behaviour).
		// A binding wanting the true per-word gap needs to split the run into
		// per-word pieces before applying this decoration - see
		// {@link splitWordsForUnderline}.
		case 'words':
			return { textDecorationStyle: 'solid', textDecorationThickness: '1px' };

		// Double
		case 'dbl':
			return { textDecorationStyle: 'double', textDecorationThickness: '1px' };

		// Heavy (thick solid)
		case 'heavy':
			return { textDecorationStyle: 'solid', textDecorationThickness: '3px' };

		// Dotted
		case 'dotted':
			return { textDecorationStyle: 'dotted', textDecorationThickness: '1px' };
		case 'dottedHeavy':
			return { textDecorationStyle: 'dotted', textDecorationThickness: '3px' };

		// Dashed
		case 'dash':
			return { textDecorationStyle: 'dashed', textDecorationThickness: '1px' };
		case 'dashHeavy':
			return { textDecorationStyle: 'dashed', textDecorationThickness: '3px' };

		// Long dashed (offset to distinguish from regular dash)
		case 'dashLong':
			return {
				textDecorationStyle: 'dashed',
				textDecorationThickness: '1px',
				textUnderlineOffset: '3px',
			};
		case 'dashLongHeavy':
			return {
				textDecorationStyle: 'dashed',
				textDecorationThickness: '3px',
				textUnderlineOffset: '3px',
			};

		// Dot-dash (CSS closest: dashed with offset)
		case 'dotDash':
			return {
				textDecorationStyle: 'dashed',
				textDecorationThickness: '1px',
				textUnderlineOffset: '2px',
			};
		case 'dotDashHeavy':
			return {
				textDecorationStyle: 'dashed',
				textDecorationThickness: '3px',
				textUnderlineOffset: '2px',
			};

		// Dot-dot-dash (CSS closest: dotted with offset)
		case 'dotDotDash':
			return {
				textDecorationStyle: 'dotted',
				textDecorationThickness: '1px',
				textUnderlineOffset: '3px',
			};
		case 'dotDotDashHeavy':
			return {
				textDecorationStyle: 'dotted',
				textDecorationThickness: '3px',
				textUnderlineOffset: '3px',
			};

		// Wavy
		case 'wavy':
			return { textDecorationStyle: 'wavy', textDecorationThickness: '1px' };
		case 'wavyHeavy':
			return { textDecorationStyle: 'wavy', textDecorationThickness: '3px' };

		// Wavy double (wavy + thicker as closest CSS approximation)
		case 'wavyDbl':
			return {
				textDecorationStyle: 'wavy',
				textDecorationThickness: '2px',
				textUnderlineOffset: '1px',
			};

		default:
			return undefined;
	}
}

/**
 * Resolve a run's own `<a:rPr><a:uLn>` (underline line properties: width,
 * compound type, dash pattern, caps) to the CSS that overrides the plain
 * `a:u`-style decoration {@link resolveUnderlineDecorationStyle} produces.
 *
 * `a:uLn` is a distinct, independent line description from `a:u`'s style
 * token - a run can author both (`u="sng"` for the underline TYPE plus a
 * custom-width dashed `uLn` for its STROKE), and the line's own width/dash
 * take priority over whatever the type token implied, exactly as `a:ln`
 * overrides a shape outline's default weight. Previously only the line's
 * colour (`a:uLn/a:solidFill`, via `underlineColor`) was ever rendered; the
 * width and dash preset parsed into {@link TextStyle.underlineLine} were
 * captured for round-trip but never reached the screen.
 *
 * @param underlineLine The run's parsed `a:uLn`, or `undefined`.
 * @param hasUnderline  Whether the run actually renders an underline at all
 *                       (`a:u` present and not `"none"`); a `uLn` on a run
 *                       with no underline has nothing to decorate.
 * @returns The thickness/style override, or `undefined` when the run has no
 *          underline or its `uLn` authors neither a width nor a known dash.
 */
export function resolveUnderlineLineDecoration(
	underlineLine: TextStyle['underlineLine'] | undefined,
	hasUnderline: boolean,
): UnderlineDecorationCss | undefined {
	if (!hasUnderline || !underlineLine) {
		return undefined;
	}
	const out: UnderlineDecorationCss = {};
	if (typeof underlineLine.widthEmu === 'number' && underlineLine.widthEmu > 0) {
		const px = Math.max(1, Math.round(underlineLine.widthEmu / EMU_PER_PX));
		out.textDecorationThickness = `${px}px`;
	}
	if (underlineLine.prstDash) {
		const css = UNDERLINE_DASH_TO_CSS[underlineLine.prstDash];
		if (css) {
			out.textDecorationStyle = css;
		}
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

/** One word-or-whitespace piece of a run's text, for `u="words"` rendering. */
export interface UnderlineWordPiece {
	text: string;
	/** Whether this piece should carry the underline decoration. */
	underline: boolean;
}

/**
 * Split `text` into alternating word / whitespace pieces so a binding can
 * render `a:rPr/@u="words"` (D2-G3) as true per-word underlines with a gap
 * under the spaces between them, by wrapping each `underline: true` piece in
 * its own `<span>` and leaving whitespace pieces undecorated.
 *
 * Not wired into any binding's run renderer yet (that lives in each binding's
 * per-run render path / `paragraph-run-build.ts`, outside this module's
 * scope): {@link resolveUnderlineDecorationStyle}'s `'words'` case is the
 * currently-active fallback (a single continuous underline). This helper
 * exists so that wiring is a matter of calling it and mapping the result to
 * spans, not inventing the split logic per binding.
 *
 * @param text Run text to split. Whitespace here means ASCII/Unicode spaces
 *             and tabs; a run already split into `tabLines` should call this
 *             per tab-stop segment, not on the raw unsplit text.
 */
export function splitWordsForUnderline(text: string): UnderlineWordPiece[] {
	if (!text) {
		return [];
	}
	const pieces: UnderlineWordPiece[] = [];
	// Alternates between "run of whitespace" and "run of non-whitespace"
	// matches, in text order (String.split with a capturing group interleaves
	// the delimiters, so a manual matchAll keeps this a single linear pass).
	const matches = text.matchAll(/(\s+)|(\S+)/gu);
	for (const match of matches) {
		if (match[1] !== undefined) {
			pieces.push({ text: match[1], underline: false });
		} else if (match[2] !== undefined) {
			pieces.push({ text: match[2], underline: true });
		}
	}
	return pieces;
}
