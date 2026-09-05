/**
 * Load -> edit -> save -> re-parse coverage for `a:tblPr`'s OWN fill /
 * `effectLst` (issue G6, write side). Proves an in-memory edit to
 * `PptxTableData.tableFill` / `.tableEffects` actually reaches the saved
 * file, and that a subsequent save (with those fields re-populated purely
 * by parsing the file just written) keeps reproducing the same XML.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { PresentationBuilder } from '../../builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../PptxHandler';
import type { PptxData, TablePptxElement } from '../../types';

function findTable(data: PptxData): TablePptxElement {
	const el = data.slides[0]!.elements.find((e) => e.type === 'table');
	if (!el || el.type !== 'table') {
		throw new Error('table not found');
	}
	return el;
}

async function buildSeed(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create({ initialSlideCount: 0 });
	const slide = createSlide('Blank')
		.addTable({
			rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }, { cells: [{ text: 'C' }, { text: 'D' }] }],
		})
		.build();
	data.slides.push(slide);
	const seed = await handler.save(data.slides);
	return seed.buffer.slice(seed.byteOffset, seed.byteOffset + seed.byteLength) as ArrayBuffer;
}

describe('a:tblPr own fill/effectLst: load -> edit -> save -> re-parse', () => {
	let firstSaveData: PptxData;
	let firstSaveHandler: PptxHandler;

	beforeAll(async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildSeed());

		// A freshly-created table has no own fill/effects (asserted by the
		// 'leaves an untouched table' case below); give the model some here.
		const table = findTable(data);
		table.tableData!.tableFill = { schemeColor: '', color: '#ff8800' };
		table.tableData!.tableEffects = [
			{
				kind: 'outerShdw',
				xml: {
					'@_blurRad': '40000',
					'@_dist': '20000',
					'@_dir': '5400000',
					'a:srgbClr': { '@_val': '000000', 'a:alpha': { '@_val': '40000' } },
				},
			},
		];

		const saved = await handler.save(data.slides);
		firstSaveHandler = new PptxHandler();
		firstSaveData = await firstSaveHandler.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
	});

	it('re-parses the edited own fill', () => {
		const table = findTable(firstSaveData);
		expect(table.tableData?.tableFill).toStrictEqual({ schemeColor: '', color: '#ff8800' });
	});

	it('re-parses the edited own effect chain', () => {
		const table = findTable(firstSaveData);
		expect(table.tableData?.tableEffects).toStrictEqual([
			{
				kind: 'outerShdw',
				xml: {
					'@_blurRad': '40000',
					'@_dist': '20000',
					'@_dir': '5400000',
					'a:srgbClr': { '@_val': '000000', 'a:alpha': { '@_val': '40000' } },
				},
			},
		]);
	});

	it('keeps reproducing the same fill/effects on a further save with no explicit edit', async () => {
		// tableFill/tableEffects on `firstSaveData`'s table were populated purely
		// by re-parsing the file just written, not by a fresh assignment; saving
		// again must not drop them (preserve-on-present, not preserve-on-absent).
		const saved = await firstSaveHandler.save(firstSaveData.slides);
		const rereloaded = new PptxHandler();
		const data = await rereloaded.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const table = findTable(data);
		expect(table.tableData?.tableFill).toStrictEqual({ schemeColor: '', color: '#ff8800' });
		expect(table.tableData?.tableEffects?.[0]?.kind).toBe('outerShdw');
	});

	it('leaves an untouched table with no own fill/effects', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildSeed());
		const table = findTable(data);
		// Only touch cell text, never tableFill/tableEffects.
		table.tableData!.rows[0]!.cells[0]!.text = 'Z';
		const saved = await handler.save(data.slides);
		const reloaded = new PptxHandler();
		const reparsed = await reloaded.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const table2 = findTable(reparsed);
		expect(table2.tableData?.tableFill).toBeFalsy();
		expect(table2.tableData?.tableEffects).toBeFalsy();
	});
});
