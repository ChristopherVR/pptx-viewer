/**
 * @fileoverview Did this slide author its own `<p:bg>`, or is it inheriting?
 *
 * ## Why this exists
 *
 * `<p:bg>` is optional on `p:sld` (ECMA-376 §19.3.1.38). A slide that omits it
 * shows the background its layout provides, which in turn usually defers to the
 * master's `<p:bgRef>` into the theme's `a:bgFillStyleLst`. That chain is what
 * makes a deck re-themeable.
 *
 * The loader flattens the chain, because a renderer needs one paintable value:
 * `PptxSlideLoaderService` sets `slide.backgroundColor` to the slide's own
 * colour *or the layout's*, and the layout's resolves from the master, so on a
 * plain deck every slide came back carrying `#FFFFFF`. The save writer then
 * treated "the model holds a colour" as "the slide has a background" and
 * emitted `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/>…` on EVERY
 * slide. A slide-level `p:bg` outranks the layout and master, so one save
 * turned an inherited themed or picture background into flat white and severed
 * the link for good.
 *
 * ## The rule
 *
 * Record at load what the slide actually authored and what the inherited
 * fallback resolved to. On save, emit a background when the slide authored one,
 * or when the model no longer agrees with the inherited value (which is how an
 * edit is recognised: an editor mutates the flat value and knows nothing about
 * the baseline). Otherwise write nothing and let the chain stand.
 *
 * A colour the user really did pick still lands as a literal `p:bgPr`, which is
 * what PowerPoint writes when you choose a solid fill: the inheritance is
 * replaced deliberately rather than by accident. That is the same rule
 * {@link master-save-helpers.applyBackgroundColorToCSld} applies one level up,
 * for a layout or master.
 *
 * @see authored-shape-style.ts - the shape-scope twin of this decision.
 * @see authored-run-style.ts - the run-scope twin.
 */

/** What one slide authored, and what it would inherit if it authored nothing. */
export interface AuthoredSlideBackground {
	/** True when the slide's own `p:sld/p:cSld/p:bg` produced any of these. */
	authored: boolean;
	/** The inherited (or authored) values the loader put on the model. */
	color?: string | undefined;
	gradient?: string | undefined;
	image?: string | undefined;
}

const originsByRuntime = new WeakMap<object, Map<string, AuthoredSlideBackground>>();

/** Case- and `#`-insensitive comparison key for a colour. */
function key(value: string | undefined): string {
	return value === undefined ? '' : value.trim().replace(/^#/, '').toUpperCase();
}

/** Record what the loader resolved for one slide. */
export function rememberSlideBackgroundOrigin(
	runtime: object,
	slidePath: string,
	origin: AuthoredSlideBackground,
): void {
	let bySlide = originsByRuntime.get(runtime);
	if (!bySlide) {
		bySlide = new Map();
		originsByRuntime.set(runtime, bySlide);
	}
	bySlide.set(slidePath, origin);
}

/** What was recorded for `slidePath`, or `undefined` when it was never parsed. */
export function slideBackgroundOrigin(
	runtime: object,
	slidePath: string,
): AuthoredSlideBackground | undefined {
	return originsByRuntime.get(runtime)?.get(slidePath);
}

/** The background values a save-time decision compares against the record. */
export interface SlideBackgroundValues {
	backgroundColor?: string | undefined;
	backgroundGradient?: string | undefined;
	backgroundImage?: string | undefined;
}

/**
 * True when this slide's `<p:bg>` is purely inherited and must not be written.
 *
 * False when the slide authored its own background, when the caller changed one
 * of the three values since load, or when nothing was recorded at all (an
 * SDK-built slide, or one this handler never parsed, in which case the flat
 * values are the only description there is).
 */
export function slideBackgroundIsPurelyInherited(
	origin: AuthoredSlideBackground | undefined,
	values: SlideBackgroundValues,
): boolean {
	if (!origin || origin.authored) {
		return false;
	}
	return (
		key(values.backgroundColor) === key(origin.color) &&
		key(values.backgroundGradient) === key(origin.gradient) &&
		(values.backgroundImage ?? '') === (origin.image ?? '')
	);
}
