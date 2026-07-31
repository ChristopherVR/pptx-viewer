/**
 * The WRITE half of Outline view: turn a keystroke into a new deck.
 *
 * Pure and total: `applyOutlineEdit` takes the slides it is given and returns
 * new slides, never mutating the input. That shape is deliberate. Every binding
 * already has a history mechanism that watches its slide state, so handing back
 * a fresh `PptxSlide[]` makes undo/redo work through the machinery each binding
 * already has instead of asking five of them to grow an outline-specific
 * history path.
 *
 * What is intentionally NOT implemented, so nobody reads its absence as a bug:
 *
 * **Tab on a title row does nothing.** In PowerPoint, demoting a title merges
 * that slide into the one above it and promoting a top-level bullet splits a
 * new slide out. Both are safe there because PowerPoint's outline owns the
 * whole slide. Here a slide carries arbitrary elements (images, charts, tables,
 * ink) that the outline cannot see, so merging two slides would silently
 * destroy content the user never had on screen. Levels move within a body,
 * slides are created by Enter on a title, and nothing in this view deletes a
 * slide.
 *
 * @module render/outline-view-edit
 */

import type { PptxElement, PptxSlide, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { generateElementId } from './element-clipboard';
import type { OutlinePara, OutlineRow, ParagraphGroup } from './outline-view';
import {
	buildOutline,
	findOutlineRow,
	groupElementParagraphs,
	MAX_PARAGRAPH_LEVEL,
	OUTLINE_TITLE_ELEMENT_NAME,
	outlineRowKey,
	paragraphGroupText,
	readElementParagraphs,
} from './outline-view';
import { remapTextToSegments } from './remap-text';
import { makeSlideId } from './slide-operations';

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** One outline edit, always addressed by a row key rather than a position. */
export type OutlineEdit =
	/** Replace a row's text (a keystroke, a paste, an IME commit). */
	| { type: 'setText'; key: string; text: string }
	/** Demote (`delta: 1`) or promote (`delta: -1`) a body row one level. */
	| { type: 'indent'; key: string; delta: number }
	/** Enter: a new body line, or on a title row a new slide. */
	| { type: 'insertAfter'; key: string };

/** Optional injection points, so tests get deterministic ids and layout. */
export interface OutlineEditOptions {
	/** Overrides the id scheme for created slides and elements. */
	idGenerator?: () => string;
	/** Canvas size the created title element is laid out against. */
	canvas?: { width: number; height: number };
}

/** The deck after an edit, plus where the caret and the editor should go. */
export interface OutlineEditResult {
	slides: PptxSlide[];
	/** False when the edit was a no-op, so a binding can skip a history push. */
	changed: boolean;
	/** Row that should hold focus afterwards, or `null` to leave focus alone. */
	focusKey: string | null;
	/** Slide the editor should make active, so leaving the outline lands there. */
	activeSlideIndex: number;
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

/** The subset of a keyboard event the outline needs. */
export interface OutlineKeyInput {
	key: string;
	shiftKey?: boolean;
	ctrlKey?: boolean;
	metaKey?: boolean;
	altKey?: boolean;
}

/** What a binding should do with a key press inside an outline row. */
export interface OutlineKeyHandling {
	edit: OutlineEdit | null;
	/** Cancel the browser default: Tab would otherwise leave the row entirely. */
	preventDefault: boolean;
}

/**
 * Translate a key press inside an outline row into an edit.
 *
 * Both of PowerPoint's spellings are honoured: bare Tab / Shift+Tab, and the
 * Alt+Shift+Arrow chords that work anywhere in PowerPoint's outline. Anything
 * with Ctrl or Meta is left alone so the browser keeps its own shortcuts, and
 * so Ctrl+Z reaches the binding's undo rather than being eaten here.
 */
export function mapOutlineKey(input: OutlineKeyInput, rowKey: string): OutlineKeyHandling {
	const none: OutlineKeyHandling = { edit: null, preventDefault: false };
	if (input.ctrlKey || input.metaKey) {
		return none;
	}
	if (input.key === 'Tab' && !input.altKey) {
		return {
			edit: { type: 'indent', key: rowKey, delta: input.shiftKey ? -1 : 1 },
			preventDefault: true,
		};
	}
	if (input.altKey && input.shiftKey && (input.key === 'ArrowRight' || input.key === 'ArrowLeft')) {
		return {
			edit: { type: 'indent', key: rowKey, delta: input.key === 'ArrowRight' ? 1 : -1 },
			preventDefault: true,
		};
	}
	if (input.key === 'Enter' && !input.shiftKey && !input.altKey) {
		return { edit: { type: 'insertAfter', key: rowKey }, preventDefault: true };
	}
	return none;
}

// ---------------------------------------------------------------------------
// Paragraph writing
// ---------------------------------------------------------------------------

/** Clone a segment list, stamping (or clearing) the paragraph's `a:pPr/@lvl`. */
function withLevel(segments: TextSegment[], level: number): TextSegment[] {
	return segments.map((segment, index) => {
		if (index > 0) {
			return segment;
		}
		const next: TextSegment = { ...segment };
		if (level > 0) {
			next.paragraphLevel = Math.min(level, MAX_PARAGRAPH_LEVEL);
		} else {
			delete next.paragraphLevel;
		}
		return next;
	});
}

/**
 * Rebuild one paragraph's segments for `text`.
 *
 * An UNCHANGED paragraph is reused verbatim rather than remapped. That is what
 * keeps equations, fields, hyperlinks and soft line breaks intact while someone
 * types on a different line: remapping redistributes characters across runs,
 * which is exactly right for the line being edited and pure loss for every
 * other line in the same text body.
 */
function rebuildParagraph(
	group: ParagraphGroup | undefined,
	donor: ParagraphGroup | undefined,
	text: string,
	elementStyle: TextStyle | undefined,
): TextSegment[] {
	if (group && paragraphGroupText(group) === text) {
		return [...(group.marker ? [group.marker] : []), ...group.content];
	}
	const source = group ?? donor;
	const marker = source?.marker ? [source.marker] : [];
	const content = remapTextToSegments(text, source?.content, elementStyle);
	return [...marker, ...content];
}

/**
 * Write paragraphs back onto an element, returning a new element.
 *
 * `element.text` is rewritten from the row text, which means it no longer
 * carries the bullet glyphs core prefixes on load. That is correct rather than
 * lossy: `textSegments` is what both the renderer and the save writer read when
 * it exists, and the glyph is re-derived from the paragraph's own bullet
 * properties, which travel on the preserved marker segment.
 */
export function writeElementParagraphs(
	element: PptxElement,
	paragraphs: readonly OutlinePara[],
): PptxElement {
	const groups = groupElementParagraphs(element);
	const donor = groups[groups.length - 1];
	const style = hasTextProperties(element) ? element.textStyle : undefined;
	const segments: TextSegment[] = [];
	for (const [index, paragraph] of paragraphs.entries()) {
		if (index > 0) {
			const previous = segments[segments.length - 1];
			segments.push({
				text: '\n',
				style: { ...(previous?.style ?? style ?? {}) },
				isParagraphBreak: true,
			});
		}
		segments.push(
			...withLevel(rebuildParagraph(groups[index], donor, paragraph.text, style), paragraph.level),
		);
	}
	return {
		...element,
		text: paragraphs.map((paragraph) => paragraph.text).join('\n'),
		textSegments: segments,
	} as PptxElement;
}

// ---------------------------------------------------------------------------
// Element / slide creation
// ---------------------------------------------------------------------------

const DEFAULT_CANVAS = { width: 960, height: 540 };

/**
 * Build the title element for a slide that had none.
 *
 * Created WITHOUT `rawXml`: the save writer only synthesises a well-formed
 * `<p:sp>` for elements that carry no raw XML, so handing it a fabricated
 * `<p:ph>` stub would short-circuit that and emit a shape with no `spPr` and no
 * `txBody`. The element is identified as the title by its NAME instead, which
 * `resolveSlideOutlineElements` matches.
 */
function createTitleElement(text: string, options: OutlineEditOptions): PptxElement {
	const canvas = options.canvas ?? DEFAULT_CANVAS;
	return {
		type: 'text',
		id: options.idGenerator ? options.idGenerator() : generateElementId(),
		name: OUTLINE_TITLE_ELEMENT_NAME,
		x: Math.round(canvas.width * 0.06),
		y: Math.round(canvas.height * 0.08),
		width: Math.round(canvas.width * 0.88),
		height: Math.round(canvas.height * 0.17),
		text,
		textStyle: { fontSize: 36, bold: true },
		textSegments: [{ text, style: { fontSize: 36, bold: true } }],
	} as PptxElement;
}

/** Renumber slides so `slideNumber` still matches document order after an insert. */
function renumber(slides: PptxSlide[]): PptxSlide[] {
	return slides.map((slide, index) => ({ ...slide, slideNumber: index + 1 }));
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

function unchanged(slides: PptxSlide[], row?: OutlineRow): OutlineEditResult {
	return {
		slides,
		changed: false,
		focusKey: row?.key ?? null,
		activeSlideIndex: row?.slideIndex ?? 0,
	};
}

/** Replace one element on one slide, returning fresh slide + deck arrays. */
function replaceElement(
	slides: readonly PptxSlide[],
	slideIndex: number,
	elementId: string,
	next: PptxElement,
): PptxSlide[] {
	return slides.map((slide, index) =>
		index === slideIndex
			? {
					...slide,
					elements: (slide.elements ?? []).map((element) =>
						element.id === elementId ? next : element,
					),
				}
			: slide,
	);
}

function editParagraphs(
	slides: readonly PptxSlide[],
	row: OutlineRow,
	mutate: (paragraphs: OutlinePara[]) => OutlinePara[] | null,
): OutlineEditResult | null {
	const slide = slides[row.slideIndex];
	const element = (slide?.elements ?? []).find((candidate) => candidate.id === row.elementId);
	if (!element) {
		return null;
	}
	const paragraphs = readElementParagraphs(element);
	// A row can address the paragraph one past the end: an element whose text is
	// entirely empty reads as zero paragraphs but still owns row 0.
	while (paragraphs.length <= row.paragraphIndex) {
		paragraphs.push({ text: '', level: 0 });
	}
	const next = mutate(paragraphs);
	if (!next) {
		return null;
	}
	return {
		slides: replaceElement(
			slides,
			row.slideIndex,
			element.id,
			writeElementParagraphs(element, next),
		),
		changed: true,
		focusKey: row.key,
		activeSlideIndex: row.slideIndex,
	};
}

/**
 * An outline row is one LINE. Newlines a paste drags in are folded to spaces
 * rather than split into extra paragraphs, because splitting here would leave
 * the caller's row keys addressing paragraphs that had silently moved.
 */
function oneLine(text: string): string {
	return text.replace(/[\r\n]+/g, ' ');
}

function applySetText(
	slides: readonly PptxSlide[],
	row: OutlineRow,
	raw: string,
	options: OutlineEditOptions,
): OutlineEditResult {
	const text = oneLine(raw);
	if (row.elementId === null) {
		if (text.length === 0) {
			return unchanged([...slides], row);
		}
		const element = createTitleElement(text, options);
		// Prepended, not appended: the fallback resolver reads the FIRST
		// text-bearing element as the title, and a slide reaching this branch has
		// no placeholder to anchor that decision to.
		const next = slides.map((slide, index) =>
			index === row.slideIndex
				? { ...slide, elements: [element, ...(slide.elements ?? [])] }
				: slide,
		);
		return {
			slides: next,
			changed: true,
			focusKey: outlineRowKey(row.slideId, element.id, 0),
			activeSlideIndex: row.slideIndex,
		};
	}
	const result = editParagraphs(slides, row, (paragraphs) => {
		if (paragraphs[row.paragraphIndex].text === text) {
			return null;
		}
		const next = [...paragraphs];
		next[row.paragraphIndex] = { ...next[row.paragraphIndex], text };
		return next;
	});
	return result ?? unchanged([...slides], row);
}

function applyIndent(
	slides: readonly PptxSlide[],
	row: OutlineRow,
	delta: number,
): OutlineEditResult {
	// Titles are the outline's leftmost column and there is nothing to promote
	// them into: see the module docstring for why demoting one does not merge
	// slides here.
	if (row.kind !== 'body' || row.elementId === null || delta === 0) {
		return unchanged([...slides], row);
	}
	const result = editParagraphs(slides, row, (paragraphs) => {
		const current = paragraphs[row.paragraphIndex];
		const level = Math.min(Math.max(current.level + (delta > 0 ? 1 : -1), 0), MAX_PARAGRAPH_LEVEL);
		if (level === current.level) {
			return null;
		}
		const next = [...paragraphs];
		next[row.paragraphIndex] = { ...current, level };
		return next;
	});
	return result ?? unchanged([...slides], row);
}

function applyInsertAfter(
	slides: readonly PptxSlide[],
	row: OutlineRow,
	options: OutlineEditOptions,
): OutlineEditResult {
	if (row.kind === 'title') {
		// PowerPoint's defining outline gesture: Enter on a title starts a slide.
		const slide: PptxSlide = {
			id: makeSlideId(options.idGenerator),
			rId: '',
			slideNumber: row.slideIndex + 2,
			elements: [],
		};
		const next = renumber([
			...slides.slice(0, row.slideIndex + 1),
			slide,
			...slides.slice(row.slideIndex + 1),
		]);
		return {
			slides: next,
			changed: true,
			focusKey: outlineRowKey(slide.id, null, 0),
			activeSlideIndex: row.slideIndex + 1,
		};
	}
	const result = editParagraphs(slides, row, (paragraphs) => {
		const next = [...paragraphs];
		next.splice(row.paragraphIndex + 1, 0, {
			text: '',
			level: paragraphs[row.paragraphIndex].level,
		});
		return next;
	});
	if (!result) {
		return unchanged([...slides], row);
	}
	return {
		...result,
		focusKey: outlineRowKey(row.slideId, row.elementId, row.paragraphIndex + 1),
	};
}

/**
 * Apply one outline edit to a deck.
 *
 * Always returns a result, never throws: a key that no longer resolves (the row
 * was removed by a concurrent collaborator, or the deck reloaded under the
 * pane) yields `changed: false` rather than an exception thrown at someone who
 * was only typing.
 */
export function applyOutlineEdit(
	slides: readonly PptxSlide[],
	edit: OutlineEdit,
	options: OutlineEditOptions = {},
): OutlineEditResult {
	const row = findOutlineRow(buildOutline(slides), edit.key);
	if (!row) {
		return unchanged([...slides]);
	}
	switch (edit.type) {
		case 'setText':
			return applySetText(slides, row, edit.text, options);
		case 'indent':
			return applyIndent(slides, row, edit.delta);
		case 'insertAfter':
			return applyInsertAfter(slides, row, options);
		default:
			return unchanged([...slides], row);
	}
}
