/**
 * Shared evidence predicates for the morph matching passes.
 *
 * These answer the questions every pass asks before pairing two elements: do
 * they SAY different things (`differentText`), do their `!!` morph names
 * disagree (`conflictingMorphNames`), what media do they paint, how far apart
 * do they sit, and do they look alike (`appearanceSignature`). The passes in
 * `morph-heuristics` combine them; `morph-matching` reuses the two vetoes for
 * its own gates.
 *
 * Everything here is pure.
 *
 * @module render/morph-predicates
 */

import type { PptxElement } from 'pptx-viewer-core';

import { getElementMorphName } from './morph-name';

/** Depth cap for the recursive text read; real decks never nest this far. */
const TEXT_MAX_DEPTH = 8;

/**
 * Everything an element WRITES, including the text of its descendants.
 *
 * A group paints nothing itself - all of its words live in its children - so
 * reading only `element.text` reports every group as wordless and lets two
 * groups with nothing in common look interchangeable (issue #144: a wheel
 * slide's centre panel paired with a detail slide's callout box and glided
 * across the slide, "drifting text").
 */
function elementText(element: PptxElement, depth = 0): string {
	const own = (element as { text?: string }).text ?? '';
	const children = (element as { children?: PptxElement[] }).children;
	if (!children || depth >= TEXT_MAX_DEPTH) {
		return own;
	}
	let text = own;
	for (const child of children) {
		text += ` ${elementText(child, depth + 1)}`;
	}
	return text;
}

/**
 * Whether two elements both carry text, and carry DIFFERENT text.
 *
 * Used to veto a purely positional or appearance-based match:
 * same-place-different-words is the signature of a rebuilt panel, not of one
 * object that moved. Whitespace is normalised so a reflowed line break does
 * not read as a different string.
 */
export function differentText(a: PptxElement, b: PptxElement): boolean {
	const textOf = (element: PptxElement): string =>
		elementText(element).replace(/\s+/gu, ' ').trim();
	const fromText = textOf(a);
	const toText = textOf(b);
	return fromText !== '' && toText !== '' && fromText !== toText;
}

/**
 * Whether two elements both carry an explicit `!!` morph name and those names
 * DIFFER.
 *
 * The `!!` prefix is the author telling PowerPoint which shapes are the same
 * object across slides, so two different `!!` names are a statement that these
 * two are NOT (pass 1 already paired every side that agreed). Letting such a
 * pair fall through to a weaker signal lets an off-canvas box fly in from
 * off-stage - the "mystery box" of issue #144. Mirrors the `a16:creationId`
 * rule in pass 2b: evidence of identity that disagrees is evidence of
 * difference.
 */
export function conflictingMorphNames(a: PptxElement, b: PptxElement): boolean {
	const fromName = getElementMorphName(a);
	if (!fromName) {
		return false;
	}
	const toName = getElementMorphName(b);
	return Boolean(toName) && toName !== fromName;
}

/** The media part an image/picture element paints (path, else data URL). */
export function mediaIdentity(el: PptxElement): string | undefined {
	const props = el as { imagePath?: string; imageData?: string };
	return props.imagePath ?? props.imageData ?? undefined;
}

/** Euclidean distance between two elements' top-left corners (slide space). */
export function centreDistance(a: PptxElement, b: PptxElement): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}

/** Whether two elements are the same kind of picture painting the same media. */
export function sameMediaPicture(a: PptxElement, b: PptxElement): boolean {
	if (a.type !== 'picture' && a.type !== 'image') {
		return false;
	}
	if (b.type !== a.type) {
		return false;
	}
	if (conflictingMorphNames(a, b)) {
		return false;
	}
	const aMedia = mediaIdentity(a);
	const bMedia = mediaIdentity(b);
	return Boolean(aMedia) && aMedia === bMedia;
}

/** The `shapeStyle` paint fields that decide what an element looks like. */
export const APPEARANCE_KEYS = [
	'fillMode',
	'fillColor',
	'fillOpacity',
	'strokeColor',
	'strokeWidth',
	'strokeOpacity',
	'strokeDash',
] as const;

/**
 * Whether the element DECLARES paint (an explicit fill or stroke). The twin
 * pass requires this: two default, unstyled shapes are interchangeable
 * background debris on any slide, and pairing them is how off-stage boxes
 * come flying in (the "mystery box" class of bug). A shape whose author
 * picked a fill and a line and then moved it is a deliberate object.
 */
export function hasDeclaredPaint(el: PptxElement): boolean {
	const style = (el as { shapeStyle?: Record<string, unknown> }).shapeStyle;
	if (!style) {
		return false;
	}
	return APPEARANCE_KEYS.some((key) => style[key] !== undefined);
}

/**
 * A canonical string for everything an element LOOKS like (discriminant,
 * geometry preset, resolved fill/stroke paint, media). Two elements with
 * equal signatures are visually interchangeable apart from where they sit.
 */
export function appearanceSignature(el: PptxElement): string {
	const style = (el as { shapeStyle?: Record<string, unknown> }).shapeStyle;
	const parts: string[] = [el.type, (el as { shapeType?: string }).shapeType ?? ''];
	if (style) {
		for (const key of APPEARANCE_KEYS) {
			parts.push(style[key] === undefined ? '' : String(style[key]));
		}
	}
	parts.push(mediaIdentity(el) ?? '');
	return parts.join('|');
}
