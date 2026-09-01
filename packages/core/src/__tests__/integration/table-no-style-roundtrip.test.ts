import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { TablePptxElement } from '../../core/types/elements';

const DEFAULT_STYLE_TAG = '<a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>';

/**
 * Build a deck whose single table carries NO `<a:tableStyleId>` at all, the
 * way PowerPoint writes a table styled "No Style, No Grid". The SDK seeds
 * the default style on creation, so strip it from the saved slide XML to
 * get the fixture.
 */
async function buildDeckWithUnstyledTable(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(
		createSlide('Blank')
			.addTable(
				{
					rows: [
						{ cells: [{ text: 'A' }, { text: 'B' }] },
						{ cells: [{ text: 'c' }, { text: 'd' }] },
					],
				},
				{ x: 20, y: 20, width: 400, height: 120 },
			)
			.build(),
	);
	const saved = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(saved);
	const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
	expect(slideXml, 'fixture precondition: SDK table carries the default style').toContain(
		DEFAULT_STYLE_TAG,
	);
	zip.file('ppt/slides/slide1.xml', slideXml.replace(DEFAULT_STYLE_TAG, ''));
	return zip.generateAsync({ type: 'uint8array' });
}

/**
 * W1-D regression: saving used to inject "Medium Style 2 - Accent 1" onto
 * every table that lacked `<a:tableStyleId>`, including untouched loaded
 * tables that legitimately have no style. The default is now a
 * creation-time decision only.
 */
describe('table with no tableStyleId round-trips unchanged (W1-D)', () => {
	it('an untouched loaded table stays without <a:tableStyleId> after save', async () => {
		const fixture = await buildDeckWithUnstyledTable();

		const handler = new PptxHandler();
		const loaded = await handler.load(fixture.buffer as ArrayBuffer);
		const table = loaded.slides[0].elements.find((e) => e.type === 'table') as
			| TablePptxElement
			| undefined;
		expect(table, 'fixture table did not load').toBeDefined();
		expect(table!.tableData?.tableStyleId).toBeUndefined();

		const resaved = await handler.save(loaded.slides);
		const zip = await JSZip.loadAsync(resaved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain('<a:tbl');
		expect(slideXml).not.toContain('<a:tableStyleId>');
		expect(slideXml).not.toContain('5C22544A-7EE6-4342-B048-85BDC9FD1C3A');
	});

	it('an edited loaded table still does not gain a style it never had', async () => {
		const fixture = await buildDeckWithUnstyledTable();
		const handler = new PptxHandler();
		const loaded = await handler.load(fixture.buffer as ArrayBuffer);
		const table = loaded.slides[0].elements.find((e) => e.type === 'table') as TablePptxElement;
		table.tableData!.rows[1].cells[0].text = 'edited';
		table.tableData!.bandedRows = true;

		const resaved = await handler.save(loaded.slides);
		const zip = await JSZip.loadAsync(resaved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain('edited');
		expect(slideXml).toMatch(/<a:tblPr\b[^>]*\bbandRow="1"/);
		expect(slideXml).not.toContain('<a:tableStyleId>');
	});

	it('a table created through the SDK still gets the default style', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addTable({ rows: [{ cells: [{ text: 'x' }] }] }, { x: 10, y: 10, width: 200, height: 60 })
				.build(),
		);
		const table = data.slides[0].elements.find((e) => e.type === 'table') as TablePptxElement;
		expect(table.tableData?.tableStyleId).toBe('{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}');

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain(DEFAULT_STYLE_TAG);
	});
});
