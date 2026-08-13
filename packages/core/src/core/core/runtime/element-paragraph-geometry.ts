import type { TextStyle, XmlObject } from '../../types';

/**
 * Route the ELEMENT-scope paragraph geometry to the slot OOXML actually
 * provides for it: `p:txBody > a:lstStyle > a:lvl1pPr`.
 *
 * ## The problem this solves
 *
 * `element.textStyle` carries one alignment, one `marL`/`indent`, one line
 * spacing and one space-before/after for the whole text body. That is a
 * *shape-level* statement, but the writer had nowhere to put it except each
 * paragraph's own `a:pPr`, so it stamped all of them. Two things went wrong:
 *
 * 1. Values the loader had merely RESOLVED (from the shape's `a:lstStyle`, the
 *    layout placeholder, the master `p:txStyles`) came back as explicitly
 *    authored per-paragraph values, so re-theming or re-laying-out the deck in
 *    PowerPoint no longer moved the text.
 * 2. Stamping beat per-paragraph inheritance: a level-3 bullet was re-indented
 *    to whatever `marL` the shape had resolved for level 1.
 *
 * A sibling closed most of (2) by only writing a key the paragraph itself
 * authored, but could not close the last case: a level-0 paragraph with no
 * `a:pPr` at all is indistinguishable, at the `a:pPr` writer, from SDK-built
 * text where the element style is the ONLY description of the paragraph. One
 * needs the value dropped, the other needs it written.
 *
 * ## Why `a:lstStyle` resolves it
 *
 * The dilemma is an artefact of writing shape-scope state into paragraph
 * scope. `a:lstStyle/a:lvl1pPr` IS shape scope: it sits above the
 * layout/master cascade and below any paragraph's own `a:pPr`
 * (ECMA-376 §21.1.2.4.12), so writing it once
 *
 * - keeps an element-level edit (the shared `textAdvancedPatch` / `alignPatch`
 *   panels write ONLY `element.textStyle`, never `segment.paragraphProperties`,
 *   so dropping it would silently discard the user's change),
 * - leaves every level above 1 to inherit exactly as authored,
 * - leaves each paragraph's own `a:pPr` to override it, and
 * - stops repeating the same statement on every paragraph of the body.
 */

/**
 * Paragraph-scope keys that describe the WHOLE body rather than one paragraph,
 * i.e. everything `buildParagraphPropertiesXml` can emit from an element-level
 * style. `a:defRPr` and `a:extLst` are deliberately absent: they are opaque
 * subtrees captured per paragraph and are left on the paragraph writer.
 */
const ELEMENT_PARAGRAPH_GEOMETRY_KEYS = [
	'align',
	'rtl',
	'paragraphMarginLeft',
	'paragraphMarginRight',
	'paragraphIndent',
	'defaultTabSize',
	'eaLineBreak',
	'latinLineBreak',
	'fontAlignment',
	'hangingPunctuation',
	'lineSpacing',
	'lineSpacingExactPt',
	'paragraphSpacingBefore',
	'paragraphSpacingAfter',
	'tabStops',
] as const satisfies ReadonlyArray<keyof TextStyle>;

/** Whether the element style says anything at all about paragraph geometry. */
export function hasElementParagraphGeometry(style: TextStyle | undefined): boolean {
	if (!style) {
		return false;
	}
	return ELEMENT_PARAGRAPH_GEOMETRY_KEYS.some((key) => style[key] !== undefined);
}

/**
 * Record, at the end of shape-text parsing, the geometry the cascade resolved.
 * Mutates the element style in place because that is the object the rest of the
 * parse is already building.
 */
export function captureResolvedParagraphGeometry(style: TextStyle): void {
	const snapshot: Record<string, unknown> = {};
	for (const key of ELEMENT_PARAGRAPH_GEOMETRY_KEYS) {
		if (style[key] !== undefined) {
			snapshot[key] = style[key];
		}
	}
	style.resolvedParagraphGeometry = snapshot as TextStyle;
}

/**
 * The element-scope geometry that is NOT simply what inheritance produced:
 * either the source authored it at shape scope, or the user has edited it
 * since. `undefined` means "there is no snapshot", i.e. this text never came
 * from a deck (SDK-built, fabricated, or a synthetic style in a test), so the
 * caller must keep writing the style out in full.
 *
 * `tabStops` is an array and is compared by identity, which is the safe
 * direction: a rebuilt array reads as an edit and gets written.
 */
export function elementParagraphGeometryEdits(style: TextStyle | undefined): TextStyle | undefined {
	const resolved = style?.resolvedParagraphGeometry;
	if (!style || !resolved) {
		return undefined;
	}
	const edits: Record<string, unknown> = {};
	for (const key of ELEMENT_PARAGRAPH_GEOMETRY_KEYS) {
		if (style[key] !== resolved[key]) {
			edits[key] = style[key];
		}
	}
	return edits as TextStyle;
}

/**
 * The element style with its body-wide paragraph geometry removed, so the
 * paragraph writer stops broadcasting it. Every other member is untouched:
 * the runs still take their fonts, sizes and colours from it.
 */
export function withoutElementParagraphGeometry(
	style: TextStyle | undefined,
): TextStyle | undefined {
	if (!hasElementParagraphGeometry(style) || !style) {
		return style;
	}
	const pruned = { ...style } as Record<string, unknown>;
	for (const key of ELEMENT_PARAGRAPH_GEOMETRY_KEYS) {
		delete pruned[key];
	}
	return pruned as TextStyle;
}

/**
 * Merge the freshly built element-scope properties into the text body's
 * `a:lstStyle`, preserving anything the source already declared there.
 *
 * `<a:lstStyle/>` parses to the empty STRING (the parser runs with
 * `parseTagValue: false`), and an authored `a:lvl1pPr` must keep the children
 * we are not routing, so both cases are normalised here rather than assumed.
 */
export function applyElementParagraphGeometryToListStyle(
	txBody: XmlObject,
	properties: XmlObject,
): void {
	if (Object.keys(properties).length === 0) {
		return;
	}
	const existing = txBody['a:lstStyle'];
	const listStyle: XmlObject =
		existing && typeof existing === 'object' && !Array.isArray(existing)
			? (existing as XmlObject)
			: {};
	const existingLevel1 = listStyle['a:lvl1pPr'];
	const level1: XmlObject =
		existingLevel1 && typeof existingLevel1 === 'object' && !Array.isArray(existingLevel1)
			? (existingLevel1 as XmlObject)
			: {};
	const isAttribute = (key: string): boolean => key.startsWith('@_');
	const sourceDeclaresChildren = Object.keys(level1).some((key) => !isAttribute(key));
	// Attributes are order-free, so they merge unconditionally. CHILD elements
	// are not: CT_TextParagraphProperties fixes the sequence
	// (lnSpc, spcBef, spcAft, bullet group, tabLst, defRPr, extLst) and
	// fast-xml-parser serialises keys in insertion order, so splicing ours in
	// beside an authored `a:buChar` would emit them out of sequence and
	// PowerPoint would offer to repair the file. When the source already
	// declares children its own `a:lvl1pPr` is left intact: it is already the
	// element-scope statement these values were resolved from.
	const merged: XmlObject = {};
	for (const [key, value] of Object.entries(properties)) {
		if (isAttribute(key)) {
			merged[key] = value;
		}
	}
	for (const [key, value] of Object.entries(level1)) {
		if (isAttribute(key) && !(key in merged)) {
			merged[key] = value;
		}
	}
	if (sourceDeclaresChildren) {
		for (const [key, value] of Object.entries(level1)) {
			if (!isAttribute(key)) {
				merged[key] = value;
			}
		}
	} else {
		for (const [key, value] of Object.entries(properties)) {
			if (!isAttribute(key)) {
				merged[key] = value;
			}
		}
	}
	listStyle['a:lvl1pPr'] = merged;
	txBody['a:lstStyle'] = listStyle;
}
