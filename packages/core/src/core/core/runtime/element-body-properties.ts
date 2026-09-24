import type { TextStyle } from '../../types';

/**
 * Track whether a `a:bodyPr` scoped value on `element.textStyle` was
 * authored (or edited since) rather than merely resolved by the load
 * pipeline's inheritance cascade.
 *
 * ## The problem this solves
 *
 * `applyBodyProperties` parses a shape's `a:bodyPr` into `element.textStyle`,
 * and `applyPlaceholderBodyDefaults` then back-fills whatever is still
 * `undefined` from the placeholder / layout / master. A placeholder shape
 * with no `a:bodyPr` of its own goes a step further: the loader feeds the
 * INHERITED placeholder's `a:bodyPr` node into the same parse as if it were
 * the shape's own. All three sources land in the same flat fields, so by the
 * time `element.textStyle` exists there is no way to tell "the shape's own
 * XML said `anchor="ctr"`" from "nothing said so and this is just what
 * inheritance produced". A writer that re-emits every defined field
 * therefore pins the inherited value onto the slide the moment it is
 * rewritten (the deck stops being layout/master-driven for that shape), and
 * an inherited `a:normAutofit` with no `fontScale` gets rewritten as
 * `a:spAutoFit` because the writer's legacy fallback cannot see that the
 * shape never authored an autofit choice at all.
 *
 * ## The fix
 *
 * A snapshot of the resolved fields is captured once, right after the
 * cascade finishes (`captureResolvedBodyProperties`), regardless of whether
 * the shape has any text. The save path then asks
 * `elementBodyPropertyEditKeys` which of those fields still equal the
 * snapshot: an untouched field is left exactly as the underlying `a:bodyPr`
 * XML object already has it (present or absent, own-authored or nothing),
 * and only a field that has since changed (a genuine edit) is written.
 */
export const ELEMENT_BODY_PROPERTY_KEYS = [
	'vAlign',
	'textDirection',
	'columnCount',
	'columnSpacing',
	'hOverflow',
	'vertOverflow',
	'autoFitMode',
	'autoFit',
	'autoFitFontScale',
	'autoFitLineSpacingReduction',
	'bodyInsetLeft',
	'bodyInsetTop',
	'bodyInsetRight',
	'bodyInsetBottom',
	'textWrap',
	'compatibleLineSpacing',
	'forceAntiAlias',
	'upright',
	'fromWordArt',
	'spaceFirstLastParagraph',
	'anchorCenter',
	'rtlColumns',
	'textBodyRotation',
] as const satisfies ReadonlyArray<keyof TextStyle>;

type ElementBodyPropertyKey = (typeof ELEMENT_BODY_PROPERTY_KEYS)[number];

/** Whether the element style says anything at all about body-level properties. */
export function hasElementBodyProperties(style: TextStyle | undefined): boolean {
	if (!style) {
		return false;
	}
	return ELEMENT_BODY_PROPERTY_KEYS.some((key) => style[key] !== undefined);
}

/**
 * Record, once the placeholder-default cascade has run, the body properties
 * it resolved. Mutates the element style in place because that is the
 * object the rest of the parse is already building. Called unconditionally
 * (not gated on the shape having any text) so a text-less shape's own
 * `anchor`/insets/autofit still round-trip.
 */
export function captureResolvedBodyProperties(style: TextStyle): void {
	const snapshot: Record<string, unknown> = {};
	for (const key of ELEMENT_BODY_PROPERTY_KEYS) {
		if (style[key] !== undefined) {
			snapshot[key] = style[key];
		}
	}
	style.resolvedBodyProperties = snapshot as TextStyle;
}

/**
 * The set of body-property keys that differ from the resolved snapshot,
 * i.e. either the source authored them at shape scope, or the user has
 * edited them since load.
 *
 * Returns `undefined` when there is no snapshot at all (this text never came
 * from a parsed deck: SDK-built, fabricated, or a synthetic style in a
 * test), which tells the caller to keep writing every defined field in
 * full, exactly as before this diff existed.
 */
export function elementBodyPropertyEditKeys(
	style: TextStyle | undefined,
): Set<ElementBodyPropertyKey> | undefined {
	const resolved = style?.resolvedBodyProperties;
	if (!style || !resolved) {
		return undefined;
	}
	const edited = new Set<ElementBodyPropertyKey>();
	for (const key of ELEMENT_BODY_PROPERTY_KEYS) {
		if (style[key] !== resolved[key]) {
			edited.add(key);
		}
	}
	return edited;
}

/** Whether `key` should be written: no snapshot (write everything), or this key changed. */
export function shouldWriteBodyProperty(
	edits: Set<ElementBodyPropertyKey> | undefined,
	key: ElementBodyPropertyKey,
): boolean {
	return edits === undefined || edits.has(key);
}

/**
 * A copy of `style` with every UNEDITED body-property key removed, for
 * handing to a writer (like `writeBodyPrBooleanAttrs`) that only ever SETS
 * an attribute when its field is defined and never has a delete branch. With
 * no snapshot, `style` is returned unchanged: nothing came from a parsed
 * deck, so it is the sole description and must be written in full.
 */
export function styleForBodyPropertyWrite(
	style: TextStyle | undefined,
	edits: Set<ElementBodyPropertyKey> | undefined,
): TextStyle | undefined {
	if (!style || edits === undefined) {
		return style;
	}
	const filtered: Record<string, unknown> = { ...style };
	for (const key of ELEMENT_BODY_PROPERTY_KEYS) {
		if (!edits.has(key)) {
			delete filtered[key];
		}
	}
	return filtered as TextStyle;
}
