import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { PptxRuntimeDependencyFactory } from '../factories/PptxRuntimeDependencyFactory';
import { paragraphContentEntries } from './paragraph-sibling-order';

/**
 * Order restoration for parsed `a:p` content: an inline `a:fld` (or `a:br`)
 * must keep the position it was authored in, even though fast-xml-parser
 * collapses same-tag siblings under one key and so reports the paragraph
 * grouped by tag.
 */

const factory = new PptxRuntimeDependencyFactory();

const CONTENT_TAGS: ReadonlySet<string> = new Set([
	'a:r',
	'a:fld',
	'a:t',
	'a14:m',
	'm:oMathPara',
	'm:oMath',
	'mc:AlternateContent',
	'a:br',
]);

function ensureArray(value: unknown): unknown[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

/** Parse a slide fragment through the runtime parser (annotators included). */
function parseParagraph(paragraphXml: string): XmlObject {
	const parsed = factory.createParser().parse(`<p:sp><p:txBody>${paragraphXml}</p:txBody></p:sp>`);
	return ((parsed as XmlObject)['p:sp'] as XmlObject)['p:txBody'] as XmlObject;
}

/** The `[tag, text]` sequence a paragraph's content children resolve to. */
function contentSequence(txBody: XmlObject): Array<[string, string]> {
	const paragraph = txBody['a:p'] as XmlObject;
	const { entries } = paragraphContentEntries(paragraph, CONTENT_TAGS, ensureArray);
	return entries.map(([tag, item]) => [tag, String((item as XmlObject)?.['a:t'] ?? '')]);
}

const RUN = (text: string): string => `<a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r>`;
const FLD = (type: string, cached: string): string =>
	`<a:fld id="{1}" type="${type}"><a:rPr lang="en-US"/><a:t>${cached}</a:t></a:fld>`;

describe('paragraph sibling order', () => {
	it('replays an inline field in the position it was authored in', () => {
		// The shape every deck with a "Slide N - Title" footer has: literal,
		// field, literal, field. Grouped by tag this reads "Slide  - #Title".
		const txBody = parseParagraph(
			`<a:p>${RUN('Slide ')}${FLD('slidenum', '#')}${RUN(' - ')}${FLD('slidetitle', 'Title')}</a:p>`,
		);
		expect(contentSequence(txBody)).toStrictEqual([
			['a:r', 'Slide '],
			['a:fld', '#'],
			['a:r', ' - '],
			['a:fld', 'Title'],
		]);
	});

	it('replays a soft line break between the runs it separates', () => {
		const txBody = parseParagraph(`<a:p>${RUN('one')}<a:br/>${RUN('two')}</a:p>`);
		expect(contentSequence(txBody).map(([tag]) => tag)).toStrictEqual(['a:r', 'a:br', 'a:r']);
	});

	it('reports a grouped paragraph as unauthored so callers keep their fallback', () => {
		const txBody = parseParagraph(`<a:p>${RUN('a')}${RUN('b')}${FLD('slidenum', '#')}</a:p>`);
		const paragraph = txBody['a:p'] as XmlObject;
		const { entries, authored } = paragraphContentEntries(paragraph, CONTENT_TAGS, ensureArray);
		// Grouped by tag already: key iteration is correct, nothing recorded.
		expect(authored).toBeFalsy();
		expect(entries.map(([tag]) => tag)).toStrictEqual(['a:r', 'a:r', 'a:fld']);
	});

	it('resolves each paragraph against its own order when several are mixed', () => {
		const txBody = parseParagraph(
			`<a:p>${FLD('slidenum', '#')}${RUN(' of N')}</a:p>` +
				`<a:p>${RUN('Slide ')}${FLD('slidenum', '#')}${RUN('!')}</a:p>`,
		);
		const paragraphs = txBody['a:p'] as unknown as XmlObject[];
		const sequence = (paragraph: XmlObject): string[] =>
			paragraphContentEntries(paragraph, CONTENT_TAGS, ensureArray).entries.map(([tag]) => tag);
		// The first is grouped (field then run) and needs no correction; the
		// second is interleaved and must not inherit the first one's order.
		expect(sequence(paragraphs[0]!)).toStrictEqual(['a:fld', 'a:r']);
		expect(sequence(paragraphs[1]!)).toStrictEqual(['a:r', 'a:fld', 'a:r']);
	});

	it('leaves a paragraph the annotator never saw on key iteration', () => {
		// SDK-built paragraphs never pass through the parser, so there is no
		// recorded order and the caller must still get every child.
		const paragraph: XmlObject = {
			'a:r': [{ 'a:t': 'a' }, { 'a:t': 'b' }],
			'a:fld': { 'a:t': '#' },
		};
		const { entries, authored } = paragraphContentEntries(paragraph, CONTENT_TAGS, ensureArray);
		expect(authored).toBeFalsy();
		expect(entries).toHaveLength(3);
	});
});
