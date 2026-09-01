/**
 * Bullet / numbered-list toggling for the ribbon's paragraph buttons.
 *
 * The renderer (`resolveParagraphBullet`) and the save writer
 * (`applyBulletProperties`) both read a paragraph's list state from the
 * `bulletInfo` of its FIRST segment; `TextStyle.listType` is consulted for
 * nothing but the `'none'` suppression. Every binding's Bullets / Numbering
 * button used to write `listType: 'bullet' | 'numbered'` onto the element's
 * `textStyle`, a field nothing downstream reads, so the buttons were dead.
 *
 * These helpers author the real thing: a `BulletInfo` on each paragraph's
 * first segment (`a:buChar` / `a:buAutoNum` / `a:buNone` on save), with the
 * inert `listType` cleared so a stale `'none'` cannot suppress the new marker.
 *
 * On load core prefixes a display-only marker segment (text "• " / "1.") to a
 * listed paragraph; the renderer drops it when its text matches the marker it
 * would draw, and the save writer drops it because the paragraph properties
 * already express it. Switching a bullet to a number (or off) would leave the
 * old glyph behind as literal text, so the previous marker is removed and a
 * fresh one authored in the same shape core uses.
 */

import type { BulletInfo, PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { formatAutoNumber } from './bullet-autonum';
import { resolveParagraphBullet } from './bullet-list';

/** The list state of a paragraph as the ribbon buttons see it. */
export type ParagraphBulletKind = 'bullet' | 'numbered' | 'none';

/** The default character bullet PowerPoint inserts (`a:buChar char="•"`). */
export const DEFAULT_BULLET_CHAR = '•';

/** The default numbering scheme PowerPoint inserts (`a:buAutoNum type="arabicPeriod"`). */
export const DEFAULT_AUTONUM_TYPE = 'arabicPeriod';

/**
 * The `BulletInfo` that authors `kind`.
 *
 * @param ordinal - Zero-based position of the paragraph within its numbered
 *   run, published as `paragraphIndex` so the renderer counts "1. 2. 3." (see
 *   `BulletInfo.paragraphIndex`). Ignored for the other kinds.
 */
export function bulletInfoForKind(kind: ParagraphBulletKind, ordinal: number = 0): BulletInfo {
	switch (kind) {
		case 'bullet':
			return { char: DEFAULT_BULLET_CHAR };
		case 'numbered':
			return { autoNumType: DEFAULT_AUTONUM_TYPE, autoNumStartAt: 1, paragraphIndex: ordinal };
		case 'none':
			return { none: true };
	}
}

/**
 * Whether a segment is the display-only marker core inserts on load (mirrors
 * the save writer's `isRenderedBulletMarker`): it carries `bulletInfo` and its
 * text is exactly the glyph the renderer would draw for that info.
 */
export function isBulletMarkerSegment(segment: TextSegment): boolean {
	const bullet = segment.bulletInfo;
	if (!bullet || bullet.none) {
		return false;
	}
	const resolved = resolveParagraphBullet(segment);
	if (!resolved) {
		return false;
	}
	return segment.text.trim() === resolved.marker.trim() && segment.text.trim().length > 0;
}

/**
 * The current list state of one paragraph (its segments, separators excluded),
 * derived from the resolved bullet of its first segment so an inherited
 * (master / layout) bullet that core resolved on load counts as `'bullet'`.
 */
export function paragraphBulletKind(paragraph: readonly TextSegment[]): ParagraphBulletKind {
	const resolved = resolveParagraphBullet(paragraph[0]);
	if (!resolved) {
		return 'none';
	}
	return resolved.isNumbered ? 'numbered' : 'bullet';
}

/** Copy of `style` without the inert `listType` flag. */
function withoutListType(style: TextStyle | undefined): TextStyle {
	const next: TextStyle = { ...(style ?? {}) };
	delete next.listType;
	return next;
}

/**
 * The paragraph-level fields that ride a paragraph's FIRST segment (the save
 * writer captures them from that segment only), so they must move with
 * whichever segment ends up first.
 */
type ParagraphMeta = Pick<
	TextSegment,
	'paragraphLevel' | 'paragraphProperties' | 'endParaRunProperties'
>;

function paragraphMeta(segment: TextSegment | undefined): ParagraphMeta {
	const meta: ParagraphMeta = {};
	if (segment?.paragraphLevel !== undefined) {
		meta.paragraphLevel = segment.paragraphLevel;
	}
	if (segment?.paragraphProperties !== undefined) {
		meta.paragraphProperties = segment.paragraphProperties;
	}
	if (segment?.endParaRunProperties !== undefined) {
		meta.endParaRunProperties = segment.endParaRunProperties;
	}
	return meta;
}

/** The display text of the marker segment for a bullet / numbered `info`. */
function markerText(info: BulletInfo): string {
	if (info.char) {
		return `${info.char} `;
	}
	const ordinal = (info.autoNumStartAt ?? 1) + (info.paragraphIndex ?? 0);
	return formatAutoNumber(info.autoNumType ?? DEFAULT_AUTONUM_TYPE, ordinal);
}

/**
 * Set one paragraph's list state to `kind`, returning the paragraph's new
 * segments.
 *
 * The result uses the same shape core produces on load, so the renderer and
 * the save writer treat an authored list exactly like a parsed one: for
 * `'bullet'` / `'numbered'` a display-only marker segment carrying the new
 * `bulletInfo` (and the paragraph-level fields) is placed first, followed by
 * the content runs with any previous marker removed; for `'none'` the marker
 * is dropped and the first content segment carries `{ none: true }`. The
 * inert `style.listType` is cleared on the touched segments. An empty
 * paragraph is returned unchanged since there is no run to carry the state.
 *
 * @param ordinal - Zero-based position within a numbered run; see
 *   {@link bulletInfoForKind}.
 */
export function toggleParagraphBullet(
	paragraph: readonly TextSegment[],
	kind: ParagraphBulletKind,
	ordinal: number = 0,
): TextSegment[] {
	const content = paragraph.filter((segment) => !isBulletMarkerSegment(segment));
	const first = content[0];
	if (!first) {
		return [...paragraph];
	}
	const meta = paragraphMeta(paragraph[0]);
	const info = bulletInfoForKind(kind, ordinal);
	const rest = content.slice(1);
	if (kind === 'none') {
		return [{ ...first, ...meta, style: withoutListType(first.style), bulletInfo: info }, ...rest];
	}
	const marker: TextSegment = {
		text: markerText(info),
		style: withoutListType(first.style),
		...meta,
		bulletInfo: info,
	};
	const body: TextSegment = { ...first, style: withoutListType(first.style) };
	delete body.bulletInfo;
	return [marker, body, ...rest];
}

function isParagraphSeparator(segment: TextSegment): boolean {
	return Boolean(segment.isParagraphBreak) || (segment.text === '\n' && !segment.isLineBreak);
}

/** Split a segment list into paragraphs, keeping each paragraph's terminator. */
function splitParagraphs(
	segments: readonly TextSegment[],
): Array<{ segments: TextSegment[]; terminator?: TextSegment }> {
	const paragraphs: Array<{ segments: TextSegment[]; terminator?: TextSegment }> = [
		{ segments: [] },
	];
	for (const segment of segments) {
		if (isParagraphSeparator(segment)) {
			paragraphs[paragraphs.length - 1].terminator = segment;
			paragraphs.push({ segments: [] });
			continue;
		}
		paragraphs[paragraphs.length - 1].segments.push(segment);
	}
	return paragraphs;
}

/** The element's segments, synthesised from `text` when it carries none. */
function elementSegments(element: PptxElement): TextSegment[] {
	if (!hasTextProperties(element)) {
		return [];
	}
	if (element.textSegments && element.textSegments.length > 0) {
		return element.textSegments;
	}
	const style: TextStyle = { ...(element.textStyle ?? {}) };
	const segments: TextSegment[] = [];
	for (const [index, line] of (element.text ?? '').split('\n').entries()) {
		if (index > 0) {
			segments.push({ text: '\n', style: { ...style }, isParagraphBreak: true });
		}
		segments.push({ text: line, style: { ...style } });
	}
	return segments;
}

/**
 * The list state an element's ribbon buttons should show: the kind of its
 * first non-empty paragraph, since that is what a toggle would act on.
 */
export function elementBulletKind(element: PptxElement): ParagraphBulletKind {
	for (const paragraph of splitParagraphs(elementSegments(element))) {
		if (paragraph.segments.length > 0) {
			return paragraphBulletKind(paragraph.segments);
		}
	}
	return 'none';
}

/**
 * Set every paragraph of an element to `kind`, returning the element patch
 * (`textSegments` rewritten; `textStyle.listType` cleared so the element-level
 * flag can no longer suppress or lie about the state). Numbered paragraphs are
 * counted consecutively so the renderer shows "1. 2. 3.".
 */
export function setElementBullets(
	element: PptxElement,
	kind: ParagraphBulletKind,
): Partial<PptxElement> {
	const textStyle = withoutListType(hasTextProperties(element) ? element.textStyle : undefined);
	const next: TextSegment[] = [];
	let ordinal = 0;
	for (const paragraph of splitParagraphs(elementSegments(element))) {
		if (paragraph.segments.length > 0) {
			next.push(...toggleParagraphBullet(paragraph.segments, kind, ordinal));
			ordinal += 1;
		}
		if (paragraph.terminator) {
			next.push(paragraph.terminator);
		}
	}
	return { textSegments: next, textStyle } as Partial<PptxElement>;
}

/**
 * The ribbon button behaviour: pressing Bullets (or Numbering) on an element
 * already in that state turns its lists off, otherwise it applies that kind
 * to every paragraph. Returns the element patch to apply through the
 * binding's update-element operation.
 */
export function toggleElementBullets(
	element: PptxElement,
	kind: Exclude<ParagraphBulletKind, 'none'>,
): Partial<PptxElement> {
	return setElementBullets(element, elementBulletKind(element) === kind ? 'none' : kind);
}
