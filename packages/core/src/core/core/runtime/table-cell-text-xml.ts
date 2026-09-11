import type { XmlObject } from '../../types';
import { ensureArray as toArray } from './table-structural-helpers';

type EnsureArray = (value: unknown) => XmlObject[];

const xmlArray: EnsureArray = (value) => toArray(value as XmlObject | XmlObject[] | undefined);

/**
 * Flatten a cell `a:txBody` to the same `\n`-joined plain string that
 * `PptxTableDataParser.extractTableCellText` produces at load time
 * (per-paragraph run text followed by field text). Used to detect whether a
 * cell's text was actually edited so an unedited cell can keep its rich
 * multi-run / multi-paragraph structure verbatim (#68).
 */
export function flattenCellTxBodyText(
	txBody: XmlObject | undefined,
	ensureArray: EnsureArray,
): string {
	if (!txBody) {
		return '';
	}
	const paragraphs = ensureArray(txBody['a:p']);
	const lines: string[] = [];
	for (const paragraph of paragraphs) {
		const runs = ensureArray((paragraph as XmlObject)?.['a:r']);
		const fields = ensureArray((paragraph as XmlObject)?.['a:fld']);
		let lineText = '';
		for (const run of runs) {
			lineText += String((run as XmlObject)?.['a:t'] ?? '');
		}
		for (const field of fields) {
			lineText += String((field as XmlObject)?.['a:t'] ?? '');
		}
		lines.push(lineText);
	}
	return lines.join('\n');
}

/** Keep valid, unchanged text bodies intact; a missing paragraph still needs rebuilding. */
export function tableCellTextBodyMatches(
	txBody: XmlObject | undefined,
	text: string,
	ensureArray: EnsureArray = xmlArray,
): boolean {
	return Boolean(
		txBody &&
		ensureArray(txBody['a:p']).length > 0 &&
		flattenCellTxBodyText(txBody, ensureArray) === text,
	);
}

/**
 * Rebuild a cell's `<a:txBody>` around a single run of `text`, carrying over
 * the body properties, list style, first paragraph's properties and first
 * run's properties.
 *
 * Every key is inserted in SCHEMA order, because fast-xml-parser's builder
 * emits object keys in insertion order and the three types involved are all
 * `xsd:sequence`s: `CT_TextBody` is (`a:bodyPr`, `a:lstStyle?`, `a:p+`),
 * `CT_TextParagraph` is (`a:pPr?`, runs...), `CT_RegularTextRun` is
 * (`a:rPr?`, `a:t`). Building the content first and appending the properties
 * afterwards - which both copies of this code did - emits an out-of-order
 * package, the spelling PowerPoint reads by silently discarding the group.
 *
 * Carry-over tests are `!== undefined` rather than truthiness, because a bare
 * `<a:pPr/>` or `<a:rPr/>` parses to the empty STRING and a truthiness test
 * drops it.
 */
export function rebuildCellTextBody(
	existingTxBody: XmlObject | undefined,
	text: string,
): XmlObject {
	const existingParagraphs = toArray(
		existingTxBody?.['a:p'] as XmlObject | XmlObject[] | undefined,
	);
	const firstParagraph = existingParagraphs.length > 0 ? existingParagraphs[0] : undefined;
	const existingRuns = firstParagraph
		? toArray(firstParagraph['a:r'] as XmlObject | XmlObject[] | undefined)
		: [];
	const firstRunProps = existingRuns.length > 0 ? existingRuns[0]['a:rPr'] : undefined;

	const newRun: XmlObject = {};
	if (firstRunProps !== undefined) {
		newRun['a:rPr'] = firstRunProps;
	}
	newRun['a:t'] = text;

	const newParagraph: XmlObject = {};
	if (firstParagraph?.['a:pPr'] !== undefined) {
		newParagraph['a:pPr'] = firstParagraph['a:pPr'];
	}
	newParagraph['a:r'] = newRun;

	const newTxBody: XmlObject = {};
	if (existingTxBody?.['a:bodyPr'] !== undefined) {
		newTxBody['a:bodyPr'] = existingTxBody['a:bodyPr'];
	}
	if (existingTxBody?.['a:lstStyle'] !== undefined) {
		newTxBody['a:lstStyle'] = existingTxBody['a:lstStyle'];
	}
	newTxBody['a:p'] = newParagraph;
	return newTxBody;
}
