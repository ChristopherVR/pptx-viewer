import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { updateMergeAttrsInRawXml } from '../../core/core';
import { rebuildTableStructureInRawXml } from '../../core/core/runtime/table-cell-rawxml-ops';
import type { TableStructureEdit } from '../../core/core/runtime/table-cell-rawxml-ops';
import { PptxHandler } from '../../core/PptxHandler';
import type { TablePptxElement } from '../../core/types/elements';

const RICH_CELL_BODY =
	'<a:txBody><a:bodyPr/><a:lstStyle/><a:p>' +
	'<a:r><a:rPr lang="en-US" b="1"/><a:t>Rich</a:t></a:r>' +
	'<a:fld id="{AAAA0000-0000-4000-A000-000000000001}" type="slidenum"><a:rPr/><a:t>1</a:t></a:fld>' +
	'<a:r><a:rPr lang="en-US" i="1"/><a:t>Text</a:t></a:r>' +
	'<a:endParaRPr lang="en-US"/></a:p></a:txBody>';

async function buildDeckWithRichTableCell(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(
		createSlide('Blank')
			.addTable(
				{
					rows: [
						{ cells: [{ text: 'A' }, { text: 'B' }] },
						{ cells: [{ text: 'RichText1' }, { text: '' }] },
					],
				},
				{ x: 20, y: 20, width: 400, height: 120 },
			)
			.build(),
	);
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	const path = 'ppt/slides/slide1.xml';
	const xml = await zip.file(path)!.async('string');
	const richBody =
		/<a:txBody>(?:(?!<\/a:txBody>)[\s\S])*?<a:t>RichText1<\/a:t>(?:(?!<\/a:txBody>)[\s\S])*?<\/a:txBody>/;
	expect(xml, 'fixture precondition: rich-cell marker body').toMatch(richBody);
	zip.file(path, xml.replace(richBody, RICH_CELL_BODY));
	return zip.generateAsync({ type: 'uint8array' });
}

const ATTRIBUTED_CELL_BODY =
	'<a:txBody><a:bodyPr/><a:lstStyle/><a:p>' +
	'<a:r><a:rPr lang="en-US" b="1"/><a:t xml:space="preserve"> Lead </a:t></a:r>' +
	'<a:fld id="{AAAA0000-0000-4000-A000-000000000001}" type="slidenum"><a:rPr/><a:t xml:space="preserve"> Field </a:t></a:fld>' +
	'<a:r><a:rPr lang="en-US" i="1"/><a:t xml:space="preserve"> Tail </a:t></a:r>' +
	'<a:endParaRPr lang="en-US"/></a:p></a:txBody>';

async function buildDeckWithAttributedTableCell(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PresentationBuilder.create();
	data.slides.push(
		createSlide('Blank')
			.addTable(
				{ rows: [{ cells: [{ text: 'AttributedFixture' }] }] },
				{ x: 20, y: 20, width: 400, height: 80 },
			)
			.build(),
	);
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	const path = 'ppt/slides/slide1.xml';
	const xml = await zip.file(path)!.async('string');
	const fixtureBody =
		/<a:txBody>(?:(?!<\/a:txBody>)[\s\S])*?<a:t>AttributedFixture<\/a:t>(?:(?!<\/a:txBody>)[\s\S])*?<\/a:txBody>/;
	expect(xml, 'fixture precondition: attributed-cell marker body').toMatch(fixtureBody);
	zip.file(path, xml.replace(fixtureBody, ATTRIBUTED_CELL_BODY));
	return zip.generateAsync({ type: 'uint8array' });
}

/**
 * Regression test for SDK-created tables being silently dropped on save.
 *
 * Before the fix, `SlideBuilder.addTable(...)` produced a `TablePptxElement`
 * with no `rawXml`. The save pipeline's `processSlideElement` only had
 * fallback XML creators for `text`/`shape`/`connector`/`ink` — tables hit
 * the "can't serialize" branch and were skipped entirely with a
 * `SAVE_ELEMENT_SKIPPED` warning. The saved slide had an empty `p:spTree`.
 */
describe('sDK-created table survives save round-trip', () => {
	it('preserves attributed rich text after a non-text table edit', async () => {
		let handler = new PptxHandler();
		let loaded = await handler.load(
			(await buildDeckWithAttributedTableCell()).buffer as ArrayBuffer,
		);
		let table = loaded.slides[0].elements.find(
			(element) => element.type === 'table',
		) as TablePptxElement;
		const cell = table.tableData!.rows[0].cells[0];

		// Keep the established flat-cell policy (runs first, then fields), while
		// the rich run model retains the authored run/field/run order.
		expect(cell.text).toBe(' Lead  Tail  Field ');
		expect(cell.textRuns).toStrictEqual([
			{ text: ' Lead ', bold: true },
			{ text: ' Field ', isField: true },
			{ text: ' Tail ', italic: true },
		]);

		table.x += 1;
		const saved = await handler.save(loaded.slides);
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		const lead = slideXml.indexOf('<a:t xml:space="preserve"> Lead </a:t>');
		const field = slideXml.indexOf('<a:t xml:space="preserve"> Field </a:t>');
		const tail = slideXml.indexOf('<a:t xml:space="preserve"> Tail </a:t>');
		expect(lead).toBeGreaterThan(-1);
		expect(field).toBeGreaterThan(lead);
		expect(tail).toBeGreaterThan(field);

		handler = new PptxHandler();
		loaded = await handler.load(saved.buffer as ArrayBuffer);
		table = loaded.slides[0].elements.find(
			(element) => element.type === 'table',
		) as TablePptxElement;
		expect(table.tableData!.rows[0].cells[0]).toMatchObject({
			text: ' Lead  Tail  Field ',
			textRuns: [
				{ text: ' Lead ', bold: true },
				{ text: ' Field ', isField: true },
				{ text: ' Tail ', italic: true },
			],
		});
	});

	it('still replaces attributed rich text after a genuine cell edit', async () => {
		const handler = new PptxHandler();
		const loaded = await handler.load(
			(await buildDeckWithAttributedTableCell()).buffer as ArrayBuffer,
		);
		const table = loaded.slides[0].elements.find(
			(element) => element.type === 'table',
		) as TablePptxElement;
		const cell = table.tableData!.rows[0].cells[0];
		cell.text = 'Edited table text';
		delete cell.textRuns;

		const saved = await handler.save(loaded.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedTable = reloaded.slides[0].elements.find(
			(element) => element.type === 'table',
		) as TablePptxElement;
		expect(reloadedTable.tableData!.rows[0].cells[0].text).toBe('Edited table text');
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain('<a:t>Edited table text</a:t>');
		expect(slideXml).not.toContain(' Lead ');
		expect(slideXml).not.toContain(' Field ');
		expect(slideXml).not.toContain(' Tail ');
	});

	it.each(
		(['row', 'column'] as const).flatMap((axis) =>
			(['insert', 'delete'] as const).flatMap((action) =>
				[0, 1, action === 'insert' ? 3 : 2].map((index) => ({ axis, action, index })),
			),
		),
	)(
		'preserves rich surviving cells after $axis $action at $index',
		async (edit: TableStructureEdit) => {
			const { handler: creator, data, createSlide } = await PresentationBuilder.create();
			data.slides.push(
				createSlide('Blank')
					.addTable(
						{
							rows: Array.from({ length: 3 }, () => ({
								height: 40,
								cells: Array.from({ length: 3 }, () => ({ text: 'Rich text' })),
							})),
						},
						{ x: 20, y: 80, width: 400, height: 240 },
					)
					.build(),
			);
			const initial = await creator.save(data.slides);
			const handler = new PptxHandler();
			const loaded = await handler.load(initial.buffer as ArrayBuffer);
			const table = loaded.slides[0].elements.find((element) => element.type === 'table')!;
			const rows = table.rawXml!['a:graphic']['a:graphicData']['a:tbl']['a:tr'];
			for (const row of rows) {
				for (const cell of row['a:tc']) {
					cell['a:txBody']['a:p'] = {
						'a:r': [
							{ 'a:rPr': { '@_b': '1' }, 'a:t': 'Rich ' },
							{ 'a:rPr': { '@_i': '1' }, 'a:t': 'text' },
						],
					};
				}
			}
			table.x += 1;
			const richFixture = await handler.save(loaded.slides);
			const editor = new PptxHandler();
			const edited = await editor.load(richFixture.buffer as ArrayBuffer);
			const source = edited.slides[0].elements.find((element) => element.type === 'table')!;
			const expectedRuns = source.tableData!.rows[0].cells[0].textRuns;
			expect(expectedRuns).toStrictEqual(
				expect.arrayContaining([
					expect.objectContaining({ text: 'Rich ', bold: true }),
					expect.objectContaining({ text: 'text', italic: true }),
				]),
			);
			const next = structuredClone(source.tableData!);
			if (edit.axis === 'row') {
				if (edit.action === 'insert') {
					next.rows.splice(edit.index, 0, {
						height: 40,
						cells: Array.from({ length: 3 }, () => ({ text: '' })),
					});
				} else {
					next.rows.splice(edit.index, 1);
				}
			} else {
				for (const row of next.rows) {
					if (edit.action === 'insert') {
						row.cells.splice(edit.index, 0, { text: '' });
					} else {
						row.cells.splice(edit.index, 1);
					}
				}
				next.columnWidths = Array.from({ length: edit.action === 'insert' ? 4 : 2 }, () =>
					edit.action === 'insert' ? 0.25 : 0.5,
				);
			}
			const rawXml = rebuildTableStructureInRawXml(source, next, edit);
			Object.assign(source, { tableData: next, rawXml });
			const saved = await editor.save(edited.slides);
			const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
			const result = reloaded.slides[0].elements.find(
				(element) => element.type === 'table',
			)!.tableData!;
			expect(result.rows).toHaveLength(next.rows.length);
			expect(result.columnWidths).toHaveLength(next.columnWidths.length);
			for (const [r, row] of result.rows.entries()) {
				for (const [c, cell] of row.cells.entries()) {
					const inserted = edit.action === 'insert' && (edit.axis === 'row' ? r : c) === edit.index;
					expect(cell.text).toBe(inserted ? '' : 'Rich text');
					if (!inserted) {
						expect(cell.textRuns).toStrictEqual(expectedRuns);
					}
				}
			}
		},
	);

	it.each([
		'no edit',
		'other shape',
		'cell text',
		'row height',
		'add row',
		'delete row',
		'add column',
		'delete column',
	])('preserves row-height precision through load/save after %s', async (edit) => {
		const emuPerPx = 9525;
		const expectedHeights = [825500, 370840, 914400];
		const { handler: creator, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addText('Title', { x: 20, y: 10, width: 300, height: 40 })
				.addTable(
					{
						rows: expectedHeights.map((height, index) => ({
							height: height / emuPerPx,
							cells: [{ text: `Row ${index}` }, { text: 'Value' }],
						})),
					},
					{ x: 20, y: 80, width: 400, height: 240 },
				)
				.build(),
		);
		const fixture = await creator.save(data.slides);
		const handler = new PptxHandler();
		const loaded = await handler.load(fixture.buffer as ArrayBuffer);
		const title = loaded.slides[0].elements.find(
			(element) => element.type === 'text' && element.text === 'Title',
		)!;
		const table = loaded.slides[0].elements.find((element) => element.type === 'table')!;
		const tableData = table.tableData!;

		switch (edit) {
			case 'other shape':
				title.x += 10;
				break;
			case 'cell text':
				tableData.rows[0].cells[0].text = 'Edited cell';
				break;
			case 'row height':
				tableData.rows[0].height = 42.25;
				expectedHeights[0] = Math.round(42.25 * emuPerPx);
				break;
			case 'add row':
				tableData.rows.push({ height: 31.5, cells: [{ text: 'New row' }, { text: 'Value' }] });
				expectedHeights.push(Math.round(31.5 * emuPerPx));
				break;
			case 'delete row':
				tableData.rows.splice(1, 1);
				expectedHeights.splice(1, 1);
				break;
			case 'add column':
				tableData.columnWidths = [1 / 3, 1 / 3, 1 / 3];
				for (const row of tableData.rows) {
					row.cells.push({ text: 'New column' });
				}
				break;
			case 'delete column':
				tableData.columnWidths = [1];
				for (const row of tableData.rows) {
					row.cells.pop();
				}
				break;
		}

		const saved = await handler.save(loaded.slides);
		const zip = await JSZip.loadAsync(saved);
		const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(
			[...xml.matchAll(/<a:tr\b[^>]*\bh="(\d+)"/g)].map((match) => Number(match[1])),
		).toStrictEqual(expectedHeights);
		if (edit === 'cell text') {
			expect(xml).toContain('Edited cell');
		}
		if (edit === 'add row') {
			expect(xml).toContain('New row');
		}
		if (edit === 'add column') {
			expect(xml).toContain('New column');
		}

		const reloader = new PptxHandler();
		const reloaded = await reloader.load(saved.buffer as ArrayBuffer);
		const reloadedTable = reloaded.slides[0].elements.find((element) => element.type === 'table')!;
		expect(
			reloadedTable.tableData!.rows.map((row) => Math.round(row.height! * emuPerPx)),
		).toStrictEqual(expectedHeights);
		if (edit === 'other shape') {
			expect(
				reloaded.slides[0].elements.find(
					(element) => element.type === 'text' && element.text === 'Title',
				)!.x,
			).toBe(title.x);
		}
		if (edit === 'row height') {
			// A dirty re-save must preserve the explicitly resized row too.
			reloadedTable.x += 1;
			const savedAgain = await reloader.save(reloaded.slides);
			const secondZip = await JSZip.loadAsync(savedAgain);
			const secondXml = await secondZip.file('ppt/slides/slide1.xml')!.async('string');
			expect(
				[...secondXml.matchAll(/<a:tr\b[^>]*\bh="(\d+)"/g)].map((match) => Number(match[1])),
			).toStrictEqual(expectedHeights);
		}
	});

	it('addTable then save → reload preserves rows, columns, and cell text', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addTable(
					{
						rows: [
							{ cells: [{ text: 'Header A' }, { text: 'Header B' }] },
							{ cells: [{ text: 'a1' }, { text: 'b1' }] },
							{ cells: [{ text: 'a2' }, { text: 'b2' }] },
						],
						firstRow: true,
					},
					{ x: 50, y: 80, width: 500, height: 180 },
				)
				.build(),
		);

		const savedBytes = await handler.save(data.slides);

		// 1. The saved slide XML must contain the table graphic frame.
		const zip = await JSZip.loadAsync(savedBytes);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
		expect(slideXml).toContain('<p:graphicFrame');
		expect(slideXml).toContain('<a:tbl');
		expect(slideXml).toContain('Header A');
		expect(slideXml).toContain('b2');

		// 2. Reloading the saved bytes must yield a 3×2 table element with
		//    cell text preserved.
		const reloader = new PptxHandler();
		const reloaded = await reloader.load(savedBytes.buffer as ArrayBuffer);
		expect(reloaded.slides).toHaveLength(1);

		const tableEl = reloaded.slides[0].elements.find((e) => e.type === 'table') as
			| TablePptxElement
			| undefined;
		expect(tableEl, 'reloaded slide is missing the table element').toBeDefined();
		expect(tableEl!.tableData?.rows).toHaveLength(3);
		expect(tableEl!.tableData?.rows[0].cells).toHaveLength(2);

		const allText = tableEl!
			.tableData!.rows.flatMap((r) => r.cells.map((c) => c.text ?? ''))
			.join('|');
		expect(allText).toContain('Header A');
		expect(allText).toContain('Header B');
		expect(allText).toContain('a1');
		expect(allText).toContain('b2');
	});

	it('styled cell runs emit <a:rPr> before <a:t> (CT_RegularTextRun schema order)', async () => {
		// OOXML requires `a:rPr?, a:t` sequence. Before the fix,
		// writeCellTextFormatting assigned `a:rPr` onto a run that already
		// had `a:t`, producing `<a:r><a:t>…</a:t><a:rPr…/></a:r>` —
		// schema-invalid.
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addTable(
					{
						rows: [
							{
								cells: [
									{ text: 'Bold', style: { bold: true } },
									{ text: 'Red', style: { color: '#FF0000' } },
								],
							},
						],
					},
					{ x: 10, y: 10, width: 400, height: 80 },
				)
				.build(),
		);
		const savedBytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(savedBytes);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');

		// For every run in the saved slide, if it has both <a:rPr> and <a:t>,
		// <a:rPr> must appear first.
		const runRegex = /<a:r>[\s\S]*?<\/a:r>/g;
		let match: RegExpExecArray | null;
		let runsInspected = 0;
		while ((match = runRegex.exec(slideXml)) !== null) {
			const runContent = match[0];
			const rPrIdx = runContent.indexOf('<a:rPr');
			const tIdx = runContent.indexOf('<a:t');
			if (rPrIdx >= 0 && tIdx >= 0) {
				expect(rPrIdx, `run with <a:t> before <a:rPr>: ${runContent}`).toBeLessThan(tIdx);
				runsInspected++;
			}
		}
		expect(runsInspected).toBeGreaterThan(0);
	});

	it('replicates PowerPoint "Insert Table" defaults on SDK-created tables', async () => {
		// Matches what PowerPoint's UI produces when you click Insert > Table
		// without picking a style:
		//  - <a:tblPr> with only the true flags as attributes (no `="0"` noise)
		//  - <a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>
		//    (Medium Style 2 - Accent 1) when the caller didn't pick one
		//  - <a:r> with <a:rPr lang="en-US" dirty="0"/> before <a:t>
		//  - <a:endParaRPr lang="en-US" .../> after runs in each paragraph
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addTable(
					{ rows: [{ cells: [{ text: 'hello' }] }] },
					{ x: 10, y: 10, width: 200, height: 60 },
				)
				.build(),
		);
		const savedBytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(savedBytes);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');

		// Default table style must be applied — otherwise the table renders
		// with no borders or fill in PowerPoint (unstyled-looking).
		expect(slideXml).toContain(
			'<a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}</a:tableStyleId>',
		);

		// `<a:tblPr>` shouldn't carry noisy `="0"` defaults — PowerPoint only
		// emits the attribute when the flag is true.
		const tblPrMatch = slideXml.match(/<a:tblPr\b([^>]*)>/);
		expect(tblPrMatch).not.toBeNull();
		expect(tblPrMatch![1]).not.toMatch(/\blastRow="0"/);
		expect(tblPrMatch![1]).not.toMatch(/\bbandCol="0"/);
		expect(tblPrMatch![1]).not.toMatch(/\bfirstCol="0"/);

		// Every run must declare lang + dirty like PowerPoint does.
		expect(slideXml).toContain('<a:rPr lang="en-US" dirty="0">');

		// Each paragraph in a cell must close with <a:endParaRPr> to match
		// PowerPoint's output, including the `dirty="0"` spell-check marker.
		expect(slideXml).toMatch(/<a:endParaRPr\s[^>]*\bdirty="0"/);

		// <a:gridCol> must include an <a:extLst> with the a16:colId
		// tracking extension — PowerPoint emits this on every
		// "Insert Table" column so future edits can identify columns
		// across saves.
		expect(slideXml).toContain('<a:ext uri="{9D8B030D-6E8A-4147-A177-3AD203B41FA5}">');
		// PK-H2: `xmlns:a16` is declared on the slide root, not the leaf
		// `<a16:colId>` element. The leaf carries only the `@val` attribute
		// and the slide root carries `xmlns:a16` plus `mc:Ignorable="…a16…"`.
		expect(slideXml).toMatch(/<a16:colId\s+val="\d+"/);
		expect(slideXml).toContain('xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main"');
		expect(slideXml).toMatch(/mc:Ignorable="[^"]*\ba16\b[^"]*"/);
	});

	it('preserves rich cells through unrelated and equal-text merge save round-trips', async () => {
		let handler = new PptxHandler();
		let loaded = await handler.load((await buildDeckWithRichTableCell()).buffer as ArrayBuffer);
		let table = loaded.slides[0].elements.find(
			(element) => element.type === 'table',
		) as TablePptxElement;
		const richRuns = structuredClone(table.tableData!.rows[1].cells[0].textRuns);
		expect(richRuns).toStrictEqual([
			{ text: 'Rich', bold: true },
			{ text: '1', isField: true },
			{ text: 'Text', italic: true },
		]);

		const merged = structuredClone(table.tableData!);
		merged.rows[0].cells[0].text = 'A B';
		delete merged.rows[0].cells[0].textRuns;
		merged.rows[0].cells[0].gridSpan = 2;
		merged.rows[0].cells[1].text = '';
		delete merged.rows[0].cells[1].textRuns;
		merged.rows[0].cells[1].hMerge = true;
		table.rawXml = updateMergeAttrsInRawXml(table, merged);
		table.tableData = merged;

		let saved = await handler.save(loaded.slides);
		handler = new PptxHandler();
		loaded = await handler.load(saved.buffer as ArrayBuffer);
		table = loaded.slides[0].elements.find(
			(element) => element.type === 'table',
		) as TablePptxElement;
		expect(table.tableData!.rows[0].cells[0].textRuns).toHaveLength(1);
		expect(table.tableData!.rows[0].cells[0].textRuns?.[0].text).toBe('A B');
		expect(table.tableData!.rows[1].cells[0].textRuns).toStrictEqual(richRuns);

		const split = structuredClone(table.tableData!);
		delete split.rows[0].cells[0].gridSpan;
		delete split.rows[0].cells[1].hMerge;
		table.rawXml = updateMergeAttrsInRawXml(table, split);
		table.tableData = split;

		saved = await handler.save(loaded.slides);
		const splitHandler = new PptxHandler();
		const reloaded = await splitHandler.load(saved.buffer as ArrayBuffer);
		const splitTable = reloaded.slides[0].elements.find(
			(element) => element.type === 'table',
		) as TablePptxElement;
		expect(splitTable.tableData!.rows[1].cells[0].textRuns).toStrictEqual(richRuns);

		const equalTextMerge = structuredClone(splitTable.tableData!);
		equalTextMerge.rows[1].cells[0].gridSpan = 2;
		equalTextMerge.rows[1].cells[1].hMerge = true;
		splitTable.rawXml = updateMergeAttrsInRawXml(splitTable, equalTextMerge);
		splitTable.tableData = equalTextMerge;
		const equalTextSaved = await splitHandler.save(reloaded.slides);
		const equalTextReloaded = await new PptxHandler().load(equalTextSaved.buffer as ArrayBuffer);
		const equalTextTable = equalTextReloaded.slides[0].elements.find(
			(element) => element.type === 'table',
		) as TablePptxElement;
		expect(equalTextTable.tableData!.rows[1].cells[0].textRuns).toStrictEqual(richRuns);
	});
});
