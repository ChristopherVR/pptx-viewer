import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { preserveNotesParagraphXml } from './notes-paragraph-scoped-xml';

function authoredParagraph(): XmlObject {
	return {
		'a:pPr': {
			'@_marL': '0',
			'@_algn': 'l',
			'@_defTabSz': '914400',
			'@_eaLnBrk': '1',
			'@_fontAlgn': 'auto',
			'@_hangingPunct': '1',
			'a:lnSpc': { 'a:spcPct': { '@_val': '100000' } },
			'a:buNone': {},
		},
		'a:r': { 'a:rPr': { '@_lang': 'en-GB' }, 'a:t': 'note' },
		'a:endParaRPr': { '@_lang': 'en-GB', '@_dirty': '0' },
	};
}

/** What `createParagraphsFromTextContent` emits for the notes path today. */
function rebuiltParagraph(text: string): XmlObject {
	return {
		'a:pPr': {},
		'a:r': { 'a:rPr': {}, 'a:t': text },
		'a:endParaRPr': { '@_lang': 'en-US' },
	};
}

describe('preserveNotesParagraphXml', () => {
	it('re-attaches the authored a:pPr subtree verbatim', () => {
		const original = [authoredParagraph()];
		const rebuilt = [rebuiltParagraph('note')];

		preserveNotesParagraphXml(original, rebuilt);

		expect(rebuilt[0]['a:pPr']).toBe(original[0]['a:pPr']);
		expect((rebuilt[0]['a:pPr'] as XmlObject)['@_eaLnBrk']).toBe('1');
		expect((rebuilt[0]['a:pPr'] as XmlObject)['a:buNone']).toStrictEqual({});
	});

	it('keeps a:pPr as the paragraph first key so child order stays legal', () => {
		const rebuilt = [rebuiltParagraph('note')];

		preserveNotesParagraphXml([authoredParagraph()], rebuilt);

		expect(Object.keys(rebuilt[0])).toStrictEqual(['a:pPr', 'a:r', 'a:endParaRPr']);
	});

	it('restores the authored a:endParaRPr over the synthesised en-US stub', () => {
		const rebuilt = [rebuiltParagraph('note')];

		preserveNotesParagraphXml([authoredParagraph()], rebuilt);

		expect(rebuilt[0]['a:endParaRPr']).toStrictEqual({ '@_lang': 'en-GB', '@_dirty': '0' });
	});

	it('preserves paragraph properties across an edit that changes the text', () => {
		const rebuilt = [rebuiltParagraph('completely different note')];

		preserveNotesParagraphXml([authoredParagraph()], rebuilt);

		expect((rebuilt[0]['a:pPr'] as XmlObject)['@_algn']).toBe('l');
		expect((rebuilt[0]['a:r'] as XmlObject)['a:t']).toBe('completely different note');
	});

	it('never overwrites paragraph properties the builder produced itself', () => {
		const rebuilt = [rebuiltParagraph('note')];
		rebuilt[0]['a:pPr'] = { '@_algn': 'ctr' };

		preserveNotesParagraphXml([authoredParagraph()], rebuilt);

		expect(rebuilt[0]['a:pPr']).toStrictEqual({ '@_algn': 'ctr' });
	});

	it('never overwrites end-paragraph properties the builder produced itself', () => {
		const rebuilt = [rebuiltParagraph('note')];
		rebuilt[0]['a:endParaRPr'] = { '@_lang': 'ja-JP', '@_sz': '1200' };

		preserveNotesParagraphXml([authoredParagraph()], rebuilt);

		expect(rebuilt[0]['a:endParaRPr']).toStrictEqual({ '@_lang': 'ja-JP', '@_sz': '1200' });
	});

	it('leaves an empty authored a:pPr alone rather than replacing an empty one', () => {
		const original: XmlObject[] = [{ 'a:pPr': {} }];
		const rebuilt = [rebuiltParagraph('note')];

		preserveNotesParagraphXml(original, rebuilt);

		expect(rebuilt[0]['a:pPr']).toStrictEqual({});
	});

	it('matches paragraphs by index and leaves added paragraphs untouched', () => {
		const second = authoredParagraph();
		(second['a:pPr'] as XmlObject)['@_algn'] = 'ctr';
		const rebuilt = [rebuiltParagraph('one'), rebuiltParagraph('two'), rebuiltParagraph('three')];

		preserveNotesParagraphXml([authoredParagraph(), second], rebuilt);

		expect((rebuilt[0]['a:pPr'] as XmlObject)['@_algn']).toBe('l');
		expect((rebuilt[1]['a:pPr'] as XmlObject)['@_algn']).toBe('ctr');
		expect(rebuilt[2]['a:pPr']).toStrictEqual({});
		expect(rebuilt[2]['a:endParaRPr']).toStrictEqual({ '@_lang': 'en-US' });
	});

	it('drops trailing originals when the edit removed paragraphs', () => {
		const rebuilt = [rebuiltParagraph('one')];

		const result = preserveNotesParagraphXml(
			[authoredParagraph(), authoredParagraph(), authoredParagraph()],
			rebuilt,
		);

		expect(result).toHaveLength(1);
	});

	it('tolerates a missing or non-object original paragraph', () => {
		const rebuilt = [rebuiltParagraph('one')];

		expect(() =>
			preserveNotesParagraphXml([undefined as unknown as XmlObject], rebuilt),
		).not.toThrow();
		expect(rebuilt[0]['a:pPr']).toStrictEqual({});
	});
});
