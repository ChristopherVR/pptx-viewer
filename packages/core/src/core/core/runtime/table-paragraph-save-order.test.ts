import { describe, expect, it } from 'vitest';

import type { PptxTableCellTextRun, XmlObject } from '../../types';
import { PptxRuntimeDependencyFactory } from '../factories/PptxRuntimeDependencyFactory';
import {
	recordTableParagraphOrder,
	withOrderedTableParagraphs,
} from './table-paragraph-save-order';

const runs: PptxTableCellTextRun[] = [
	{ text: 'Page ' },
	{ text: '1', isField: true },
	{ text: '', isLineBreak: true },
	{ text: 'of 10' },
];

function fixture() {
	const paragraph: XmlObject = {
		'a:r': [{ 'a:t': 'Page ' }, { 'a:t': 'of 10' }],
		'a:fld': { '@_id': 'page', '@_type': 'slidenum', 'a:t': '1' },
		'a:br': '',
		'a:endParaRPr': { '@_lang': 'en-US' },
		// Styling may add pPr after the content. Save must use schema order.
		'a:pPr': { '@_algn': 'ctr' },
	};
	const cell: XmlObject = { 'a:txBody': { 'a:p': paragraph } };
	return { paragraph, cell };
}

describe('table paragraph save order', () => {
	it('uses the actual cached parse for untouched tables, without changing other paragraphs', () => {
		const factory = new PptxRuntimeDependencyFactory();
		const xml =
			'<a:p><a:r><a:t>Page </a:t></a:r><a:fld type="slidenum"><a:t>1</a:t></a:fld><a:r><a:t> of 10</a:t></a:r></a:p>';
		const parsed = factory
			.createParser()
			.parse(
				`<part><shape>${xml}</shape><a:tbl><a:tr><a:tc><a:txBody>${xml}</a:txBody></a:tc></a:tr></a:tbl></part>`,
			) as XmlObject;
		const before = structuredClone(parsed);
		const ordered = withOrderedTableParagraphs(parsed);
		expect(parsed).toStrictEqual(before);
		expect((ordered.part as XmlObject).shape).toBe((parsed.part as XmlObject).shape);
		const saved = factory.createBuilder().build(ordered);
		const table = saved.slice(saved.indexOf('<a:tbl'));
		expect(table.indexOf('Page ')).toBeLessThan(table.indexOf('slidenum'));
		expect(table.indexOf('slidenum')).toBeLessThan(table.indexOf(' of 10'));
	});

	it('does not apply stale cached source order after raw content changes', () => {
		const factory = new PptxRuntimeDependencyFactory();
		const parsed = factory
			.createParser()
			.parse(
				'<a:tbl><a:p><a:r><a:t>A</a:t></a:r><a:br/><a:r><a:t>B</a:t></a:r></a:p></a:tbl>',
			) as XmlObject;
		const paragraph = (parsed['a:tbl'] as XmlObject)['a:p'] as XmlObject;
		paragraph['a:r'] = [{ 'a:t': 'A' }, { 'a:t': 'B' }, { 'a:t': 'C' }];
		expect(withOrderedTableParagraphs(parsed)).toBe(parsed);
	});

	it('orders existing nodes only on a serialization copy and leaves cached XML readable', () => {
		const { paragraph, cell } = fixture();
		const untouched = { 'a:p': { 'a:r': { 'a:t': 'Plain' } } };
		const part = { tables: [cell], untouched };
		const before = structuredClone(part);
		recordTableParagraphOrder(cell, runs);
		const ordered = withOrderedTableParagraphs(part);
		expect(part).toStrictEqual(before);
		expect(ordered).not.toBe(part);
		expect(ordered.untouched).toBe(untouched);
		const result = (ordered.tables[0]['a:txBody'] as XmlObject)['a:p'] as XmlObject;
		expect(Object.keys(result)).toStrictEqual([
			'a:pPr',
			'a:r',
			'a:fld',
			'a:br',
			'a:r#pptx-order-3',
			'a:endParaRPr',
		]);
		expect(result['a:fld']).toBe(paragraph['a:fld']);
		expect(result['a:br']).toBe('');
		expect(result['a:r']).toBe((paragraph['a:r'] as XmlObject[])[0]);
		const xml = new PptxRuntimeDependencyFactory().createBuilder().build(ordered);
		expect(xml).not.toContain('#pptx-order-');
		expect(xml.indexOf('Page ')).toBeLessThan(xml.indexOf('slidenum'));
		expect(xml.indexOf('slidenum')).toBeLessThan(xml.indexOf('<a:br'));
		expect(xml.indexOf('<a:br')).toBeLessThan(xml.indexOf('of 10'));
		expect(withOrderedTableParagraphs(part)).toStrictEqual(ordered);
	});

	it.each([
		[
			'missing run',
			(p: XmlObject) => {
				p['a:r'] = [{ 'a:t': 'Page ' }];
			},
		],
		[
			'changed text',
			(p: XmlObject) => {
				(p['a:fld'] as XmlObject)['a:t'] = '2';
			},
		],
		[
			'extra field',
			(p: XmlObject) => {
				p['a:fld'] = [p['a:fld'], { 'a:t': '1' }];
			},
		],
		[
			'inline math',
			(p: XmlObject) => {
				p['m:oMath'] = {};
			},
		],
		[
			'alternate content',
			(p: XmlObject) => {
				p['mc:AlternateContent'] = {};
			},
		],
		[
			'unexpected text',
			(p: XmlObject) => {
				p['#text'] = 'unmodelled';
			},
		],
	] as const)('does not guess an order for %s', (_label, mutate) => {
		const { paragraph, cell } = fixture();
		mutate(paragraph);
		recordTableParagraphOrder(cell, runs);
		expect(withOrderedTableParagraphs(cell)).toBe(cell);
	});

	it('does not reuse a previous registration when runs are invalidated by an edit', () => {
		const { cell } = fixture();
		recordTableParagraphOrder(cell, runs);
		expect(withOrderedTableParagraphs(cell)).not.toBe(cell);
		recordTableParagraphOrder(cell, undefined);
		expect(withOrderedTableParagraphs(cell)).toBe(cell);
	});

	it('requires the same paragraph count and does not shift content across empty paragraphs', () => {
		const { paragraph, cell } = fixture();
		(cell['a:txBody'] as XmlObject)['a:p'] = [{}, paragraph, {}];
		recordTableParagraphOrder(cell, runs);
		expect(withOrderedTableParagraphs(cell)).toBe(cell);
		recordTableParagraphOrder(cell, [
			{ text: '', isParagraphBreak: true },
			...runs,
			{ text: '', isParagraphBreak: true },
		]);
		const ordered = withOrderedTableParagraphs(cell);
		expect(ordered).not.toBe(cell);
		const paragraphs = (ordered['a:txBody'] as XmlObject)['a:p'] as XmlObject[];
		expect(paragraphs).toHaveLength(3);
		expect(paragraphs[0]).toStrictEqual({});
		expect(paragraphs[2]).toStrictEqual({});
	});

	it('keeps grouped content and unsupported or absent run metadata untouched', () => {
		const { cell } = fixture();
		recordTableParagraphOrder(cell, [runs[0], runs[3], runs[1], runs[2]]);
		expect(withOrderedTableParagraphs(cell)).toBe(cell);
		recordTableParagraphOrder(
			cell,
			runs.map(({ text, isLineBreak }) => ({ text, isLineBreak })),
		);
		expect(withOrderedTableParagraphs(cell)).toBe(cell);
		expect(withOrderedTableParagraphs({})).toStrictEqual({});
	});
});
