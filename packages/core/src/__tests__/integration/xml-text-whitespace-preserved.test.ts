import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import { parseEmbeddedXlsx, preservesXmlWhitespace } from '../../core/utils';

/**
 * The XML layer trimmed EVERY element text node except `<a:t>`, which silently
 * destroyed boundary whitespace in the other OOXML elements whose content is
 * schema-typed as a string rather than as a number, a token or an enum.
 *
 * The witness is `<c:separator>, </c:separator>`: PowerPoint writes the comma
 * AND the space it wants between the parts of a combined data label, so the
 * trim renders `Direct,40%` instead of `Direct, 40%`.
 *
 * The defect is self-concealing in the usual round-trip shape. We trimmed on
 * read and wrote the trimmed value back, so a load -> save -> load comparison of
 * our own model against our own re-parse agreed perfectly; only comparing
 * against the ORIGINAL bytes shows the loss. Both directions are asserted here.
 *
 * `xml:space="preserve"` is NOT a usable signal: it appears zero times across
 * the 49 decks in this repository, including the ones PowerPoint itself wrote,
 * because XML preserves text-node whitespace by default and the attribute only
 * ever overrides an `xml:space="default"` in scope. Trimming has to stay the
 * default for every other element, or the indentation of a pretty-printed part
 * becomes content.
 *
 * @module __tests__/integration/xml-text-whitespace-preserved
 */

const FIXTURES = join(__dirname, '../../../../../e2e/fixtures');

function requireFixture(name: string): Uint8Array {
	const path = join(FIXTURES, name);
	if (!existsSync(path)) {
		throw new Error(`missing fixture ${path}`);
	}
	return new Uint8Array(readFileSync(path));
}

async function partText(bytes: Uint8Array, part: string): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const file = zip.file(part);
	if (!file) {
		throw new Error(`missing part ${part}`);
	}
	return file.async('string');
}

describe('preservesXmlWhitespace', () => {
	it('preserves the string-typed leaf elements', () => {
		expect(
			['a:t', 'c:separator', 'c:v', 'p:text', 'vt:lpstr', 'vt:lpwstr', 'dc:title'].map(
				preservesXmlWhitespace,
			),
		).toStrictEqual([true, true, true, true, true, true, true]);
	});

	it('keeps trimming containers and typed values', () => {
		// `c:title` is a chart-title CONTAINER, not the `dc:title` string: this is
		// exactly why the rule matches qualified names and not local names.
		expect(
			['c:title', 'a:p', 'p:sp', 'Relationship', 'AppVersion', 'c:f'].map(preservesXmlWhitespace),
		).toStrictEqual([false, false, false, false, false, false]);
	});
});

describe('element text whitespace survives a real deck', () => {
	it('keeps the trailing space of a combined data-label separator', async () => {
		const bytes = requireFixture('chart-data-fidelity.pptx');
		// Ground truth: PowerPoint wrote the space.
		await expect(partText(bytes, 'ppt/charts/chart4.xml')).resolves.toContain(
			'<c:separator>, </c:separator>',
		);

		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		const chart = loaded.slides
			.flatMap((slide) => slide.elements)
			.find(
				(element) => element.type === 'chart' && element.chartData?.series[0]?.dataLabelOptions,
			);
		expect(chart?.type).toBe('chart');
		if (chart?.type !== 'chart') {
			return;
		}
		expect(chart.chartData?.series[0]?.dataLabelOptions?.separator).toBe(', ');

		// And it has to reach the saved bytes, not only the in-memory model.
		const saved = await handler.save(loaded.slides);
		await expect(partText(saved, 'ppt/charts/chart4.xml')).resolves.toContain(
			'<c:separator>, </c:separator>',
		);
	});

	it('keeps an xml:space="preserve" shared string in an embedded chart workbook', async () => {
		// Ground truth first: Excel really does stamp xml:space on a
		// whitespace-bearing label, and three decks in this repo carry one.
		const deck = await JSZip.loadAsync(requireFixture('issue-132-hr-deck.pptx'));
		const embedded = deck.file('ppt/embeddings/Workbook1.xlsx');
		expect(embedded, 'fixture must carry an embedded chart workbook').not.toBeNull();
		const inner = await JSZip.loadAsync(await embedded!.async('uint8array'));
		await expect(inner.file('xl/sharedStrings.xml')!.async('string')).resolves.toContain(
			'<t xml:space="preserve"> </t>',
		);

		// That deck spends its preserved string on the unused A1 corner, so the
		// assertion uses the same markup in a category cell, where the loss is
		// observable through the public parse result.
		const book = new JSZip();
		book.file(
			'xl/sharedStrings.xml',
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2">' +
				'<si><t>Revenue</t></si><si><t xml:space="preserve">Q1 </t></si></sst>',
		);
		book.file(
			'xl/worksheets/sheet1.xml',
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
				'<row r="1"><c r="B1" t="s"><v>0</v></c></row>' +
				'<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>42</v></c></row>' +
				'</sheetData></worksheet>',
		);
		const parsed = await parseEmbeddedXlsx(await book.generateAsync({ type: 'uint8array' }));
		expect(parsed?.categories).toStrictEqual(['Q1 ']);
		expect(parsed?.series).toStrictEqual([{ name: 'Revenue', values: [42] }]);
	});

	it('writes boundary whitespace back to a core-property string', async () => {
		const source = requireFixture('sample-deck.pptx');
		const zip = await JSZip.loadAsync(source);
		const core = await partText(source, 'docProps/core.xml');
		const patched = core.replace(
			/<dc:title>[^<]*<\/dc:title>/u,
			'<dc:title>  Quarterly Report </dc:title>',
		);
		expect(patched, 'fixture must carry a dc:title to patch').not.toBe(core);
		zip.file('docProps/core.xml', patched);
		const bytes = await zip.generateAsync({ type: 'uint8array' });

		const handler = new PptxHandler();
		const loaded = await handler.load(bytes.buffer as ArrayBuffer);
		// `core.xml` is re-parsed and rebuilt on EVERY save (revision bump,
		// modified timestamp), so the parser's trim used to rewrite the author's
		// title on a save that changed nothing. The public `metadata.title`
		// getter normalises separately and deliberately; the BYTES are what this
		// asserts.
		const saved = await handler.save(loaded.slides);
		await expect(partText(saved, 'docProps/core.xml')).resolves.toContain(
			'<dc:title>  Quarterly Report </dc:title>',
		);
	});
});
