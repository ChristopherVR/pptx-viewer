import type { XmlObject } from '../../types';

/**
 * Paragraph-scope preservation for the SPEAKER NOTES save path.
 *
 * The slide-body path solves the same problem with
 * `preserveParagraphScopedState`, which lifts `paragraphProperties`,
 * `paragraphLevel`, `bulletInfo` and `endParaRunProperties` off the element's
 * own `TextSegment[]`. That helper cannot serve the notes path: notes segments
 * are produced by `extractTextSegmentsFromTxBodyForRewrite`, which emits only
 * `{ text, style, fieldType?, fieldGuid? }` and is then run through
 * `compactTextSegments`, which rebuilds each entry as `{ text, style }`. None
 * of the four paragraph-scope fields is ever populated, so
 * `preserveParagraphScopedState` short-circuits on `states.every(isEmptyState)`
 * and hands its input straight back.
 *
 * What the notes path does have, and the slide-body path does not, is the
 * ORIGINAL `p:txBody` for the very paragraphs being rewritten: the notes part
 * is parsed from the package immediately before it is updated. Re-attaching
 * that `a:pPr` subtree verbatim is strictly more faithful than routing it
 * through `TextStyle`, which would round every EMU measurement through pixels
 * and silently drop any attribute the model does not name.
 *
 * Without this, every authored notes `a:pPr` came back as a bare `<a:pPr/>`:
 * `ppt/notesSlides/notesSlide1.xml` of `solution-explorer.pptx` went from 11
 * `a:pPr` attributes to 0 on a no-edit round-trip, resetting the speaker's
 * alignment, indentation, tab size and line-breaking rules.
 */

/** `a:endParaRPr` stub that {@link assembleParagraphXml} emits when a rebuilt paragraph carries none. */
const DEFAULT_END_PARA_RPR: Readonly<Record<string, string>> = { '@_lang': 'en-US' };

function asXmlObject(value: unknown): XmlObject | undefined {
	return typeof value === 'object' && value !== null ? (value as XmlObject) : undefined;
}

function isEmptyNode(node: unknown): boolean {
	const obj = asXmlObject(node);
	return obj === undefined || Object.keys(obj).length === 0;
}

/**
 * True when `node` is the placeholder terminator the paragraph builder
 * synthesises, rather than one carried over from the source document.
 */
function isDefaultEndParaRunProperties(node: unknown): boolean {
	const obj = asXmlObject(node);
	if (!obj) {
		return false;
	}
	const keys = Object.keys(obj);
	return keys.length === 1 && obj['@_lang'] === DEFAULT_END_PARA_RPR['@_lang'];
}

/** The node a present element parsed to, `{}` for an empty `''` element. */
function presentNode(value: unknown): XmlObject | undefined {
	if (value === '') {
		return {};
	}
	return asXmlObject(value);
}

const PARAGRAPH_FRAME_KEYS = new Set(['a:pPr', 'a:endParaRPr']);

/** True when a paragraph has no run, field, break or math content. */
function isRunless(paragraph: XmlObject): boolean {
	return Object.keys(paragraph).every(
		(key) => key.startsWith('@_') || PARAGRAPH_FRAME_KEYS.has(key),
	);
}

/**
 * Rebuild `paragraph` with `a:pPr` first and `a:endParaRPr` last: the
 * `CT_TextParagraph` child order (`pPr?`, `(r|br|fld)*`, `endParaRPr?`) that
 * fast-xml-parser derives from key insertion order. Adding `a:pPr` to a
 * paragraph the builder wrote without one would otherwise land it AFTER the
 * runs, which is invalid markup.
 */
function withParagraphFrame(
	paragraph: XmlObject,
	pPr: XmlObject | undefined,
	endParaRPr: XmlObject | undefined,
): XmlObject {
	const ordered: XmlObject = {};
	for (const key of Object.keys(paragraph)) {
		if (key.startsWith('@_')) {
			ordered[key] = paragraph[key];
		}
	}
	if (pPr !== undefined) {
		ordered['a:pPr'] = pPr;
	}
	for (const key of Object.keys(paragraph)) {
		if (!key.startsWith('@_') && !PARAGRAPH_FRAME_KEYS.has(key)) {
			ordered[key] = paragraph[key];
		}
	}
	if (endParaRPr !== undefined) {
		ordered['a:endParaRPr'] = endParaRPr;
	}
	return ordered;
}

/**
 * Re-attach each original notes paragraph's `a:pPr` and `a:endParaRPr` to the
 * paragraph the save path rebuilt in its place.
 *
 * Paragraphs are matched by index, the same rule the slide-body helper uses: a
 * notes edit that adds lines leaves the extra paragraphs with the builder's
 * output, and one that removes lines simply drops the trailing originals.
 *
 * Nothing the builder produced is overwritten. `a:pPr` is adopted only when the
 * rebuilt paragraph's own is empty, so a future notes path that starts emitting
 * paragraph properties wins and no illegal mixture of the two (say `a:buNone`
 * beside an inherited `a:buChar`) can be assembled. An authored EMPTY
 * `<a:pPr/>` is kept as written. `a:endParaRPr` is adopted only when the
 * rebuilt one is missing (the builder omits it for a paragraph with run
 * content and no captured end properties) or is the synthesised
 * `lang="en-US"` stub it emits for a runless one; an authored empty
 * `<a:endParaRPr/>` counts. A stub the builder added to a runless paragraph
 * whose original was runless without one is dropped again.
 *
 * @param originalParagraphs The `a:p` list read from the notes part on disk.
 * @param rebuiltParagraphs The `a:p` list `createParagraphsFromTextContent` produced.
 * @returns `rebuiltParagraphs`, updated in place and returned for convenience.
 */
export function preserveNotesParagraphXml(
	originalParagraphs: unknown[],
	rebuiltParagraphs: XmlObject[],
): XmlObject[] {
	for (let index = 0; index < rebuiltParagraphs.length; index++) {
		const original = presentNode(originalParagraphs[index]);
		const rebuilt = asXmlObject(rebuiltParagraphs[index]);
		if (!original || !rebuilt) {
			continue;
		}

		let pPr = presentNode(rebuilt['a:pPr']);
		const originalPPr = presentNode(original['a:pPr']);
		if (originalPPr && isEmptyNode(pPr)) {
			pPr = originalPPr;
		}

		let endParaRPr = rebuilt['a:endParaRPr'] as XmlObject | undefined;
		const originalEndParaRPr = presentNode(original['a:endParaRPr']);
		const rebuiltIsStub = isDefaultEndParaRunProperties(endParaRPr);
		if (originalEndParaRPr && (endParaRPr === undefined || rebuiltIsStub)) {
			endParaRPr = originalEndParaRPr;
		} else if (!originalEndParaRPr && rebuiltIsStub && isRunless(original) && isRunless(rebuilt)) {
			endParaRPr = undefined;
		}

		rebuiltParagraphs[index] = withParagraphFrame(rebuilt, pPr, endParaRPr);
	}
	return rebuiltParagraphs;
}
