/**
 * End-to-end coverage for editing an existing deck-authored table style
 * through the whole handler (not just the pure per-node merge covered by
 * `table-style-save.test.ts`): load -> edit (all facets, incl. corner cells,
 * borders, cell3D, and table background) -> create a new style -> assign it
 * to a table -> set the default -> delete another style -> save -> re-parse,
 * proving `ppt/tableStyles.xml` round-trips losslessly for every facet the
 * parse side already models (W3-E).
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { PresentationBuilder } from '../../builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../PptxHandler';
import type { ParsedTableStyleMap, PptxData, TablePptxElement } from '../../types';
import { addTableStyleToMap, createTableStyleEntry } from './table-style-editor';

const EXISTING_STYLE_ID = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';

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

describe('table style edit: full load -> edit -> save -> re-parse (W3-E)', () => {
	let handler: PptxHandler;
	let data: PptxData;
	let map: ParsedTableStyleMap;
	let newStyleId: string;
	let toDeleteStyleId: string;

	beforeAll(async () => {
		handler = new PptxHandler();
		data = await handler.load(await buildSeed());

		// The blank-deck seed's tableStyles.xml has NO `a:tblStyle` children
		// (only a dangling `def`), so build the edited map from scratch: one
		// entry re-using the deck's existing (currently nonexistent) default
		// GUID to exercise "create the style the def GUID already claims",
		// one brand-new style to become the new default, and one throwaway
		// style to exercise deletion.
		map = {};
		addTableStyleToMap(
			map,
			createTableStyleEntry(map, {
				styleId: EXISTING_STYLE_ID,
				styleName: 'Custom Whole-Deck Style',
			}),
		);
		const existing = map[EXISTING_STYLE_ID]!;
		existing.wholeTblFill = { schemeColor: 'accent2', tint: 40000 };
		existing.firstRowText = { bold: true, fontSchemeColor: 'lt1' };
		existing.neCellFill = { schemeColor: 'accent3' };
		existing.seCellText = { italic: true };
		existing.wholeTblBorders = {
			left: { width: 1, dash: 'solid', fill: { schemeColor: 'tx1' } },
			tr2bl: { color: '#123456' },
		};
		existing.firstColCell3D = { material: 'metal', bevelWidth: 2, bevelPreset: 'circle' };
		existing.tableBackground = { fillRef: { idx: 2, color: { schemeColor: 'accent1' } } };

		const newStyle = createTableStyleEntry(map, { styleName: 'Brand New Default' });
		newStyleId = newStyle.styleId;
		newStyle.wholeTblFill = { schemeColor: 'accent5' };
		addTableStyleToMap(map, newStyle);

		const throwaway = createTableStyleEntry(map, { styleName: 'Throwaway' });
		toDeleteStyleId = throwaway.styleId;
		addTableStyleToMap(map, throwaway);

		const table = findTable(data);
		table.tableData!.tableStyleId = EXISTING_STYLE_ID;

		const saved = await handler.save(data.slides, {
			tableStyles: map,
			tableStylesDefaultId: newStyleId,
			tableStylesToDelete: [toDeleteStyleId],
		});

		handler = new PptxHandler();
		data = await handler.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
	}, 30_000);

	it('round-trips the edited style with fill, text, corner cells, borders, cell3D, and background', () => {
		const entry = data.tableStyleMap?.[EXISTING_STYLE_ID];
		expect(entry).toBeDefined();
		expect(entry?.styleName).toBe('Custom Whole-Deck Style');
		expect(entry?.wholeTblFill).toStrictEqual({ schemeColor: 'accent2', tint: 40000 });
		expect(entry?.firstRowText).toMatchObject({ bold: true, fontSchemeColor: 'lt1' });
		expect(entry?.neCellFill).toStrictEqual({ schemeColor: 'accent3' });
		expect(entry?.seCellText).toStrictEqual({ italic: true });
		expect(entry?.wholeTblBorders?.left).toMatchObject({
			width: 1,
			dash: 'solid',
			fill: { schemeColor: 'tx1' },
		});
		expect(entry?.wholeTblBorders?.tr2bl).toMatchObject({ color: '#123456' });
		expect(entry?.firstColCell3D).toMatchObject({
			material: 'metal',
			bevelWidth: 2,
			bevelPreset: 'circle',
		});
		expect(entry?.tableBackground?.fillRef).toStrictEqual({
			idx: 2,
			color: { schemeColor: 'accent1' },
		});
	});

	it('persists the brand-new style and sets it as the archive default', () => {
		const entry = data.tableStyleMap?.[newStyleId];
		expect(entry).toBeDefined();
		expect(entry?.styleName).toBe('Brand New Default');
		expect(entry?.wholeTblFill).toStrictEqual({ schemeColor: 'accent5' });
	});

	it('exposes the archive default GUID on PptxData.tableStylesDefaultId', () => {
		expect(data.tableStylesDefaultId).toBe(newStyleId);
	});

	it('deletes the throwaway style', () => {
		expect(data.tableStyleMap?.[toDeleteStyleId]).toBeUndefined();
	});

	it('assigns the table style id onto the existing table element', () => {
		const table = findTable(data);
		expect(table.tableData?.tableStyleId).toBe(EXISTING_STYLE_ID);
	});
});
