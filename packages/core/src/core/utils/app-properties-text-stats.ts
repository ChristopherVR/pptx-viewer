/**
 * The `Words` and `Paragraphs` statistics PowerPoint recomputes into
 * `docProps/app.xml` on every save, read off the SAVED slide, notes and
 * SmartArt data parts.
 *
 * Measured over COM (PowerPoint 16.0, `SaveAs` of decks authored through the
 * object model, then reading `app.xml`):
 *
 * - The text of every slide AND of every notes page counts, including the
 *   slide-number field on a notes page (an otherwise empty notes page records
 *   one word and one paragraph). Hidden slides count; slide master and layout
 *   text (placeholder prompts) does not.
 * - Every text body counts separately: shapes, grouped shapes and table cells.
 * - A text body's paragraphs count up to its LAST non-empty paragraph, so a
 *   blank line between two paragraphs counts but trailing blank lines and an
 *   empty body do not. A paragraph holding only whitespace or a line break is
 *   not empty.
 * - Words follow {@link countParagraphWords}.
 *
 * SmartArt text counts, read from its data model (`dgm:t` bodies; empty
 * placeholder nodes and connector points count nothing). Chart text (titles,
 * labels, legends) does not count.
 *
 * @module app-properties-text-stats
 */

import type { XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import { listSlideParts } from './app-properties-counts';
import { countParagraphWords, LINE_BREAK_CHAR } from './app-properties-word-count';

/** Word and paragraph totals for `docProps/app.xml`. */
export interface TextStatistics {
	words: number;
	paragraphs: number;
}

const FALLBACK_BLOCK = /<mc:Fallback\b[\s\S]*?<\/mc:Fallback>/g;
const TEXT_BODY_OPEN = /<(p:txBody|a:txBody|dgm:t)\b[^>]*?(\/?)>/g;
const PARAGRAPH_OPEN = /<a:p(?:\s[^>]*?)?(\/?)>/g;
const PARAGRAPH_CONTENT =
	/<a:t(?:\s[^>]*?)?>([\s\S]*?)<\/a:t>|<a:br\b[^>]*?\/>|<a:br\b[^>]*?>[\s\S]*?<\/a:br>/g;
const ENTITY = /&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g;
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
};

function decodeEntities(text: string): string {
	return text.replace(ENTITY, (_match, entity: string) => {
		if (entity.startsWith('#x')) {
			return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
		}
		if (entity.startsWith('#')) {
			return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
		}
		return NAMED_ENTITIES[entity] ?? '';
	});
}

/**
 * The inner XML of every element whose start tag `open` matches (its last
 * group captures a self-closing `/`, which yields `''`), up to the close tag
 * `closeTag` names for that match. The elements scanned never nest.
 */
function elementBodies(
	xml: string,
	open: RegExp,
	closeTag: (match: RegExpExecArray) => string,
): string[] {
	const bodies: string[] = [];
	open.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = open.exec(xml)) !== null) {
		if (match[match.length - 1] === '/') {
			bodies.push('');
			continue;
		}
		const close = closeTag(match);
		const end = xml.indexOf(close, open.lastIndex);
		if (end < 0) {
			break;
		}
		bodies.push(xml.slice(open.lastIndex, end));
		open.lastIndex = end + close.length;
	}
	return bodies;
}

/** A paragraph's text in document order, with each `a:br` as {@link LINE_BREAK_CHAR}. */
function paragraphText(paragraphXml: string): string {
	let text = '';
	PARAGRAPH_CONTENT.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = PARAGRAPH_CONTENT.exec(paragraphXml)) !== null) {
		text += match[1] !== undefined ? decodeEntities(match[1]) : LINE_BREAK_CHAR;
	}
	return text;
}

/** Word and paragraph totals of one part's XML (slide, notes page or SmartArt data). */
export function countPartTextStatistics(xml: string): TextStatistics {
	const totals: TextStatistics = { words: 0, paragraphs: 0 };
	const content = xml.replace(FALLBACK_BLOCK, '');
	const bodies = elementBodies(content, TEXT_BODY_OPEN, (match) => `</${match[1]}>`);
	for (const body of bodies) {
		const texts = elementBodies(body, PARAGRAPH_OPEN, () => '</a:p>').map(paragraphText);
		let lastNonEmpty = -1;
		texts.forEach((text, index) => {
			if (text.length > 0) {
				lastNonEmpty = index;
			}
			totals.words += countParagraphWords(text);
		});
		totals.paragraphs += lastNonEmpty + 1;
	}
	return totals;
}

/**
 * Word and paragraph totals across the saved package's slides, their notes
 * pages and their SmartArt, or `undefined` when there are no presentation rels to follow.
 */
export async function countPresentationTextStatistics(
	zip: JSZip,
	parser: XMLParser,
): Promise<TextStatistics | undefined> {
	const slides = await listSlideParts(zip, parser);
	if (!slides) {
		return undefined;
	}
	const totals: TextStatistics = { words: 0, paragraphs: 0 };
	for (const { slidePath, notesPath, diagramDataPaths } of slides) {
		for (const path of [slidePath, ...(notesPath ? [notesPath] : []), ...diagramDataPaths]) {
			const file = zip.file(path);
			if (!file) {
				continue;
			}
			const part = countPartTextStatistics(await file.async('string'));
			totals.words += part.words;
			totals.paragraphs += part.paragraphs;
		}
	}
	return totals;
}
