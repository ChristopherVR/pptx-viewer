import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyModernCommentText, flattenBodyText } from './modern-comment-text-body';

/** A mention run (bold) followed by ordinary prose, as PowerPoint writes it. */
const mentionBody = (): XmlObject => ({
	'a:bodyPr': {},
	'a:lstStyle': {},
	'a:p': {
		'a:r': [
			{ 'a:rPr': { '@_lang': 'en-US', '@_b': '1' }, 'a:t': '@Jane Doe' },
			{ 'a:rPr': { '@_lang': 'en-US' }, 'a:t': ' please review the numbers' },
		],
	},
});

describe('modern comment txBody text splice', () => {
	it('returns the original body untouched when the text is unchanged', () => {
		const body = mentionBody();
		expect(applyModernCommentText(body, '@Jane Doe please review the numbers')).toBe(body);
	});

	it('keeps every run and its properties when text is appended', () => {
		const result = applyModernCommentText(
			mentionBody(),
			'@Jane Doe please review the numbers today',
		);
		const runs = ((result['a:p'] as XmlObject)['a:r'] as XmlObject[]) ?? [];
		expect(runs).toHaveLength(2);
		expect(runs[0]).toStrictEqual({
			'a:rPr': { '@_lang': 'en-US', '@_b': '1' },
			'a:t': '@Jane Doe',
		});
		expect(runs[1]['a:t']).toBe(' please review the numbers today');
		expect(runs[1]['a:rPr']).toStrictEqual({ '@_lang': 'en-US' });
	});

	it('keeps the trailing run when text is inserted at the head', () => {
		const result = applyModernCommentText(mentionBody(), 'Hi @Jane Doe please review the numbers');
		const runs = ((result['a:p'] as XmlObject)['a:r'] as XmlObject[]) ?? [];
		expect(runs[0]['a:t']).toBe('Hi @Jane Doe');
		expect(runs[0]['a:rPr']).toStrictEqual({ '@_lang': 'en-US', '@_b': '1' });
		expect(runs[1]['a:t']).toBe(' please review the numbers');
	});

	it('rewrites only the edited paragraph of a multi-line body', () => {
		const body: XmlObject = {
			'a:bodyPr': {},
			'a:p': [
				{ 'a:r': { 'a:rPr': { '@_b': '1' }, 'a:t': 'first' } },
				{ 'a:r': { 'a:rPr': { '@_i': '1' }, 'a:t': 'second' } },
			],
		};
		const result = applyModernCommentText(body, 'first\nsecond line');
		const paragraphs = result['a:p'] as XmlObject[];
		expect(paragraphs[0]).toStrictEqual({ 'a:r': { 'a:rPr': { '@_b': '1' }, 'a:t': 'first' } });
		expect((paragraphs[1]['a:r'] as XmlObject)['a:t']).toBe('second line');
		expect((paragraphs[1]['a:r'] as XmlObject)['a:rPr']).toStrictEqual({ '@_i': '1' });
	});

	it('adds and drops paragraphs as lines are added and removed', () => {
		const body: XmlObject = { 'a:p': { 'a:r': { 'a:rPr': { '@_b': '1' }, 'a:t': 'only' } } };
		const grown = applyModernCommentText(body, 'only\nextra');
		expect(flattenBodyText(grown)).toStrictEqual(['only', 'extra']);

		const shrunk = applyModernCommentText(grown, 'only');
		expect(flattenBodyText(shrunk)).toStrictEqual(['only']);
	});

	it('builds a plain body when there is no original to preserve', () => {
		const result = applyModernCommentText(undefined, 'one\ntwo');
		expect(flattenBodyText(result)).toStrictEqual(['one', 'two']);
	});

	it('replaces the whole text when nothing is in common', () => {
		const result = applyModernCommentText(mentionBody(), 'totally different');
		expect(flattenBodyText(result)).toStrictEqual(['totally different']);
	});
});
