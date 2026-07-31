/**
 * PowerPoint's Outline view, as a framework-agnostic model of the deck's text.
 *
 * Outline view shows a deck as an indented text document: one line per slide
 * title at the far left, that slide's body text indented beneath it. It is the
 * fastest way to draft or restructure a deck, and no binding shipped it.
 *
 * This module owns the READ half (deck -> rows) plus the paragraph read/write
 * primitives the edit half builds on. `outline-view-edit` owns the WRITE half.
 * Both are pure: the bindings own the markup and the event listeners, and own
 * no rule about what a row is or what Tab does.
 *
 * Three decisions are worth stating up front, because they are the ones a
 * reader will otherwise assume were oversights:
 *
 * 1. **Placeholders first, then a fallback.** PowerPoint's outline shows only
 *    placeholder text, and free text boxes never appear. Applying that alone
 *    here would blank the outline for the many decks (and every deck this repo
 *    hand-authors as a fixture) that carry no `<p:ph>` at all, which reads as a
 *    broken feature rather than as fidelity. So placeholders win when present,
 *    and a slide with none falls back to its text-bearing elements in document
 *    order. See {@link resolveSlideOutlineElements}.
 * 2. **A slide always contributes at least one row.** A slide with no title
 *    placeholder, or no text whatsoever, still gets a title row (with a null
 *    `elementId`). Without it the outline silently hides slides, and hiding a
 *    slide from the view whose entire job is to show the deck's structure is
 *    the worst failure this feature has.
 * 3. **A row is one (element, paragraph) pair**, keyed by ids rather than by
 *    position, so a key survives an edit that inserts a slide above it.
 *
 * @module render/outline-view
 */

import type { PptxElement, PptxSlide, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// DOM contract
// ---------------------------------------------------------------------------

/**
 * Marks the outline-view root in every binding.
 *
 * A neutral data attribute rather than a class or a test id, for the same
 * reason `READING_VIEW_ATTR` is one: `e2e/` addresses all five viewers through
 * one selector, and a class name is a styling decision each binding may make
 * differently.
 */
export const OUTLINE_VIEW_ATTR = 'data-pptx-outline-view';

/** Marks one editable outline line. Its value is the row's {@link OutlineRow.key}. */
export const OUTLINE_ROW_ATTR = 'data-pptx-outline-row';

/** Marks a row's slide number, so a binding can group rows per slide. */
export const OUTLINE_SLIDE_ATTR = 'data-pptx-outline-slide';

/** Marks a row's outline level, so styling and tests read it without parsing CSS. */
export const OUTLINE_LEVEL_ATTR = 'data-pptx-outline-level';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/** Whether a row carries the slide's title or one of its body lines. */
export type OutlineRowKind = 'title' | 'body';

/** One editable line of the outline. */
export interface OutlineRow {
	/**
	 * Stable identity of the row: slide id, element id and paragraph index.
	 *
	 * Deliberately NOT the slide index: inserting a slide above this one must
	 * not move a caret that is sitting in a row further down.
	 */
	key: string;
	/** Zero-based position of the row's slide in the deck. */
	slideIndex: number;
	slideId: string;
	kind: OutlineRowKind;
	/**
	 * Element the row's text lives in, or `null` for the synthetic title row of
	 * a slide that has no text at all. Typing into a null-element row creates
	 * the element (see `applyOutlineEdit`).
	 */
	elementId: string | null;
	/** Zero-based paragraph index within {@link elementId}. */
	paragraphIndex: number;
	/**
	 * Indent level as the outline shows it: `0` for a title, `1..9` for body
	 * text. Body level `n` is the authored `a:pPr/@lvl` of `n - 1`, which is why
	 * a top-level bullet is level 1 and not level 0: in the outline the title
	 * occupies the leftmost column.
	 */
	level: number;
	text: string;
}

/** A paragraph as the outline reads and writes it. */
export interface OutlinePara {
	text: string;
	/** Raw `a:pPr/@lvl`: 0 for a top-level paragraph, 1-8 nested. */
	level: number;
}

/** Highest `a:pPr/@lvl` OOXML allows (ECMA-376 CT_TextParagraphProperties). */
export const MAX_PARAGRAPH_LEVEL = 8;

/** Placeholder types PowerPoint treats as the slide's title. */
const TITLE_PH_TYPES = new Set(['title', 'ctrtitle']);

/**
 * Placeholder types that never belong in an outline.
 *
 * Header / footer / date / slide-number repeat on every slide, so listing them
 * would bury the actual content under four rows of chrome per slide.
 */
const CHROME_PH_TYPES = new Set(['ftr', 'hdr', 'dt', 'sldnum']);

/** Name given to a title element the outline creates for a slide that lacked one. */
export const OUTLINE_TITLE_ELEMENT_NAME = 'Title';

// ---------------------------------------------------------------------------
// Element resolution
// ---------------------------------------------------------------------------

interface RawPlaceholder {
	'p:nvSpPr'?: { 'p:nvPr'?: { 'p:ph'?: { '@_type'?: string } } };
}

/**
 * Read an element's placeholder type from its preserved raw XML.
 *
 * Returns `'body'` for a `<p:ph>` that declares no `@type`: the schema default
 * for `CT_Placeholder/@type` is `body`, and a content placeholder authored as
 * `<p:ph idx="1"/>` is extremely common. Treating it as "not a placeholder"
 * dropped the body of most real decks from the outline.
 */
function placeholderType(element: PptxElement): string | undefined {
	const ph = (element.rawXml as RawPlaceholder | undefined)?.['p:nvSpPr']?.['p:nvPr']?.['p:ph'];
	if (!ph) {
		return undefined;
	}
	const type = typeof ph['@_type'] === 'string' ? ph['@_type'].trim().toLowerCase() : '';
	return type.length > 0 ? type : 'body';
}

/** Whether an element can carry outline text at all. */
function isTextBearing(element: PptxElement): boolean {
	return hasTextProperties(element);
}

/** Plain text of an element, used only to decide whether it is worth a row. */
function elementHasText(element: PptxElement): boolean {
	if (!hasTextProperties(element)) {
		return false;
	}
	if (typeof element.text === 'string' && element.text.trim().length > 0) {
		return true;
	}
	return (element.textSegments ?? []).some((segment) => segment.text.trim().length > 0);
}

/** The title element and the body elements a slide contributes to the outline. */
export interface SlideOutlineElements {
	/** Title element, or `null` when the slide has no text to title it with. */
	title: PptxElement | null;
	body: PptxElement[];
}

/**
 * Decide which of a slide's elements the outline reads.
 *
 * Placeholder-bearing slides resolve exactly as PowerPoint does: the
 * title/ctrTitle placeholder titles the slide and the remaining content
 * placeholders supply the body, with header/footer/date/slide-number chrome
 * excluded. A slide with no usable placeholder falls back to its text-bearing
 * elements in document order, first as the title and the rest as body: see the
 * module docstring for why the strict rule alone was not shippable here.
 *
 * A slide that has never had a title also matches an element NAMED `Title`,
 * which is what {@link OUTLINE_TITLE_ELEMENT_NAME} stamps on the element the
 * outline creates when someone types into an empty title row. Without that the
 * newly created title would be re-read as body text on the very next render.
 */
export function resolveSlideOutlineElements(slide: PptxSlide): SlideOutlineElements {
	const elements = (slide.elements ?? []).filter(isTextBearing);

	const placeholderTitle = elements.find((element) => {
		const type = placeholderType(element);
		return type !== undefined && TITLE_PH_TYPES.has(type);
	});
	const placeholderBody = elements.filter((element) => {
		const type = placeholderType(element);
		return type !== undefined && !TITLE_PH_TYPES.has(type) && !CHROME_PH_TYPES.has(type);
	});

	if (placeholderTitle || placeholderBody.length > 0) {
		return { title: placeholderTitle ?? null, body: placeholderBody };
	}

	const named = elements.find(
		(element) =>
			(element.name ?? '').trim().toLowerCase() === OUTLINE_TITLE_ELEMENT_NAME.toLowerCase(),
	);
	const withText = elements.filter(elementHasText);
	const title = named ?? withText[0] ?? null;
	return { title, body: withText.filter((element) => element !== title) };
}

// ---------------------------------------------------------------------------
// Paragraph read / write
// ---------------------------------------------------------------------------

/** One paragraph's segments, split into its display bullet marker and its runs. */
export interface ParagraphGroup {
	/** The core-inserted display marker segment, when the paragraph has one. */
	marker?: TextSegment;
	/** Everything else: the paragraph's actual runs. */
	content: TextSegment[];
}

/**
 * Whether a segment is the display-only bullet marker core inserts on load.
 *
 * Mirrors the save writer's own `isRenderedBulletMarker`: the marker is not
 * authored text, it is a rendering convenience, and letting it into an outline
 * row would show "• Item" in the editable line and then write the glyph back
 * into the deck as literal characters on the next keystroke.
 */
function isBulletMarker(segment: TextSegment): boolean {
	const bullet = segment.bulletInfo;
	if (!bullet) {
		return false;
	}
	const marker = bullet.char
		? `${bullet.char} `
		: bullet.imageRelId || bullet.imageDataUrl
			? '\u{1F4CE} '
			: bullet.autoNumType
				? undefined
				: '• ';
	return marker ? segment.text === marker : bullet.paragraphIndex !== undefined;
}

function isParagraphSeparator(segment: TextSegment): boolean {
	return Boolean(segment.isParagraphBreak) || (segment.text === '\n' && !segment.isLineBreak);
}

/**
 * Split an element's segments into paragraph groups.
 *
 * Falls back to splitting `element.text` when the element carries no segments
 * (SDK-built and freshly inserted elements), so every downstream helper can
 * assume groups exist and none of them has to special-case a bare string.
 */
export function groupElementParagraphs(element: PptxElement): ParagraphGroup[] {
	const withText = hasTextProperties(element) ? element : undefined;
	const segments = withText?.textSegments;
	if (!segments || segments.length === 0) {
		const style: TextStyle = { ...(withText?.textStyle ?? {}) };
		return (withText?.text ?? '').split('\n').map((text) => ({
			content: [{ text, style: { ...style } }],
		}));
	}
	const groups: ParagraphGroup[] = [{ content: [] }];
	for (const segment of segments) {
		if (isParagraphSeparator(segment)) {
			groups.push({ content: [] });
			continue;
		}
		const current = groups[groups.length - 1];
		if (current.content.length === 0 && current.marker === undefined && isBulletMarker(segment)) {
			current.marker = segment;
			continue;
		}
		current.content.push(segment);
	}
	return groups;
}

/**
 * Plain text of one paragraph group.
 *
 * A soft line break (`a:br`) becomes a single space rather than a newline: an
 * outline row is one line, and emitting "\n" here would make the row's text
 * indistinguishable from a paragraph break and silently convert the soft break
 * into a hard one the first time the row was written back.
 */
export function paragraphGroupText(group: ParagraphGroup): string {
	return group.content.map((segment) => (segment.isLineBreak ? ' ' : segment.text)).join('');
}

/** Raw `a:pPr/@lvl` of a paragraph group, read from its first segment. */
function paragraphGroupLevel(group: ParagraphGroup): number {
	const first = group.marker ?? group.content[0];
	const level = first?.paragraphLevel;
	return typeof level === 'number' && level > 0 ? Math.min(level, MAX_PARAGRAPH_LEVEL) : 0;
}

/**
 * Read an element's paragraphs as the outline sees them.
 *
 * Trailing empty paragraphs are dropped, matching `buildParagraphs`: both the
 * load path and the edit-remap path leave a separator behind, and showing an
 * always-blank last row under every block would double the outline's length
 * with lines the deck never draws.
 */
export function readElementParagraphs(element: PptxElement): OutlinePara[] {
	const groups = groupElementParagraphs(element);
	const paragraphs = groups.map((group) => ({
		text: paragraphGroupText(group),
		level: paragraphGroupLevel(group),
	}));
	let last = paragraphs.length - 1;
	while (last >= 0 && paragraphs[last].text.length === 0) {
		last -= 1;
	}
	return paragraphs.slice(0, last + 1);
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** Build a row key from the parts that identify it. */
export function outlineRowKey(
	slideId: string,
	elementId: string | null,
	paragraphIndex: number,
): string {
	return `${slideId}|${elementId ?? ' new-title'}|${paragraphIndex}`;
}

function pushElementRows(
	rows: OutlineRow[],
	element: PptxElement,
	kind: OutlineRowKind,
	slide: PptxSlide,
	slideIndex: number,
): void {
	for (const [paragraphIndex, paragraph] of readElementParagraphs(element).entries()) {
		rows.push({
			key: outlineRowKey(slide.id, element.id, paragraphIndex),
			slideIndex,
			slideId: slide.id,
			kind,
			elementId: element.id,
			paragraphIndex,
			// A title always sits in the leftmost column; body text is pushed one
			// column right of it, so authored level 0 reads as outline level 1.
			level: kind === 'title' ? 0 : paragraph.level + 1,
			text: paragraph.text,
		});
	}
}

/**
 * Build the whole deck's outline.
 *
 * Every slide contributes at least one row even when it holds no text: see the
 * module docstring, decision 2.
 */
export function buildOutline(slides: readonly PptxSlide[]): OutlineRow[] {
	const rows: OutlineRow[] = [];
	for (const [slideIndex, slide] of slides.entries()) {
		const { title, body } = resolveSlideOutlineElements(slide);
		const before = rows.length;
		if (title) {
			pushElementRows(rows, title, 'title', slide, slideIndex);
		}
		if (rows.length === before) {
			// No title element, or one whose text is entirely empty: emit the
			// synthetic row so the slide is still visible and still typeable.
			rows.push({
				key: outlineRowKey(slide.id, title?.id ?? null, 0),
				slideIndex,
				slideId: slide.id,
				kind: 'title',
				elementId: title?.id ?? null,
				paragraphIndex: 0,
				level: 0,
				text: '',
			});
		}
		for (const element of body) {
			pushElementRows(rows, element, 'body', slide, slideIndex);
		}
	}
	return rows;
}

/** Find a row by key, or `undefined`. */
export function findOutlineRow(rows: readonly OutlineRow[], key: string): OutlineRow | undefined {
	return rows.find((row) => row.key === key);
}
