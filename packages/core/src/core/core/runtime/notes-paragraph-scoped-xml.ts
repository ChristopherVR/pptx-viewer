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
 * beside an inherited `a:buChar`) can be assembled. `a:endParaRPr` is adopted
 * only when the rebuilt one is the synthesised `lang="en-US"` stub.
 *
 * Both nodes are written back onto the key the builder already created, so the
 * `CT_TextParagraph` child order (`pPr?`, `(r|br|fld)*`, `endParaRPr?`) that
 * fast-xml-parser derives from insertion order is unaffected.
 *
 * @param originalParagraphs The `a:p` list read from the notes part on disk.
 * @param rebuiltParagraphs The `a:p` list `createParagraphsFromTextContent` produced.
 * @returns `rebuiltParagraphs`, mutated in place and returned for convenience.
 */
export function preserveNotesParagraphXml(
	originalParagraphs: XmlObject[],
	rebuiltParagraphs: XmlObject[],
): XmlObject[] {
	for (let index = 0; index < rebuiltParagraphs.length; index++) {
		const original = asXmlObject(originalParagraphs[index]);
		const rebuilt = asXmlObject(rebuiltParagraphs[index]);
		if (!original || !rebuilt) {
			continue;
		}

		const originalPPr = asXmlObject(original['a:pPr']);
		if (originalPPr && !isEmptyNode(originalPPr) && isEmptyNode(rebuilt['a:pPr'])) {
			rebuilt['a:pPr'] = originalPPr;
		}

		const originalEndParaRPr = asXmlObject(original['a:endParaRPr']);
		if (originalEndParaRPr && isDefaultEndParaRunProperties(rebuilt['a:endParaRPr'])) {
			rebuilt['a:endParaRPr'] = originalEndParaRPr;
		}
	}
	return rebuiltParagraphs;
}
