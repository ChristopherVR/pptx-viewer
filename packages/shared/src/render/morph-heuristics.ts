/**
 * Appearance and media heuristics for the weaker morph matching passes.
 *
 * PowerPoint's by-object matcher does not stop at explicit identity
 * (`!!` names, `a16:creationId`): real decks show it also pairs a picture
 * with its counterpart across independently-authored slides (same
 * `cNvPr/@name`, same image bytes, every id different) and glides in a
 * full-slide overlay whose twin is identical apart from where it sits. These
 * passes reproduce that without overreaching: media identity is exact, and
 * the twin pass demands the same type, the exact same box size and the same
 * resolved paint, so the issue #131 wheel (same ids and names, different
 * colours and sizes) keeps falling through to proximity.
 *
 * Everything here is pure; the pass bookkeeping (used-element sets) is owned
 * by `morph-matching`, which calls into this module one-way.
 *
 * @module render/morph-heuristics
 */

import type { GroupPptxElement, PptxElement } from 'pptx-viewer-core';

import { correspondingChildren } from './morph-flatten';
import { getElementMorphName } from './morph-name';
import type { MorphPair } from './morph-types';

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
function mediaIdentity(el: PptxElement): string | undefined {
	const props = el as { imagePath?: string; imageData?: string };
	return props.imagePath ?? props.imageData ?? undefined;
}

/** Euclidean distance between two elements' top-left corners (slide space). */
function centreDistance(a: PptxElement, b: PptxElement): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}

/** Whether two elements are the same kind of picture painting the same media. */
function sameMediaPicture(a: PptxElement, b: PptxElement): boolean {
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
const APPEARANCE_KEYS = [
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
function hasDeclaredPaint(el: PptxElement): boolean {
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

/**
 * Pass: pair pictures that paint the SAME media part, even when every id - and
 * often the `cNvPr/@name` - differs.
 *
 * Independently-authored slides number their shapes from 1, so "the same
 * picture" is never the ids (or the creationIds) agreeing: it is the image
 * bytes agreeing. A full-bleed photo that slides into view is typically
 * auto-named differently on each slide ("Picture 3" on one, "Picture 7" on
 * the other); pairing by media is what makes it glide instead of fading in.
 *
 * When several outgoing pictures share one media part, the author's Selection
 * Pane name outranks distance, and the nearest candidate wins the rest -
 * which keeps two same-named thumbnails parked at opposite edges from
 * CROSS-pairing (each thumbnail morphs into its nearest on-slide copy, not
 * its neighbour's).
 */
export function matchSameMedia(
	fromElements: readonly PptxElement[],
	toElements: readonly PptxElement[],
	usedFrom: Set<string>,
	usedTo: Set<string>,
): MorphPair[] {
	const pairs: MorphPair[] = [];
	for (const fromEl of fromElements) {
		if (usedFrom.has(fromEl.id)) {
			continue;
		}
		const fromName = fromEl.name?.trim();
		let best: { to: PptxElement; named: boolean; dist: number } | undefined;
		for (const toEl of toElements) {
			if (usedTo.has(toEl.id) || !sameMediaPicture(fromEl, toEl)) {
				continue;
			}
			const named = Boolean(fromName) && toEl.name?.trim() === fromName;
			const dist = centreDistance(fromEl, toEl);
			const better =
				best === undefined || (named && !best.named) || (named === best.named && dist < best.dist);
			if (better) {
				best = { to: toEl, named, dist };
			}
		}
		if (best) {
			pairs.push({ fromElement: fromEl, toElement: best.to });
			usedFrom.add(fromEl.id);
			usedTo.add(best.to.id);
		}
	}
	return pairs;
}

/**
 * Whether two elements are groups of the SAME box size whose children line up
 * one for one (each child pairs by `!!` name, pane name, or a >= 50% box
 * overlap - the same evidence the flattener reads before decomposing a pair)
 * and which read the same. The words veto stays: two near-by panels that say
 * different things are a rebuilt panel, not one container that moved (issue
 * #144's drifting text).
 */
function sameSizedTwinCasts(a: PptxElement, b: PptxElement): boolean {
	if (a.type !== 'group' || b.type !== 'group') {
		return false;
	}
	if (a.width !== b.width || a.height !== b.height) {
		return false;
	}
	if (conflictingMorphNames(a, b)) {
		return false;
	}
	if (differentText(a, b)) {
		return false;
	}
	const aChildren = (a as GroupPptxElement).children;
	const bChildren = (b as GroupPptxElement).children;
	if (!Array.isArray(aChildren) || !Array.isArray(bChildren)) {
		return false;
	}
	return correspondingChildren(aChildren, bChildren) !== undefined;
}

/**
 * Pass: pair whole GROUPS whose casts correspond, even when every id differs.
 *
 * A title staged as a rotated full-slide group parked far above the visible
 * area on one slide and landed un-rotated on the next shares nothing a
 * stronger pass can read - different `p:cNvPr/@id`, different
 * `a16:creationId`, often a different name, position and angle - but it is
 * the same object to a reader: the same box size, the same words, and
 * children (a backdrop rectangle and a title text box) pairing one for one.
 * PowerPoint glides the container into place while un-rotating it; pairing
 * the groups (rather than decomposing them, which would bake the children
 * out of their rotated frame) reproduces that as one journey interpolating
 * the box and the angle.
 */
export function matchGroupTwins(
	fromElements: readonly PptxElement[],
	toElements: readonly PptxElement[],
	usedFrom: Set<string>,
	usedTo: Set<string>,
): MorphPair[] {
	const pairs: MorphPair[] = [];
	for (const fromEl of fromElements) {
		if (usedFrom.has(fromEl.id)) {
			continue;
		}
		for (const toEl of toElements) {
			if (usedTo.has(toEl.id)) {
				continue;
			}
			if (!sameSizedTwinCasts(fromEl, toEl)) {
				continue;
			}
			pairs.push({ fromElement: fromEl, toElement: toEl });
			usedFrom.add(fromEl.id);
			usedTo.add(toEl.id);
			break;
		}
	}
	return pairs;
}

/**
 * Pass: pair "identical twins" - same type, the EXACT same box size and an
 * identical DECLARED paint (explicit fill/stroke) - no matter how far apart
 * they sit. The distance-agnostic counterpart of the proximity pass: for two
 * shapes that are indistinguishable apart from where they are, interpolating
 * the box is what PowerPoint does, and what a morph is for. Unstyled shapes
 * carry no such statement and stay unmatched (see {@link hasDeclaredPaint}).
 */
export function matchIdenticalTwins(
	fromElements: readonly PptxElement[],
	toElements: readonly PptxElement[],
	usedFrom: Set<string>,
	usedTo: Set<string>,
): MorphPair[] {
	const pairs: MorphPair[] = [];
	for (const fromEl of fromElements) {
		if (usedFrom.has(fromEl.id)) {
			continue;
		}
		if (!hasDeclaredPaint(fromEl)) {
			continue;
		}
		const fromSignature = appearanceSignature(fromEl);
		for (const toEl of toElements) {
			if (usedTo.has(toEl.id)) {
				continue;
			}
			if (appearanceSignature(toEl) !== fromSignature) {
				continue;
			}
			if (fromEl.width !== toEl.width || fromEl.height !== toEl.height) {
				continue;
			}
			// Same-place-different-words is a rebuilt panel, not a moved object.
			if (differentText(fromEl, toEl)) {
				continue;
			}
			// An explicit `!!` name that disagrees is the author saying these
			// are two different objects.
			if (conflictingMorphNames(fromEl, toEl)) {
				continue;
			}
			pairs.push({ fromElement: fromEl, toElement: toEl });
			usedFrom.add(fromEl.id);
			usedTo.add(toEl.id);
			break;
		}
	}
	return pairs;
}
