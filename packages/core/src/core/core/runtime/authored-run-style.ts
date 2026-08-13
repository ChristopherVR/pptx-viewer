import type { TextStyle } from '../../types';

/**
 * Decide, per property, whether a run's `a:rPr` may carry it.
 *
 * ## Why this exists
 *
 * `a:rPr` is a *sparse override* of an inheritance chain, not a description of
 * the run: a run that omits `sz`, `a:solidFill` and `a:latin` takes them from
 * the shape's `a:lstStyle`, then the layout placeholder, then the master
 * `p:txStyles`, then the theme's `a:fontScheme` / `a:clrScheme`
 * (ECMA-376 §21.1.2.3, §19.3.1.40/§19.3.1.42). `<a:latin typeface="+mj-lt"/>`
 * and `<a:schemeClr val="tx1"/>` are LINKS, not values.
 *
 * The load pipeline resolves that chain into one flat {@link TextStyle},
 * because that is what a renderer needs. Writing the flat style back turns
 * every link into a literal: measured on the project's own COM corpus deck,
 * `<a:rPr lang="en-US"/>` came back from a no-op round trip as
 * `<a:rPr sz="6000"><a:solidFill><a:srgbClr val="000000"/></a:solidFill>
 * <a:latin typeface="Aptos Display"/></a:rPr>`. Nothing looks wrong until the
 * user re-themes the deck in PowerPoint and the text refuses to follow.
 *
 * ## The rule
 *
 * Emit a property when the run itself authored it, or when the flat style no
 * longer agrees with the baseline inheritance produced (which is how an EDIT
 * made after load is recognised: editors mutate the flat style and know
 * nothing about either half). Otherwise leave it out and let it inherit,
 * exactly as the source did.
 *
 * When the style carries no baseline the run did not come from a parsed deck:
 * the flat style is then the ONLY description of it, so everything is written
 * and behaviour is unchanged. That covers SDK-built text, fabricated shapes,
 * and every synthetic style a test hands in.
 *
 * @see TextStyle.authoredRunStyle
 * @see PptxHandlerRuntimeSaveParagraphHelpers `authoredPropertyGate` — the
 *      paragraph-scope twin of this decision.
 */
export type RunStyleGate = (...keys: Array<keyof TextStyle>) => boolean;

/** Keys whose values are objects/arrays, compared by identity below. */
function differsFromBaseline(style: TextStyle, baseline: TextStyle, key: keyof TextStyle): boolean {
	return style[key] !== baseline[key];
}

/**
 * Build the ownership predicate for one run style. The predicate answers
 * "may `a:rPr` carry any of these keys?", taking several keys at once because
 * a single XML child is often driven by a group of them (`a:latin` by the
 * typeface plus its theme token, `@u` by the style plus the explicit-none
 * marker).
 */
export function createRunStyleGate(style: TextStyle | undefined): RunStyleGate {
	const baseline = style?.inheritedRunStyle;
	if (!style || !baseline) {
		return () => true;
	}
	const authored = style.authoredRunStyle;
	return (...keys) =>
		keys.some((key) => authored?.[key] !== undefined || differsFromBaseline(style, baseline, key));
}
