/**
 * OOXML underline / strikethrough -> CSS text-decoration resolution, shared by
 * every binding's text renderer.
 *
 * Pure, framework-agnostic: returns a neutral record of CSS text-decoration
 * properties (literal-union `textDecorationStyle` plus `px` strings). Each
 * binding casts it into its own style type at the call site.
 */

/** CSS `text-decoration-style` keyword values. */
export type CssTextDecorationStyle = 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy';

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
