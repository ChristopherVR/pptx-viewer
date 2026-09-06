import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readOleDocParagraphs, writeOleDocParagraphEdit } from './ole-document-doc-editor';

/**
 * Real Word 97-2003 `.doc` authored via Word COM (`Documents.Add`,
 * `Selection.TypeText`/`TypeParagraph`, `SaveAs2(..., wdFormatDocument97)`):
 * four paragraphs, the second with a bold word mid-run so the piece/FKP
 * structure is not trivially uniform. Ground truth for every byte offset
 * this editor reads/writes (see the module docs on `ole-document-doc-fib.ts`
 * etc.) was dumped and decoded from this exact file.
 *
 * Every edit this test performs was ALSO round-tripped through real Word via
 * COM (`Documents.Open` + `Paragraphs(n).Range.Text`) outside this suite;
 * see the OLE `.doc` editor wave's report for the transcript. This suite
 * pins the same byte-level behaviour so a regression is caught without
 * requiring Word to be installed.
 */
const FIXTURE_PATH = path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'ole-word-97.doc');
const FIXTURE_PARAGRAPHS = [
	'First paragraph plain text.',
	'Second paragraph has a bold word in the middle.',
	'Third paragraph, plain again, this is the one we will edit.',
	'Fourth and final paragraph.',
];

function loadFixture(): Uint8Array {
	return new Uint8Array(readFileSync(FIXTURE_PATH));
}

describe('ole-document-doc-editor', () => {
	it('reads every main-body paragraph, in order, paragraph mark excluded', () => {
		expect(readOleDocParagraphs(loadFixture())).toStrictEqual(FIXTURE_PARAGRAPHS);
	});

	it('returns undefined for a payload with no WordDocument stream', () => {
		expect(readOleDocParagraphs(new Uint8Array([1, 2, 3]))).toBeUndefined();
	});

	it('replaces a middle paragraph, leaving every other paragraph byte-identical text', () => {
		const original = loadFixture();
		const updated = writeOleDocParagraphEdit(original, 2, 'A replaced third paragraph.');
		expect(updated).not.toStrictEqual(original);

		const reRead = readOleDocParagraphs(updated);
		expect(reRead).toStrictEqual([
			FIXTURE_PARAGRAPHS[0],
			FIXTURE_PARAGRAPHS[1],
			'A replaced third paragraph.',
			FIXTURE_PARAGRAPHS[3],
		]);
	});

	it('replaces the first paragraph', () => {
		const updated = writeOleDocParagraphEdit(loadFixture(), 0, 'A new first paragraph.');
		expect(readOleDocParagraphs(updated)?.[0]).toBe('A new first paragraph.');
		expect(readOleDocParagraphs(updated)?.slice(1)).toStrictEqual(FIXTURE_PARAGRAPHS.slice(1));
	});

	it('replaces the last paragraph', () => {
		const updated = writeOleDocParagraphEdit(loadFixture(), 3, 'A new final paragraph.');
		expect(readOleDocParagraphs(updated)).toStrictEqual([
			...FIXTURE_PARAGRAPHS.slice(0, 3),
			'A new final paragraph.',
		]);
	});

	it('grows a paragraph well beyond its original length', () => {
		const longText = 'A '.repeat(200).trim();
		const updated = writeOleDocParagraphEdit(loadFixture(), 1, longText);
		expect(readOleDocParagraphs(updated)?.[1]).toBe(longText);
	});

	it('round-trips Windows-1252 high-block characters (accents, curly quotes)', () => {
		const text = 'Café naïve résumé, curly ‘quotes’ too.';
		const updated = writeOleDocParagraphEdit(loadFixture(), 0, text);
		expect(readOleDocParagraphs(updated)?.[0]).toBe(text);
	});

	it('falls back to a UTF-16 piece for characters outside Windows-1252 (emoji)', () => {
		const text = 'Emoji fallback \u{1f600} end.';
		const updated = writeOleDocParagraphEdit(loadFixture(), 1, text);
		expect(readOleDocParagraphs(updated)?.[1]).toBe(text);
	});

	it('applies a second edit on top of an already-edited document', () => {
		let bytes = writeOleDocParagraphEdit(loadFixture(), 0, 'First edit.');
		bytes = writeOleDocParagraphEdit(bytes, 3, 'Second edit, different paragraph.');
		expect(readOleDocParagraphs(bytes)).toStrictEqual([
			'First edit.',
			FIXTURE_PARAGRAPHS[1],
			FIXTURE_PARAGRAPHS[2],
			'Second edit, different paragraph.',
		]);
	});

	it('strips embedded paragraph-break characters rather than splitting the paragraph', () => {
		const updated = writeOleDocParagraphEdit(loadFixture(), 0, 'Line one\r\nLine two');
		expect(readOleDocParagraphs(updated)).toHaveLength(FIXTURE_PARAGRAPHS.length);
		expect(readOleDocParagraphs(updated)?.[0]).toBe('Line one Line two');
	});

	it('returns the original bytes unchanged for an out-of-range paragraph index', () => {
		const original = loadFixture();
		const updated = writeOleDocParagraphEdit(original, 99, 'unreachable');
		expect(updated).toStrictEqual(original);
	});

	it('returns the original bytes unchanged for an unreadable payload', () => {
		const bogus = new Uint8Array([1, 2, 3]);
		expect(writeOleDocParagraphEdit(bogus, 0, 'text')).toStrictEqual(bogus);
	});
});
